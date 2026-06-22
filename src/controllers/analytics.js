import { db } from "../db.js";
import { orders, orderItems } from "../schema.js";
import { eq, and, sql, desc } from "drizzle-orm";

// All handlers require loadRestaurantOwner -> req.restaurant.

// GET /api/restaurant/analytics/top-dishes — quantity & revenue leaderboard.
export async function topDishes(req, res) {
  try {
    const rows = await db
      .select({
        menuItemId: orderItems.menuItemId,
        name: orderItems.nameSnapshot,
        totalQuantity: sql`SUM(${orderItems.quantity})`,
        totalRevenue: sql`SUM(${orderItems.quantity} * ${orderItems.priceSnapshot})`,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .where(and(eq(orders.restaurantId, req.restaurant.id), eq(orders.status, "completed")))
      .groupBy(orderItems.menuItemId, orderItems.nameSnapshot)
      .orderBy(desc(sql`SUM(${orderItems.quantity})`))
      .limit(10);

    return res.status(200).json({
      success: true,
      data: rows.map((r) => ({
        menuItemId: r.menuItemId,
        name: r.name,
        totalQuantity: Number(r.totalQuantity),
        totalRevenue: Number(r.totalRevenue),
      })),
    });
  } catch (error) {
    console.error("Top dishes error:", error);
    return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
  }
}

// GET /api/restaurant/analytics/cancellation-rate — last 7 days.
export async function cancellationRate(req, res) {
  try {
    const [row] = await db
      .select({
        total: sql`COUNT(*)`,
        cancelled: sql`COUNT(*) FILTER (WHERE ${orders.status} = 'cancelled')`,
      })
      .from(orders)
      .where(
        and(
          eq(orders.restaurantId, req.restaurant.id),
          sql`${orders.createdAt} >= NOW() - INTERVAL '7 days'`,
        ),
      );

    const total = Number(row?.total || 0);
    const cancelled = Number(row?.cancelled || 0);
    const rate = total > 0 ? Math.round((cancelled / total) * 1000) / 10 : 0;

    return res.status(200).json({
      success: true,
      data: { windowDays: 7, totalOrders: total, cancelledOrders: cancelled, cancellationRatePct: rate },
    });
  } catch (error) {
    console.error("Cancellation rate error:", error);
    return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
  }
}

// GET /api/restaurant/analytics/peak-hours — heatmap data (hour × weekday).
export async function peakHours(req, res) {
  try {
    const rows = await db
      .select({
        weekday: sql`EXTRACT(DOW FROM ${orders.createdAt})`,
        hour: sql`EXTRACT(HOUR FROM ${orders.createdAt})`,
        orderCount: sql`COUNT(*)`,
      })
      .from(orders)
      .where(eq(orders.restaurantId, req.restaurant.id))
      .groupBy(sql`EXTRACT(DOW FROM ${orders.createdAt})`, sql`EXTRACT(HOUR FROM ${orders.createdAt})`);

    return res.status(200).json({
      success: true,
      data: rows.map((r) => ({
        weekday: Number(r.weekday), // 0 = Sunday
        hour: Number(r.hour),
        orderCount: Number(r.orderCount),
      })),
    });
  } catch (error) {
    console.error("Peak hours error:", error);
    return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
  }
}

// GET /api/restaurant/analytics/commission-breakdown — per-order platform fee.
export async function commissionBreakdown(req, res) {
  try {
    const commissionRate = Number(req.restaurant.commissionRate);
    const rows = await db
      .select({
        orderId: orders.id,
        totalAmount: orders.totalAmount,
        status: orders.status,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .where(and(eq(orders.restaurantId, req.restaurant.id), eq(orders.status, "completed")))
      .orderBy(desc(orders.createdAt))
      .limit(100);

    let totalCommission = 0;
    let totalNet = 0;
    const breakdown = rows.map((r) => {
      const gross = Number(r.totalAmount);
      const commission = Math.round(gross * commissionRate) / 100;
      const net = Math.round((gross - commission) * 100) / 100;
      totalCommission += commission;
      totalNet += net;
      return { orderId: r.orderId, gross, commission, net, createdAt: r.createdAt };
    });

    return res.status(200).json({
      success: true,
      data: {
        commissionRatePct: commissionRate,
        totalCommission: Math.round(totalCommission * 100) / 100,
        totalNet: Math.round(totalNet * 100) / 100,
        orders: breakdown,
      },
    });
  } catch (error) {
    console.error("Commission breakdown error:", error);
    return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
  }
}
