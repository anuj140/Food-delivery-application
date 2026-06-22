import { db } from "../db.js";
import {
  orders,
  restaurants,
  addresses,
  deliveryAssignments,
  deliveryPartners,
  locationHistory,
  partnerComplianceLogs,
} from "../schema.js";
import { eq, and, not, sql, gte } from "drizzle-orm";
import {
  partnerProfileSchema,
  partnerLocationSchema,
  partnerOrderStatusSchema,
  otpVerifySchema,
  validateData,
} from "../utils/validators.js";
import { uploadImage } from "../utils/cloudinary.js";
import { earnPoints } from "./loyalty.js";

// Returns true if the partner has a verified selfie compliance log dated today.
async function hasVerifiedSelfieToday(partnerId) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const [log] = await db
    .select()
    .from(partnerComplianceLogs)
    .where(
      and(
        eq(partnerComplianceLogs.partnerId, partnerId),
        eq(partnerComplianceLogs.type, "selfie"),
        eq(partnerComplianceLogs.isVerified, true),
        gte(partnerComplianceLogs.createdAt, startOfDay),
      ),
    )
    .limit(1);
  return !!log;
}

export { hasVerifiedSelfieToday };

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

function generateOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function getPartner(userId) {
  const [partner] = await db.select().from(deliveryPartners).where(eq(deliveryPartners.userId, userId)).limit(1);
  return partner;
}

export async function updatePartnerProfile(req, res) {
  try {
    const userId = req.user.id;
    const validation = validateData(partnerProfileSchema, req.body);
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: "Validation failed", errors: validation.errors });
    }

    const [partner] = await db.select().from(deliveryPartners).where(eq(deliveryPartners.userId, userId)).limit(1);
    if (!partner) {
      return res.status(404).json({ success: false, message: "Delivery partner profile not found" });
    }

    const { vehicleType, isOnline, licenseUrl, registrationUrl } = validation.data;

    // Compliance gate (Story 11): partner must pass a selfie check before going online.
    if (isOnline === true && !partner.isOnline) {
      const verified = await hasVerifiedSelfieToday(partner.id);
      if (!verified) {
        return res.status(403).json({
          success: false,
          message: "Selfie verification required before going online. Complete /api/partner/selfie-verify first.",
        });
      }
    }

    const updatedDocuments = {
      ...(partner.documents || {}),
      ...(licenseUrl ? { licenseUrl } : {}),
      ...(registrationUrl ? { registrationUrl } : {}),
    };

    await db
      .update(deliveryPartners)
      .set({
        vehicleType: vehicleType ?? partner.vehicleType,
        isOnline: isOnline ?? partner.isOnline,
        documents: updatedDocuments,
        updatedAt: new Date(),
      })
      .where(eq(deliveryPartners.id, partner.id));

    return res.status(200).json({ success: true, message: "Partner profile updated" });
  } catch (error) {
    console.error("Update partner profile error:", error);
    return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
  }
}

export async function updatePartnerLocation(req, res) {
  try {
    const userId = req.user.id;
    const validation = validateData(partnerLocationSchema, req.body);
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: "Validation failed", errors: validation.errors });
    }

    const [partner] = await db.select().from(deliveryPartners).where(eq(deliveryPartners.userId, userId)).limit(1);
    if (!partner) {
      return res.status(404).json({ success: false, message: "Delivery partner profile not found" });
    }

    const { lat, lng } = validation.data;
    await db
      .update(deliveryPartners)
      .set({ currentLat: lat, currentLng: lng, lastLocationUpdate: new Date(), updatedAt: new Date() })
      .where(eq(deliveryPartners.id, partner.id));

    const [assignment] = await db
      .select()
      .from(deliveryAssignments)
      .where(and(eq(deliveryAssignments.partnerId, partner.id), not(eq(deliveryAssignments.status, "delivered"))))
      .limit(1);

    if (assignment) {
      await db.insert(locationHistory).values({ assignmentId: assignment.id, lat, lng });
    }

    return res.status(200).json({ success: true, message: "Location updated" });
  } catch (error) {
    console.error("Update partner location error:", error);
    return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
  }
}

export async function getAvailableOrders(req, res) {
  try {
    const userId = req.user.id;
    const partner = await getPartner(userId);
    if (!partner) {
      return res.status(404).json({ success: false, message: "Delivery partner profile not found" });
    }

    if (!partner.currentLat || !partner.currentLng) {
      return res.status(400).json({ success: false, message: "Partner location must be available" });
    }

    const activeAssignments = await db
      .select({ orderId: deliveryAssignments.orderId })
      .from(deliveryAssignments)
      .where(not(eq(deliveryAssignments.status, "delivered")));
    const activeOrderIds = new Set(activeAssignments.map((item) => item.orderId));

    const candidateOrders = await db
      .select({ order: orders, restaurant: restaurants, address: addresses })
      .from(orders)
      .innerJoin(restaurants, eq(orders.restaurantId, restaurants.id))
      .innerJoin(addresses, eq(orders.addressId, addresses.id))
      .where(eq(orders.status, "ready"));

    const nearbyOrders = candidateOrders
      .filter(({ order, restaurant }) => {
        if (activeOrderIds.has(order.id)) {
          return false;
        }
        if (!restaurant.lat || !restaurant.lng) {
          return false;
        }
        const distance = calculateDistanceKm(
          Number(partner.currentLat),
          Number(partner.currentLng),
          Number(restaurant.lat),
          Number(restaurant.lng),
        );
        return distance <= 5;
      })
      .map(({ order, restaurant, address }) => {
        const distance = calculateDistanceKm(
          Number(partner.currentLat),
          Number(partner.currentLng),
          Number(restaurant.lat),
          Number(restaurant.lng),
        );
        const estimatedPayout = Number((40 + distance * 5).toFixed(2));
        return {
          orderId: order.id,
          restaurantName: restaurant.name,
          restaurantLat: Number(restaurant.lat),
          restaurantLng: Number(restaurant.lng),
          customerAddress: address.addressLine,
          totalAmount: Number(order.totalAmount),
          specialInstructions: order.specialInstructions,
          distanceKm: Number(distance.toFixed(2)),
          estimatedPayout,
          status: order.status,
        };
      })
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 5);

    return res.status(200).json({ success: true, data: nearbyOrders });
  } catch (error) {
    console.error("Get available orders error:", error);
    return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
  }
}

export async function acceptOrder(req, res) {
  try {
    const userId = req.user.id;
    const { orderId } = req.params;
    const partner = await getPartner(userId);
    if (!partner) {
      return res.status(404).json({ success: false, message: "Delivery partner profile not found" });
    }

    if (!partner.currentLat || !partner.currentLng) {
      return res.status(400).json({ success: false, message: "Current partner location is required before accepting orders" });
    }

    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }
    if (order.status !== "ready") {
      return res.status(400).json({ success: false, message: "Only ready orders may be accepted" });
    }

    const activeOrders = await db
      .select()
      .from(deliveryAssignments)
      .where(and(eq(deliveryAssignments.partnerId, partner.id), not(eq(deliveryAssignments.status, "delivered"))));

    if (activeOrders.length >= 2) {
      return res.status(400).json({ success: false, message: "You may only accept up to 2 active orders at once" });
    }

    const sequence = activeOrders.length + 1;
    const [restaurant] = await db.select().from(restaurants).where(eq(restaurants.id, order.restaurantId)).limit(1);
    if (!restaurant) {
      return res.status(404).json({ success: false, message: "Restaurant not found" });
    }

    const distance = calculateDistanceKm(
      Number(partner.currentLat),
      Number(partner.currentLng),
      Number(restaurant.lat),
      Number(restaurant.lng),
    );
    const partnerEarnings = Number((40 + distance * 5).toFixed(2));
    const otpCode = Number(order.totalAmount) >= 500 ? generateOtpCode() : null;

    const [assignment] = await db
      .insert(deliveryAssignments)
      .values({
        orderId: order.id,
        partnerId: partner.id,
        sequence,
        status: "assigned",
        otpCode,
        partnerEarnings: partnerEarnings.toFixed(2),
      })
      .returning();

    await db.update(orders).set({ status: "assigned", updatedAt: new Date() }).where(eq(orders.id, order.id));

    return res.status(201).json({
      success: true,
      message: "Order accepted successfully",
      data: {
        assignment,
        partnerEarnings,
        otpCode,
      },
    });
  } catch (error) {
    console.error("Accept partner order error:", error);
    return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
  }
}

export async function getActiveOrders(req, res) {
  try {
    const userId = req.user.id;
    const partner = await getPartner(userId);
    if (!partner) {
      return res.status(404).json({ success: false, message: "Delivery partner profile not found" });
    }

    const activeAssignments = await db
      .select({ assignment: deliveryAssignments, order: orders, restaurant: restaurants })
      .from(deliveryAssignments)
      .innerJoin(orders, eq(deliveryAssignments.orderId, orders.id))
      .innerJoin(restaurants, eq(orders.restaurantId, restaurants.id))
      .where(and(eq(deliveryAssignments.partnerId, partner.id), not(eq(deliveryAssignments.status, "delivered"))));

    return res.status(200).json({ success: true, data: activeAssignments });
  } catch (error) {
    console.error("Get active orders error:", error);
    return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
  }
}

export async function updateOrderStatus(req, res) {
  try {
    const userId = req.user.id;
    const { orderId } = req.params;
    const validation = validateData(partnerOrderStatusSchema, req.body);
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: "Validation failed", errors: validation.errors });
    }

    const [partner] = await db.select().from(deliveryPartners).where(eq(deliveryPartners.userId, userId)).limit(1);
    if (!partner) {
      return res.status(404).json({ success: false, message: "Delivery partner profile not found" });
    }

    const [assignment] = await db
      .select()
      .from(deliveryAssignments)
      .where(and(eq(deliveryAssignments.orderId, orderId), eq(deliveryAssignments.partnerId, partner.id)))
      .limit(1);
    if (!assignment) {
      return res.status(404).json({ success: false, message: "Delivery assignment not found" });
    }

    const allowedTransitions = {
      assigned: ["arrived_at_restaurant"],
      arrived_at_restaurant: ["picked_up"],
      picked_up: ["arrived_at_customer"],
      arrived_at_customer: ["delivered"],
    };

    const nextStatus = validation.data.status;
    const validNext = allowedTransitions[assignment.status] || [];
    if (!validNext.includes(nextStatus)) {
      return res.status(400).json({ success: false, message: `Cannot move assignment from ${assignment.status} to ${nextStatus}` });
    }

    const updatePayload = { status: nextStatus, updatedAt: new Date() };
    if (nextStatus === "picked_up") updatePayload.pickedUpAt = new Date();
    if (nextStatus === "delivered") updatePayload.deliveredAt = new Date();

    await db.update(deliveryAssignments).set(updatePayload).where(eq(deliveryAssignments.id, assignment.id));

    if (nextStatus === "delivered") {
      const [completedOrder] = await db
        .update(orders)
        .set({ status: "completed", updatedAt: new Date() })
        .where(eq(orders.id, assignment.orderId))
        .returning();
      await db
        .update(deliveryPartners)
        .set({ totalDeliveries: sql`${deliveryPartners.totalDeliveries} + 1`, updatedAt: new Date() })
        .where(eq(deliveryPartners.id, partner.id));

      // Award loyalty points for the completed order (Story 50).
      if (completedOrder) {
        await earnPoints(completedOrder.customerId, completedOrder.id, completedOrder.totalAmount);
      }
    }

    return res.status(200).json({ success: true, message: `Assignment status updated to ${nextStatus}` });
  } catch (error) {
    console.error("Update partner assignment status error:", error);
    return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
  }
}

export async function uploadDeliveryProof(req, res) {
  try {
    const userId = req.user.id;
    const { orderId } = req.params;

    if (!req.file) {
      return res.status(400).json({ success: false, message: "Proof photo file is required" });
    }

    const [partner] = await db.select().from(deliveryPartners).where(eq(deliveryPartners.userId, userId)).limit(1);
    if (!partner) {
      return res.status(404).json({ success: false, message: "Delivery partner profile not found" });
    }

    const uploaded = await uploadImage(req.file.buffer, "delivery-proofs");
    const proofPhotoUrl = uploaded.secure_url;

    const [assignment] = await db
      .select()
      .from(deliveryAssignments)
      .where(and(eq(deliveryAssignments.orderId, orderId), eq(deliveryAssignments.partnerId, partner.id)))
      .limit(1);
    if (!assignment) {
      return res.status(404).json({ success: false, message: "Delivery assignment not found" });
    }

    await db
      .update(deliveryAssignments)
      .set({ proofPhotoUrl, updatedAt: new Date() })
      .where(eq(deliveryAssignments.id, assignment.id));

    return res.status(200).json({ success: true, message: "Delivery proof uploaded" });
  } catch (error) {
    console.error("Upload delivery proof error:", error);
    return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
  }
}

export async function verifyOtp(req, res) {
  try {
    const userId = req.user.id;
    const { orderId } = req.params;
    const validation = validateData(otpVerifySchema, req.body);
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: "Validation failed", errors: validation.errors });
    }

    const [partner] = await db.select().from(deliveryPartners).where(eq(deliveryPartners.userId, userId)).limit(1);
    if (!partner) {
      return res.status(404).json({ success: false, message: "Delivery partner profile not found" });
    }

    const [assignment] = await db
      .select()
      .from(deliveryAssignments)
      .where(and(eq(deliveryAssignments.orderId, orderId), eq(deliveryAssignments.partnerId, partner.id)))
      .limit(1);
    if (!assignment) {
      return res.status(404).json({ success: false, message: "Delivery assignment not found" });
    }

    if (!assignment.otpCode) {
      return res.status(400).json({ success: false, message: "OTP verification not required for this order" });
    }

    if (assignment.otpCode !== validation.data.otpCode) {
      return res.status(400).json({ success: false, message: "Invalid OTP code" });
    }

    await db
      .update(deliveryAssignments)
      .set({ otpVerifiedAt: new Date(), updatedAt: new Date() })
      .where(eq(deliveryAssignments.id, assignment.id));

    return res.status(200).json({ success: true, message: "OTP verified successfully" });
  } catch (error) {
    console.error("Verify OTP error:", error);
    return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
  }
}
