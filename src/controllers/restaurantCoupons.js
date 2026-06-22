import { db } from "../db.js";
import { restaurantCoupons } from "../schema.js";
import { eq, and } from "drizzle-orm";
import { createRestaurantCouponSchema, validateData } from "../utils/validators.js";

// POST /api/restaurants/:id/coupons  (restaurant owner)
// Requires loadRestaurantOwner -> req.restaurant.
export async function createRestaurantCoupon(req, res) {
  try {
    if (req.params.id !== req.restaurant.id) {
      return res.status(403).json({ success: false, message: "You do not own this restaurant" });
    }

    const validation = validateData(createRestaurantCouponSchema, req.body);
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: "Validation failed", errors: validation.errors });
    }

    const d = validation.data;

    const [existing] = await db
      .select()
      .from(restaurantCoupons)
      .where(eq(restaurantCoupons.code, d.code))
      .limit(1);
    if (existing) {
      return res.status(409).json({ success: false, message: "Coupon code already exists" });
    }

    const [coupon] = await db
      .insert(restaurantCoupons)
      .values({
        restaurantId: req.restaurant.id,
        code: d.code,
        discountType: d.discountType,
        discountValue: d.discountValue.toFixed(2),
        minOrderValue: (d.minOrderValue ?? 0).toFixed(2),
        maxDiscount: (d.maxDiscount ?? 0).toFixed(2),
        validFrom: d.validFrom ? new Date(d.validFrom) : new Date(),
        validTo: new Date(d.validTo),
        timeSlots: d.timeSlots ?? [],
        usageLimit: String(d.usageLimit ?? 0),
      })
      .returning();

    return res.status(201).json({ success: true, data: coupon });
  } catch (error) {
    console.error("Create restaurant coupon error:", error);
    return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
  }
}

// GET /api/restaurants/:id/coupons — public list of a restaurant's active coupons.
export async function listRestaurantCoupons(req, res) {
  try {
    const rows = await db
      .select()
      .from(restaurantCoupons)
      .where(and(eq(restaurantCoupons.restaurantId, req.params.id), eq(restaurantCoupons.active, true)));
    return res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error("List restaurant coupons error:", error);
    return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
  }
}
