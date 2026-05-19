import { db } from "../db.js";
import { carts, cartItems, menuItems } from "../schema.js";
import { eq, and } from "drizzle-orm";
import {
  addCartItemSchema,
  updateCartItemSchema,
  validateData,
} from "../utils/validators.js";

async function getOrCreateCart(userId) {
  const existingCart = await db.select().from(carts).where(eq(carts.userId, userId)).limit(1);
  if (existingCart.length > 0) {
    return existingCart[0];
  }

  const [createdCart] = await db.insert(carts).values({ userId }).returning();
  return createdCart;
}

function calculateCartBreakdown(items) {
  const subtotal = items.reduce(
    (sum, item) => sum + Number(item.priceAtAdd) * Number(item.quantity),
    0,
  );

  const packagingFee = subtotal > 0 ? 20.0 : 0.0;
  const deliveryFee = subtotal > 0 ? 30.0 : 0.0;
  const taxAmount = Number(((subtotal + packagingFee + deliveryFee) * 0.05).toFixed(2));
  const discountAmount = 0.0;
  const totalAmount = Number((subtotal + packagingFee + deliveryFee + taxAmount - discountAmount).toFixed(2));

  return {
    subtotal,
    packagingFee,
    deliveryFee,
    taxAmount,
    discountAmount,
    totalAmount,
  };
}

export async function getCart(req, res) {
  try {
    const userId = req.user.id;
    const cart = await getOrCreateCart(userId);

    const rows = await db
      .select({ item: cartItems, menu: menuItems })
      .from(cartItems)
      .innerJoin(menuItems, eq(cartItems.menuItemId, menuItems.id))
      .where(eq(cartItems.cartId, cart.id));

    const items = rows.map(({ item, menu }) => ({
      id: item.id,
      menuItemId: item.menuItemId,
      name: menu.name,
      description: menu.description,
      category: menu.category,
      imageUrl: menu.imageUrl,
      isVeg: menu.isVeg,
      quantity: Number(item.quantity),
      priceAtAdd: Number(item.priceAtAdd),
      customizations: item.customizations || {},
      subtotal: Number(item.priceAtAdd) * Number(item.quantity),
    }));

    const summary = calculateCartBreakdown(items);

    return res.status(200).json({
      success: true,
      data: {
        cartId: cart.id,
        items,
        summary,
      },
    });
  } catch (error) {
    console.error("Get cart error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
}

export async function addCartItem(req, res) {
  try {
    const userId = req.user.id;
    const validation = validateData(addCartItemSchema, req.body);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validation.errors,
      });
    }

    const { menuItemId, quantity, customizations } = validation.data;
    const [menuItem] = await db
      .select()
      .from(menuItems)
      .where(eq(menuItems.id, menuItemId))
      .limit(1);

    if (!menuItem || !menuItem.isAvailable) {
      return res.status(404).json({
        success: false,
        message: "Menu item not available",
      });
    }

    const cart = await getOrCreateCart(userId);
    const [newItem] = await db
      .insert(cartItems)
      .values({
        cartId: cart.id,
        menuItemId,
        quantity,
        customizations: customizations || {},
        priceAtAdd: menuItem.price,
      })
      .returning();

    return res.status(201).json({
      success: true,
      message: "Item added to cart",
      data: newItem,
    });
  } catch (error) {
    console.error("Add cart item error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
}

export async function updateCartItem(req, res) {
  try {
    const userId = req.user.id;
    const { itemId } = req.params;
    const validation = validateData(updateCartItemSchema, req.body);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validation.errors,
      });
    }

    const cart = await getOrCreateCart(userId);
    const [existingItem] = await db
      .select()
      .from(cartItems)
      .where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cart.id)))
      .limit(1);

    if (!existingItem) {
      return res.status(404).json({
        success: false,
        message: "Cart item not found",
      });
    }

    const updateData = {
      updatedAt: new Date(),
    };

    if (validation.data.quantity !== undefined) {
      updateData.quantity = validation.data.quantity;
    }

    if (validation.data.customizations !== undefined) {
      updateData.customizations = validation.data.customizations;
    }

    const [updatedItem] = await db
      .update(cartItems)
      .set(updateData)
      .where(eq(cartItems.id, itemId))
      .returning();

    return res.status(200).json({
      success: true,
      message: "Cart item updated",
      data: updatedItem,
    });
  } catch (error) {
    console.error("Update cart item error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
}

export async function deleteCartItem(req, res) {
  try {
    const userId = req.user.id;
    const { itemId } = req.params;
    const cart = await getOrCreateCart(userId);

    const [existingItem] = await db
      .select()
      .from(cartItems)
      .where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cart.id)))
      .limit(1);

    if (!existingItem) {
      return res.status(404).json({
        success: false,
        message: "Cart item not found",
      });
    }

    await db.delete(cartItems).where(eq(cartItems.id, itemId));

    return res.status(200).json({
      success: true,
      message: "Cart item removed",
    });
  } catch (error) {
    console.error("Delete cart item error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
}
