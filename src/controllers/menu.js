import { db } from "../db.js";
import { menuItems, restaurants } from "../schema.js";
import { eq, and } from "drizzle-orm";
import {
  createMenuItemSchema,
  updateMenuItemSchema,
  updateMenuItemAvailabilitySchema,
  validateData,
} from "../utils/validators.js";

export async function createMenuItem(req, res) {
  try {
    const { restoId } = req.params;
    const userId = req.user.id;

    // Validate ownership
    const foundRestaurants = await db
      .select()
      .from(restaurants)
      .where(and(eq(restaurants.id, restoId), eq(restaurants.userId, userId)))
      .limit(1);

    if (foundRestaurants.length === 0) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to add items to this restaurant",
      });
    }

    // Validate input
    const validation = validateData(createMenuItemSchema, req.body);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validation.errors,
      });
    }

    const { name, description, price, category, imageUrl, isVeg } = validation.data;

    // Create menu item
    const newMenuItem = await db
      .insert(menuItems)
      .values({
        restaurantId: restoId,
        name,
        description: description || null,
        price: price.toString(),
        category,
        imageUrl: imageUrl || null,
        isVeg,
      })
      .returning();

    return res.status(201).json({
      success: true,
      message: "Menu item created successfully",
      data: newMenuItem[0],
    });
  } catch (error) {
    console.error("Create menu item error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
}

export async function updateMenuItem(req, res) {
  try {
    const { dishId } = req.params;
    const userId = req.user.id;

    // Get menu item and verify ownership
    const foundItems = await db
      .select()
      .from(menuItems)
      .innerJoin(restaurants, eq(menuItems.restaurantId, restaurants.id))
      .where(and(eq(menuItems.id, dishId), eq(restaurants.userId, userId)))
      .limit(1);

    if (foundItems.length === 0) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this menu item",
      });
    }

    // Validate input
    const validation = validateData(updateMenuItemSchema, req.body);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validation.errors,
      });
    }

    const updateData = {};
    const data = validation.data;

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.price !== undefined) updateData.price = data.price.toString();
    if (data.category !== undefined) updateData.category = data.category;
    if (data.imageUrl !== undefined) updateData.imageUrl = data.imageUrl;
    if (data.isVeg !== undefined) updateData.isVeg = data.isVeg;
    updateData.updatedAt = new Date();

    const updatedMenuItem = await db
      .update(menuItems)
      .set(updateData)
      .where(eq(menuItems.id, dishId))
      .returning();

    return res.status(200).json({
      success: true,
      message: "Menu item updated successfully",
      data: updatedMenuItem[0],
    });
  } catch (error) {
    console.error("Update menu item error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
}

export async function updateMenuItemAvailability(req, res) {
  try {
    const { dishId } = req.params;
    const userId = req.user.id;

    // Get menu item and verify ownership
    const foundItems = await db
      .select()
      .from(menuItems)
      .innerJoin(restaurants, eq(menuItems.restaurantId, restaurants.id))
      .where(and(eq(menuItems.id, dishId), eq(restaurants.userId, userId)))
      .limit(1);

    if (foundItems.length === 0) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this menu item",
      });
    }

    // Validate input
    const validation = validateData(updateMenuItemAvailabilitySchema, req.body);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validation.errors,
      });
    }

    const { isAvailable } = validation.data;

    const updatedMenuItem = await db
      .update(menuItems)
      .set({ isAvailable, updatedAt: new Date() })
      .where(eq(menuItems.id, dishId))
      .returning();

    return res.status(200).json({
      success: true,
      message: "Menu item availability updated",
      data: updatedMenuItem[0],
    });
  } catch (error) {
    console.error("Update availability error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
}

export async function deleteMenuItem(req, res) {
  try {
    const { dishId } = req.params;
    const userId = req.user.id;

    // Get menu item and verify ownership
    const foundItems = await db
      .select()
      .from(menuItems)
      .innerJoin(restaurants, eq(menuItems.restaurantId, restaurants.id))
      .where(and(eq(menuItems.id, dishId), eq(restaurants.userId, userId)))
      .limit(1);

    if (foundItems.length === 0) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete this menu item",
      });
    }

    // Soft delete
    const deletedMenuItem = await db
      .update(menuItems)
      .set({ isAvailable: false, updatedAt: new Date() })
      .where(eq(menuItems.id, dishId))
      .returning();

    return res.status(200).json({
      success: true,
      message: "Menu item deleted successfully",
      data: deletedMenuItem[0],
    });
  } catch (error) {
    console.error("Delete menu item error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
}

export async function getRestaurantMenu(req, res) {
  try {
    const { id } = req.params;

    // Verify restaurant exists
    const foundRestaurants = await db
      .select()
      .from(restaurants)
      .where(eq(restaurants.id, id))
      .limit(1);

    if (foundRestaurants.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Restaurant not found",
      });
    }

    // Get available menu items only
    const items = await db
      .select()
      .from(menuItems)
      .where(and(eq(menuItems.restaurantId, id), eq(menuItems.isAvailable, true)));

    return res.status(200).json({
      success: true,
      data: {
        restaurantId: id,
        items,
      },
    });
  } catch (error) {
    console.error("Get restaurant menu error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
}
