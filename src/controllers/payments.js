import { db } from "../db.js";
import { payments, orders } from "../schema.js";
import { eq, and } from "drizzle-orm";
import { paymentInitiationSchema, validateData } from "../utils/validators.js";

export async function initiatePayment(req, res) {
  try {
    const userId = req.user.id;
    const validation = validateData(paymentInitiationSchema, req.body);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validation.errors,
      });
    }

    const { orderId, gateway, method } = validation.data;
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);

    if (!order || order.customerId !== userId) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (order.status === "cancelled" || order.status === "completed") {
      return res.status(400).json({
        success: false,
        message: "Cannot initiate payment for this order",
      });
    }

    const transactionId = `pay_${Date.now()}_${order.id}`;
    const [createdPayment] = await db
      .insert(payments)
      .values({
        orderId: order.id,
        gateway,
        gatewayTxnId: transactionId,
        amount: order.totalAmount,
        method,
        status: method === "cod" ? "success" : "pending",
        metadata: {},
      })
      .returning();

    if (method === "cod") {
      await db.update(orders).set({ status: "paid", updatedAt: new Date() }).where(eq(orders.id, order.id));
    }

    return res.status(201).json({
      success: true,
      message: "Payment initiated",
      data: {
        payment: createdPayment,
        paymentIntent: {
          id: transactionId,
          amount: Number(order.totalAmount),
          currency: "INR",
          gateway,
          method,
          status: createdPayment.status,
        },
      },
    });
  } catch (error) {
    console.error("Initiate payment error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
}

export async function handlePaymentWebhook(req, res) {
  try {
    const { orderId, gatewayTxnId, status, metadata } = req.body;
    if (!orderId || !gatewayTxnId || !status) {
      return res.status(400).json({
        success: false,
        message: "Missing required webhook payload",
      });
    }

    const [existingPayment] = await db
      .select()
      .from(payments)
      .where(eq(payments.gatewayTxnId, gatewayTxnId))
      .limit(1);

    if (existingPayment) {
      if (existingPayment.status === status) {
        return res.status(200).json({ success: true, message: "Webhook already processed" });
      }

      await db
        .update(payments)
        .set({ status, metadata: metadata || existingPayment.metadata })
        .where(eq(payments.id, existingPayment.id));
    } else {
      await db.insert(payments).values({
        orderId,
        gateway: "unknown",
        gatewayTxnId,
        amount: 0,
        method: "unknown",
        status,
        metadata: metadata || {},
      });
    }

    if (status === "success") {
      await db.update(orders).set({ status: "paid", updatedAt: new Date() }).where(eq(orders.id, orderId));
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Payment webhook error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
}

export async function getPaymentStatus(req, res) {
  try {
    const userId = req.user.id;
    const { orderId } = req.params;

    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!order || order.customerId !== userId) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const paymentRecords = await db.select().from(payments).where(eq(payments.orderId, orderId));
    return res.status(200).json({
      success: true,
      data: {
        orderStatus: order.status,
        payments: paymentRecords,
      },
    });
  } catch (error) {
    console.error("Get payment status error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
}
