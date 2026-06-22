import { db } from "../db.js";
import { combos, menuItems } from "../schema.js";
import { eq, and, inArray } from "drizzle-orm";
import { createComboSchema, validateData } from "../utils/validators.js";

// POST /api/restaurants/:id/combos  (restaurant owner)
// Requires loadRestaurantOwner -> req.restaurant.
export async function createCombo(req, res) {
  try {
    if (req.params.id !== req.restaurant.id) {
      return res.status(403).json({ success: false, message: "You do not own this restaurant" });
    }

    const validation = validateData(createComboSchema, req.body);
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: "Validation failed", errors: validation.errors });
    }

    const { name, comboPrice, items } = validation.data;

    // Ensure every referenced menu item belongs to this restaurant.
    const ids = items.map((i) => i.menuItemId);
    const found = await db
      .select({ id: menuItems.id })
      .from(menuItems)
      .where(and(inArray(menuItems.id, ids), eq(menuItems.restaurantId, req.restaurant.id)));
    if (found.length !== new Set(ids).size) {
      return res.status(400).json({ success: false, message: "All combo items must belong to your restaurant" });
    }

    const [combo] = await db
      .insert(combos)
      .values({
        restaurantId: req.restaurant.id,
        name,
        comboPrice: comboPrice.toFixed(2),
        items,
      })
      .returning();

    return res.status(201).json({ success: true, data: combo });
  } catch (error) {
    console.error("Create combo error:", error);
    return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
  }
}

// GET /api/restaurants/:id/combos — public list of active combos.
export async function listCombos(req, res) {
  try {
    const rows = await db
      .select()
      .from(combos)
      .where(and(eq(combos.restaurantId, req.params.id), eq(combos.isActive, true)));
    return res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error("List combos error:", error);
    return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
  }
}
