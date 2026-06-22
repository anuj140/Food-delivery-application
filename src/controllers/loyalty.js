import { db } from "../db.js";
import { loyaltyPoints, loyaltyTransactions } from "../schema.js";
import { eq } from "drizzle-orm";
import { redeemLoyaltySchema, validateData } from "../utils/validators.js";

const EARN_RATE_RUPEES_PER_POINT = 100; // 1 point per ₹100 spent
const REDEEM_VALUE_PER_POINT = 1; // 1 point = ₹1 discount

// Ensures a loyalty_points row exists for the customer and returns it.
async function getOrCreateBalance(customerId) {
  const [existing] = await db
    .select()
    .from(loyaltyPoints)
    .where(eq(loyaltyPoints.customerId, customerId))
    .limit(1);
  if (existing) return existing;
  const [created] = await db.insert(loyaltyPoints).values({ customerId }).returning();
  return created;
}

// Internal helper: award points after an order completes (Story 50).
// Called from the order-completion path (controllers/partners.js).
export async function earnPoints(customerId, orderId, orderAmount) {
  if (!customerId || !orderAmount) return;
  const points = Math.floor(Number(orderAmount) / EARN_RATE_RUPEES_PER_POINT);
  if (points <= 0) return;

  const balanceRow = await getOrCreateBalance(customerId);
  await db
    .update(loyaltyPoints)
    .set({
      balance: String(Number(balanceRow.balance) + points),
      totalEarned: String(Number(balanceRow.totalEarned) + points),
      updatedAt: new Date(),
    })
    .where(eq(loyaltyPoints.customerId, customerId));

  await db.insert(loyaltyTransactions).values({
    customerId,
    orderId,
    points: String(points),
    reason: "order_completed",
  });
}

// GET /api/loyalty/balance
export async function getBalance(req, res) {
  try {
    const balance = await getOrCreateBalance(req.user.id);
    return res.status(200).json({
      success: true,
      data: {
        balance: Number(balance.balance),
        totalEarned: Number(balance.totalEarned),
        totalRedeemed: Number(balance.totalRedeemed),
        pointValue: REDEEM_VALUE_PER_POINT,
      },
    });
  } catch (error) {
    console.error("Get loyalty balance error:", error);
    return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
  }
}

// POST /api/loyalty/redeem — convert points into a rupee discount.
export async function redeemPoints(req, res) {
  try {
    const validation = validateData(redeemLoyaltySchema, req.body);
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: "Validation failed", errors: validation.errors });
    }

    const { points } = validation.data;
    const balanceRow = await getOrCreateBalance(req.user.id);
    if (points > Number(balanceRow.balance)) {
      return res.status(400).json({ success: false, message: "Insufficient loyalty points" });
    }

    await db
      .update(loyaltyPoints)
      .set({
        balance: String(Number(balanceRow.balance) - points),
        totalRedeemed: String(Number(balanceRow.totalRedeemed) + points),
        updatedAt: new Date(),
      })
      .where(eq(loyaltyPoints.customerId, req.user.id));

    await db.insert(loyaltyTransactions).values({
      customerId: req.user.id,
      points: String(-points),
      reason: "redeemed_for_discount",
    });

    return res.status(200).json({
      success: true,
      message: "Points redeemed",
      data: {
        pointsRedeemed: points,
        discountAmount: points * REDEEM_VALUE_PER_POINT,
        remainingBalance: Number(balanceRow.balance) - points,
      },
    });
  } catch (error) {
    console.error("Redeem loyalty points error:", error);
    return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
  }
}
