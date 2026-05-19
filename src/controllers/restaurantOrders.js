import { db } from "../db.js";
import { orders, restaurants, payments } from "../schema.js";
import { eq, and } from "drizzle-orm";
import { orderStatusUpdateSchema, validateData } from "../utils/validators.js";

export async function listRestaurantOrders(req, res) {
  try {
    const userId = req.user.id;
    const { status } = req.query;

    const [restaurant] = await db
      .select()
      .from(restaurants)
      .where(eq(restaurants.userId, userId))
      .limit(1);

    if (!restaurant) {
      return res.status(403).json({
        success: false,
        message: "Restaurant profile not found",
      });
    }
    

    let query = db.select().from(orders).where(eq(orders.restaurantId, restaurant.id));
    if (status) {
      query = query.where(eq(orders.status, status));
    }

    const ordersList = await query;
    return res.status(200).json({ success: true, data: ordersList });
  } catch (error) {
    console.error("List restaurant orders error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
}

export async function acceptOrder(req, res) {
  try {
    const userId = req.user.id;
    const { orderId } = req.params;

    const [restaurant] = await db
      .select()
      .from(restaurants)
      .where(eq(restaurants.userId, userId))
      .limit(1);

    if (!restaurant) {
      return res.status(403).json({
        success: false,
        message: "Restaurant profile not found",
      });
    }

    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!order || order.restaurantId !== restaurant.id) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (order.status !== "paid") {
      return res.status(400).json({
        success: false,
        message: "Only paid orders can be accepted",
      });
    }

    await db.update(orders).set({ status: "accepted", updatedAt: new Date() }).where(eq(orders.id, order.id));

    return res.status(200).json({
      success: true,
      message: "Order accepted",
    });
  } catch (error) {
    console.error("Accept order error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
}

export async function rejectOrder(req, res) {
  try {
    const userId = req.user.id;
    const { orderId } = req.params;
    const reason = req.body.reason || "No reason provided";

    const [restaurant] = await db
      .select()
      .from(restaurants)
      .where(eq(restaurants.userId, userId))
      .limit(1);

    if (!restaurant) {
      return res.status(403).json({
        success: false,
        message: "Restaurant profile not found",
      });
    }

    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!order || order.restaurantId !== restaurant.id) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (order.status !== "paid") {
      return res.status(400).json({
        success: false,
        message: "Only paid orders can be rejected",
      });
    }

    await db.update(orders).set({ status: "cancelled", updatedAt: new Date() }).where(eq(orders.id, order.id));
    await db
      .update(payments)
      .set({ status: "refunded", metadata: { reason }, updatedAt: new Date() })
      .where(eq(payments.orderId, order.id));

    return res.status(200).json({
      success: true,
      message: "Order rejected",
    });
  } catch (error) {
    console.error("Reject order error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
}

export async function updateOrderStatus(req, res) {
  try {
    const userId = req.user.id;
    const { orderId } = req.params;
    const validation = validateData(orderStatusUpdateSchema, req.body);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validation.errors,
      });
    }

    const { status } = validation.data;

    const [restaurant] = await db
      .select()
      .from(restaurants)
      .where(eq(restaurants.userId, userId))
      .limit(1);

    if (!restaurant) {
      return res.status(403).json({
        success: false,
        message: "Restaurant profile not found",
      });
    }

    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!order || order.restaurantId !== restaurant.id) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (order.status !== "accepted" && order.status !== "preparing") {
      return res.status(400).json({
        success: false,
        message: "Order must be accepted before status can be updated",
      });
    }

    const allowed = {
      preparing: ["accepted"],
      ready: ["preparing"],
    };

    if (!allowed[status].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot move order from ${order.status} to ${status}`,
      });
    }

    await db.update(orders).set({ status, updatedAt: new Date() }).where(eq(orders.id, order.id));

    return res.status(200).json({
      success: true,
      message: `Order status updated to ${status}`,
    });
  } catch (error) {
    console.error("Update order status error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
}
