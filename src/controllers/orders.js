// @ts-nocheck
import { db } from "../db.js";
import {
  orders,
  orderItems,
  payments,
  carts,
  cartItems,
  menuItems,
  addresses,
  coupons,
  restaurants,
  deliveryAssignments,
  deliveryPartners,
  tips,
  ratings,
} from "../schema.js";
import { eq, and, sql } from "drizzle-orm";
import {
  orderCreationSchema,
  validateData,
  ratingSchema,
  tipSchema,
} from "../utils/validators.js";
import { uploadImages } from "../utils/cloudinary.js";

const DELIVERY_FEE = 30.0;
const PACKAGING_FEE = 20.0;
const TAX_RATE = 0.05;

// Recomputes a restaurant's avgRating as the mean of all its food ratings.
async function recomputeRestaurantRating(restaurantId) {
  if (!restaurantId) return;
  const [row] = await db
    .select({ avg: sql`AVG(${ratings.foodRating})` })
    .from(ratings)
    .where(eq(ratings.restaurantId, restaurantId));
  const avg = row?.avg ? Number(row.avg).toFixed(1) : "0";
  await db.update(restaurants).set({ avgRating: avg, updatedAt: new Date() }).where(eq(restaurants.id, restaurantId));
}

function calculateDiscount(coupon, subtotal) {
  if (!coupon) {
    return 0;
  }

  if (coupon.discountType === "percentage") {
    const discountValue = (subtotal * Number(coupon.discountValue)) / 100;
    return Math.min(discountValue, Number(coupon.maxDiscount));
  }

  return Math.min(Number(coupon.discountValue), subtotal);
}

function calculateOrderAmounts(subtotal, discountAmount) {
  const packagingFee = subtotal > 0 ? PACKAGING_FEE : 0;
  const deliveryFee = subtotal > 0 ? DELIVERY_FEE : 0;
  const taxAmount = Number(((subtotal + packagingFee + deliveryFee) * TAX_RATE).toFixed(2));
  const totalAmount = Number((subtotal + packagingFee + deliveryFee + taxAmount - discountAmount).toFixed(2));

  return { packagingFee, deliveryFee, taxAmount, totalAmount };
}

function calculateDistanceKm(lat1, lng1, lat2, lng2) {
  const toRad = (value) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return 6371 * c;
}

function formatEta(distanceKm, status) {
  if (!distanceKm || Number.isNaN(distanceKm)) {
    return null;
  }
  if (status === "picked_up") {
    return Math.max(3, Math.ceil(distanceKm * 2));
  }
  return Math.max(5, Math.ceil(distanceKm * 3));
}

async function getCartItems(userId) {
  const [cart] = await db.select().from(carts).where(eq(carts.userId, userId)).limit(1);
  if (!cart) {
    return [];
  }

  const rows = await db
    .select({ cartItem: cartItems, menuItem: menuItems })
    .from(cartItems)
    .innerJoin(menuItems, eq(cartItems.menuItemId, menuItems.id))
    .where(eq(cartItems.cartId, cart.id));

  return rows.map(({ cartItem, menuItem }) => ({
    cartItem,
    menuItem,
  }));
}

export async function createOrder(req, res) {
  try {
    const userId = req.user.id;
    const validation = validateData(orderCreationSchema, req.body);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validation.errors,
      });
    }

    const { addressId, couponCode, scheduledTime, specialInstructions, paymentMethod, paymentGateway } = validation.data;

    const [address] = await db
      .select()
      .from(addresses)
      .where(and(eq(addresses.id, addressId), eq(addresses.userId, userId)))
      .limit(1);

    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Delivery address not found",
      });
    }

    const cartRows = await getCartItems(userId);
    if (cartRows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Cart is empty",
      });
    }

    const invalidItem = cartRows.find(({ menuItem }) => !menuItem.isAvailable);
    if (invalidItem) {
      return res.status(400).json({
        success: false,
        message: `Menu item ${invalidItem.menuItem.name} is not available`,
      });
    }

    const restaurantIds = [...new Set(cartRows.map(({ menuItem }) => menuItem.restaurantId))];
    if (restaurantIds.length > 1) {
      return res.status(400).json({
        success: false,
        message: "All cart items must belong to the same restaurant",
      });
    }

    const restaurantId = restaurantIds[0];
    const [restaurant] = await db.select().from(restaurants).where(eq(restaurants.id, restaurantId)).limit(1);
    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: "Restaurant not found",
      });
    }

    const subtotal = cartRows.reduce(
      (sum, { cartItem }) => sum + Number(cartItem.priceAtAdd) * Number(cartItem.quantity),
      0,
    );

    let coupon = null;
    let discountAmount = 0;
    if (couponCode) {
      const [foundCoupon] = await db
        .select()
        .from(coupons)
        .where(
          and(
            eq(coupons.code, couponCode),
            eq(coupons.active, true),
            sql`NOW() BETWEEN ${coupons.validFrom} AND ${coupons.validTo}`,
          ),
        )
        .limit(1);

      if (!foundCoupon) {
        return res.status(404).json({
          success: false,
          message: "Coupon not found or not active",
        });
      }
      coupon = foundCoupon;
      if (Number(coupon.usedCount) >= Number(coupon.usageLimit)) {
        return res.status(400).json({
          success: false,
          message: "Coupon usage limit reached",
        });
      }
      if (subtotal < Number(coupon.minOrderValue)) {
        return res.status(400).json({
          success: false,
          message: `Coupon requires minimum order value of ${coupon.minOrderValue}`,
        });
      }
      discountAmount = calculateDiscount(coupon, subtotal);
    }

    const { packagingFee, deliveryFee, taxAmount, totalAmount } = calculateOrderAmounts(subtotal, discountAmount);
    const orderStatus = paymentMethod === "cod" ? "paid" : "pending_payment";

    const [createdOrder] = await db
      .insert(orders)
      .values({
        customerId: userId,
        restaurantId,
        addressId,
        couponId: coupon ? coupon.id : null,
        status: orderStatus,
        subtotal: subtotal.toFixed(2),
        deliveryFee: deliveryFee.toFixed(2),
        packagingFee: packagingFee.toFixed(2),
        taxAmount: taxAmount.toFixed(2),
        discountAmount: discountAmount.toFixed(2),
        totalAmount: totalAmount.toFixed(2),
        scheduledTime: scheduledTime ? new Date(scheduledTime) : null,
        specialInstructions: specialInstructions || null,
      })
      .returning();

    const orderItemsData = cartRows.map(({ cartItem, menuItem }) => ({
      orderId: createdOrder.id,
      menuItemId: menuItem.id,
      nameSnapshot: menuItem.name,
      priceSnapshot: menuItem.price,
      quantity: cartItem.quantity,
      customizationsSnapshot: cartItem.customizations || {},
    }));

    await db.insert(orderItems).values(orderItemsData);

    if (coupon) {
      await db
        .update(coupons)
        .set({ usedCount: sql`${coupons.usedCount} + 1`, updatedAt: new Date() })
        .where(eq(coupons.id, coupon.id));
    }

    await db.delete(cartItems).where(eq(cartItems.cartId, cartRows[0].cartItem.cartId));

    const [createdPayment] = await db
      .insert(payments)
      .values({
        orderId: createdOrder.id,
        gateway: paymentGateway || "razorpay",
        gatewayTxnId: `init-${Date.now()}-${createdOrder.id}`,
        amount: totalAmount.toFixed(2),
        method: paymentMethod,
        status: paymentMethod === "cod" ? "success" : "pending",
        metadata: {},
      })
      .returning();

    return res.status(201).json({
      success: true,
      message: "Order created successfully",
      data: {
        order: createdOrder,
        payment: createdPayment,
      },
    });
  } catch (error) {
    console.error("Create order error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
}

export async function getOrder(req, res) {
  try {
    const userId = req.user.id;
    const { orderId } = req.params;

    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const isCustomer = order.customerId === userId;
    const [restaurant] = await db
      .select()
      .from(restaurants)
      .where(eq(restaurants.userId, userId))
      .limit(1);
    const isRestaurantOwner = restaurant && restaurant.id === order.restaurantId;

    if (!isCustomer && !isRestaurantOwner) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view this order",
      });
    }

    const orderItemsRows = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
    const paymentRows = await db.select().from(payments).where(eq(payments.orderId, order.id));

    return res.status(200).json({
      success: true,
      data: {
        order,
        items: orderItemsRows,
        payments: paymentRows,
      },
    });
  } catch (error) {
    console.error("Get order error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
}

export async function getOrderTracking(req, res) {
  try {
    const userId = req.user.id;
    const { orderId } = req.params;

    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!order || order.customerId !== userId) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const [assignment] = await db
      .select()
      .from(deliveryAssignments)
      .where(eq(deliveryAssignments.orderId, order.id))
      .limit(1);

    if (!assignment) {
      return res.status(200).json({
        success: true,
        data: {
          orderStatus: order.status,
          tracking: null,
          message: "No delivery partner assigned yet",
        },
      });
    }

    const [partner] = await db
      .select()
      .from(deliveryPartners)
      .where(eq(deliveryPartners.id, assignment.partnerId))
      .limit(1);

    const [deliveryAddress] = await db
      .select()
      .from(addresses)
      .where(eq(addresses.id, order.addressId))
      .limit(1);

    const location = partner?.currentLat && partner?.currentLng ? {
      lat: Number(partner.currentLat),
      lng: Number(partner.currentLng),
    } : null;

    const eta = location && deliveryAddress
      ? formatEta(
          calculateDistanceKm(
            Number(partner.currentLat),
            Number(partner.currentLng),
            Number(deliveryAddress.lat),
            Number(deliveryAddress.lng),
          ),
          assignment.status,
        )
      : null;

    return res.status(200).json({
      success: true,
      data: {
        orderStatus: order.status,
        assignment,
        partner: partner
          ? {
              id: partner.id,
              vehicleType: partner.vehicleType,
              rating: partner.rating,
              currentLat: location?.lat,
              currentLng: location?.lng,
            }
          : null,
        eta,
      },
    });
  } catch (error) {
    console.error("Get order tracking error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
}

export async function rateOrder(req, res) {
  try {
    const userId = req.user.id;
    const { orderId } = req.params;
    const validation = validateData(ratingSchema, req.body);
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: "Validation failed", errors: validation.errors });
    }

    const { foodRating, deliveryRating, reviewText } = validation.data;
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!order || order.customerId !== userId) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (order.status !== "completed") {
      return res.status(400).json({ success: false, message: "Order must be completed before rating" });
    }

    const existingRating = await db.select().from(ratings).where(eq(ratings.orderId, order.id));
    if (existingRating.length > 0) {
      return res.status(400).json({ success: false, message: "Order has already been rated" });
    }

    // Up to 3 review photos uploaded server-side to Cloudinary.
    let photoUrls = [];
    if (Array.isArray(req.files) && req.files.length > 0) {
      photoUrls = await uploadImages(req.files.slice(0, 3), "reviews");
    }

    await db.insert(ratings).values({
      orderId: order.id,
      customerId: order.customerId,
      restaurantId: order.restaurantId,
      foodRating,
      deliveryRating,
      reviewText: reviewText || null,
      photos: photoUrls,
    });

    await recomputeRestaurantRating(order.restaurantId);

    return res.status(200).json({ success: true, message: "Thank you for rating the order" });
  } catch (error) {
    console.error("Rate order error:", error);
    return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
  }
}

export async function tipOrder(req, res) {
  try {
    const userId = req.user.id;
    const { orderId } = req.params;
    const validation = validateData(tipSchema, req.body);
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: "Validation failed", errors: validation.errors });
    }

    const { amount } = validation.data;
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!order || order.customerId !== userId) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (order.status !== "completed") {
      return res.status(400).json({ success: false, message: "Tip can only be added after delivery completion" });
    }

    const [assignment] = await db
      .select()
      .from(deliveryAssignments)
      .where(eq(deliveryAssignments.orderId, order.id))
      .limit(1);

    if (!assignment) {
      return res.status(404).json({ success: false, message: "Delivery assignment not found" });
    }

    await db.insert(tips).values({
      orderId: order.id,
      partnerId: assignment.partnerId,
      amount: amount.toFixed(2),
      status: "completed",
    });

    return res.status(200).json({ success: true, message: "Tip added successfully" });
  } catch (error) {
    console.error("Tip order error:", error);
    return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
  }
}

export async function requestCallback(req, res) {
  try {
    const userId = req.user.id;
    const { orderId } = req.params;

    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!order || order.customerId !== userId) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const maskedNumber = `+91-xxxxxx${Math.floor(1000 + Math.random() * 9000)}`;
    return res.status(200).json({
      success: true,
      message: "Callback request submitted. Use the masked number to connect with the delivery partner.",
      data: {
        maskedNumber,
      },
    });
  } catch (error) {
    console.error("Request callback error:", error);
    return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
  }
}

export async function cancelOrder(req, res) {
  try {
    const userId = req.user.id;
    const { orderId } = req.params;

    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }
    if (order.customerId !== userId) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to cancel this order",
      });
    }

    if (order.status === "accepted" || order.status === "preparing" || order.status === "ready") {
      return res.status(400).json({
        success: false,
        message: "Order cannot be cancelled after restaurant has accepted it",
      });
    }

    await db.update(orders).set({ status: "cancelled", updatedAt: new Date() }).where(eq(orders.id, order.id));

    const paymentRecord = await db.select().from(payments).where(eq(payments.orderId, order.id)).limit(1);
    if (paymentRecord.length > 0 && paymentRecord[0].status === "success") {
      await db
        .update(payments)
        .set({ status: "refunded", metadata: { refundedAt: new Date().toISOString() } })
        .where(eq(payments.id, paymentRecord[0].id));
    }

    return res.status(200).json({
      success: true,
      message: "Order cancelled successfully",
    });
  } catch (error) {
    console.error("Cancel order error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
}
