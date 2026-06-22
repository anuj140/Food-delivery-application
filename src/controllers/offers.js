import { db } from "../db.js";
import { coupons, restaurantCoupons, carts, cartItems, menuItems } from "../schema.js";
import { eq, and, sql } from "drizzle-orm";
import { getCartSubtotal } from "./coupons.js";
import { calculateDiscount, isCouponUsable } from "../utils/discount.js";

// Static bank-offer stubs (no real bank integration in MVP 4).
const BANK_OFFERS = [
  { code: "HDFC10", description: "10% off up to ₹100 on HDFC cards", source: "bank" },
  { code: "ICICIUPI", description: "₹50 cashback on ICICI UPI", source: "bank" },
];

// GET /api/offers — combined platform + restaurant + bank offers currently valid.
export async function listOffers(req, res) {
  try {
    const now = new Date();

    const platform = await db
      .select()
      .from(coupons)
      .where(and(eq(coupons.active, true), sql`NOW() BETWEEN ${coupons.validFrom} AND ${coupons.validTo}`));

    const restaurant = await db
      .select()
      .from(restaurantCoupons)
      .where(
        and(
          eq(restaurantCoupons.active, true),
          sql`NOW() BETWEEN ${restaurantCoupons.validFrom} AND ${restaurantCoupons.validTo}`,
        ),
      );

    // For restaurant coupons honour time slots (e.g. lunch specials 12–3 PM).
    const restaurantActive = restaurant.filter((c) => isCouponUsable({ ...c, minOrderValue: "0" }, Infinity, now));

    return res.status(200).json({
      success: true,
      data: {
        platform: platform.map((c) => ({ source: "platform", ...c })),
        restaurant: restaurantActive.map((c) => ({ source: "restaurant", ...c })),
        bank: BANK_OFFERS,
      },
    });
  } catch (error) {
    console.error("List offers error:", error);
    return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
  }
}

// Returns the distinct restaurantId(s) represented in a user's cart.
async function getCartRestaurantIds(userId) {
  const [cart] = await db.select().from(carts).where(eq(carts.userId, userId)).limit(1);
  if (!cart) return [];
  const rows = await db
    .select({ restaurantId: menuItems.restaurantId })
    .from(cartItems)
    .innerJoin(menuItems, eq(cartItems.menuItemId, menuItems.id))
    .where(eq(cartItems.cartId, cart.id));
  return [...new Set(rows.map((r) => r.restaurantId))];
}

// POST /api/cart/auto-apply-coupon — picks the best applicable coupon for the cart.
export async function autoApplyCoupon(req, res) {
  try {
    const userId = req.user.id;
    const subtotal = await getCartSubtotal(userId);
    if (subtotal <= 0) {
      return res.status(400).json({ success: false, message: "Cart is empty" });
    }

    const now = new Date();
    const restaurantIds = await getCartRestaurantIds(userId);

    const platform = await db.select().from(coupons).where(eq(coupons.active, true));

    let restaurant = [];
    if (restaurantIds.length === 1) {
      restaurant = await db
        .select()
        .from(restaurantCoupons)
        .where(
          and(eq(restaurantCoupons.active, true), eq(restaurantCoupons.restaurantId, restaurantIds[0])),
        );
    }

    const candidates = [
      ...platform.map((c) => ({ ...c, source: "platform" })),
      ...restaurant.map((c) => ({ ...c, source: "restaurant" })),
    ];

    let best = null;
    let bestDiscount = 0;
    for (const c of candidates) {
      if (!isCouponUsable(c, subtotal, now)) continue;
      const discount = calculateDiscount(c, subtotal);
      if (discount > bestDiscount) {
        bestDiscount = discount;
        best = c;
      }
    }

    if (!best) {
      return res.status(200).json({ success: true, data: null, message: "No applicable coupon for this cart" });
    }

    return res.status(200).json({
      success: true,
      data: {
        code: best.code,
        source: best.source,
        discountType: best.discountType,
        discountValue: Number(best.discountValue),
        discountAmount: Math.round(bestDiscount * 100) / 100,
        subtotal,
      },
    });
  } catch (error) {
    console.error("Auto-apply coupon error:", error);
    return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
  }
}
