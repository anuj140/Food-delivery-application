import { db } from "../db.js";
import { coupons, carts, cartItems, menuItems } from "../schema.js";
import { eq, and, sql } from "drizzle-orm";
import { validateCouponSchema, validateData } from "../utils/validators.js";
import { calculateDiscount } from "../utils/discount.js";

export async function getCartSubtotal(userId) {
  const [cart] = await db.select().from(carts).where(eq(carts.userId, userId)).limit(1);
  if (!cart) {
    return 0;
  }

  const rows = await db
    .select({ item: cartItems, menu: menuItems })
    .from(cartItems)
    .innerJoin(menuItems, eq(cartItems.menuItemId, menuItems.id))
    .where(eq(cartItems.cartId, cart.id));

  return rows.reduce((sum, row) => sum + Number(row.item.priceAtAdd) * Number(row.item.quantity), 0);
}

export async function validateCoupon(req, res) {
  try {
    const userId = req.user.id;
    const validation = validateData(validateCouponSchema, req.body);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validation.errors,
      });
    }

    const { code } = validation.data;
    const subtotal = await getCartSubtotal(userId);

    const [coupon] = await db
      .select()
      .from(coupons)
      .where(
        and(
          eq(coupons.code, code),
          eq(coupons.active, true),
          sql`NOW() BETWEEN ${coupons.validFrom} AND ${coupons.validTo}`,
        ),
      )
      .limit(1);

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found or not active",
      });
    }

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

    const discountAmount = calculateDiscount(coupon, subtotal);

    return res.status(200).json({
      success: true,
      data: {
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: Number(coupon.discountValue),
        discountAmount,
        minOrderValue: Number(coupon.minOrderValue),
        maxDiscount: Number(coupon.maxDiscount),
      },
    });
  } catch (error) {
    console.error("Validate coupon error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
}

export async function listAvailableCoupons(req, res) {
  try {
    const userId = req.user.id;
    const subtotal = await getCartSubtotal(userId);

    const availableCoupons = await db
      .select()
      .from(coupons)
      .where(
        and(
          eq(coupons.active, true),
          sql`NOW() BETWEEN ${coupons.validFrom} AND ${coupons.validTo}`,
          sql`${subtotal} >= ${coupons.minOrderValue}`,
          sql`${coupons.usedCount} < ${coupons.usageLimit}`,
        ),
      );

    const response = availableCoupons.map((coupon) => ({
      id: coupon.id,
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: Number(coupon.discountValue),
      minOrderValue: Number(coupon.minOrderValue),
      maxDiscount: Number(coupon.maxDiscount),
      expiresAt: coupon.validTo,
    }));

    return res.status(200).json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error("List coupons error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
}
