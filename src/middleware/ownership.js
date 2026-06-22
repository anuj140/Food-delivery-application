import { db } from "../db.js";
import { restaurants, deliveryPartners } from "../schema.js";
import { eq } from "drizzle-orm";

// Resolves the restaurant owned by the authenticated user and attaches it as
// req.restaurant. Replaces the inline lookup repeated across restaurant controllers.
export async function loadRestaurantOwner(req, res, next) {
  try {
    const [restaurant] = await db
      .select()
      .from(restaurants)
      .where(eq(restaurants.userId, req.user.id))
      .limit(1);

    if (!restaurant) {
      return res.status(403).json({ success: false, message: "Restaurant profile not found" });
    }

    req.restaurant = restaurant;
    next();
  } catch (error) {
    console.error("loadRestaurantOwner error:", error);
    return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
  }
}

// Resolves the delivery partner row for the authenticated user -> req.partner.
export async function loadPartner(req, res, next) {
  try {
    const [partner] = await db
      .select()
      .from(deliveryPartners)
      .where(eq(deliveryPartners.userId, req.user.id))
      .limit(1);

    if (!partner) {
      return res.status(403).json({ success: false, message: "Delivery partner profile not found" });
    }

    req.partner = partner;
    next();
  } catch (error) {
    console.error("loadPartner error:", error);
    return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
  }
}

// For /restaurants/:id/... routes: ensures the :id param matches the owner's
// restaurant. Call after loadRestaurantOwner. Returns true if OK, else sends 403.
export function assertRestaurantMatch(req, res) {
  if (req.params.id !== req.restaurant.id) {
    res.status(403).json({ success: false, message: "You do not own this restaurant" });
    return false;
  }
  return true;
}
