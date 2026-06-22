import { db } from "../db.js";
import {
  disputes,
  orders,
  deliveryAssignments,
  deliveryPartners,
  locationHistory,
  ratings,
  coupons,
  restaurantCoupons,
  users,
} from "../schema.js";
import { eq, and, desc, lte } from "drizzle-orm";
import { resolveDisputeSchema, validateData } from "../utils/validators.js";

// GET /api/admin/disputes/:orderId — GPS trail + proof photo + dispute notes (Story 17).
export async function getDispute(req, res) {
  try {
    const { orderId } = req.params;

    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const [assignment] = await db
      .select()
      .from(deliveryAssignments)
      .where(eq(deliveryAssignments.orderId, orderId))
      .limit(1);

    const gpsTrail = assignment
      ? await db
          .select()
          .from(locationHistory)
          .where(eq(locationHistory.assignmentId, assignment.id))
          .orderBy(locationHistory.recordedAt)
      : [];

    const [dispute] = await db.select().from(disputes).where(eq(disputes.orderId, orderId)).limit(1);

    return res.status(200).json({
      success: true,
      data: {
        order,
        dispute: dispute || null,
        proofPhotoUrl: assignment?.proofPhotoUrl || null,
        otpVerifiedAt: assignment?.otpVerifiedAt || null,
        deliveredAt: assignment?.deliveredAt || null,
        gpsTrail,
      },
    });
  } catch (error) {
    console.error("Get dispute error:", error);
    return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
  }
}

// POST /api/admin/disputes/:orderId/resolve — decide in favour of customer/partner.
export async function resolveDispute(req, res) {
  try {
    const { orderId } = req.params;
    const validation = validateData(resolveDisputeSchema, req.body);
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: "Validation failed", errors: validation.errors });
    }

    const { status, adminNotes } = validation.data;

    const [existing] = await db.select().from(disputes).where(eq(disputes.orderId, orderId)).limit(1);

    let dispute;
    if (existing) {
      [dispute] = await db
        .update(disputes)
        .set({ status, adminNotes: adminNotes || null, resolvedAt: new Date(), updatedAt: new Date() })
        .where(eq(disputes.id, existing.id))
        .returning();
    } else {
      // Allow resolving a "not delivered" claim even if no dispute row was opened yet.
      [dispute] = await db
        .insert(disputes)
        .values({
          orderId,
          raisedBy: "customer",
          reason: "not_delivered_claim",
          status,
          adminNotes: adminNotes || null,
          resolvedAt: new Date(),
        })
        .returning();
    }

    return res.status(200).json({ success: true, message: "Dispute resolved", data: dispute });
  } catch (error) {
    console.error("Resolve dispute error:", error);
    return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
  }
}

// GET /api/admin/partner/:partnerId/appeal — deactivation history & ratings (Story 10).
export async function getPartnerAppeal(req, res) {
  try {
    const { partnerId } = req.params;
    const [partner] = await db
      .select({ partner: deliveryPartners, email: users.email })
      .from(deliveryPartners)
      .leftJoin(users, eq(users.id, deliveryPartners.userId))
      .where(eq(deliveryPartners.id, partnerId))
      .limit(1);

    if (!partner) {
      return res.status(404).json({ success: false, message: "Partner not found" });
    }

    const recentRatings = await db
      .select({
        deliveryRating: ratings.deliveryRating,
        reviewText: ratings.reviewText,
        createdAt: ratings.createdAt,
      })
      .from(ratings)
      .innerJoin(deliveryAssignments, eq(deliveryAssignments.orderId, ratings.orderId))
      .where(eq(deliveryAssignments.partnerId, partnerId))
      .orderBy(desc(ratings.createdAt))
      .limit(20);

    return res.status(200).json({
      success: true,
      data: {
        partner: partner.partner,
        email: partner.email,
        flaggedForRetraining: partner.partner.documents?.flaggedForRetraining || false,
        recentRatings,
      },
    });
  } catch (error) {
    console.error("Get partner appeal error:", error);
    return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
  }
}

// POST /api/admin/partner/:partnerId/reinstate — manual override after appeal.
export async function reinstatePartner(req, res) {
  try {
    const { partnerId } = req.params;
    const [partner] = await db.select().from(deliveryPartners).where(eq(deliveryPartners.id, partnerId)).limit(1);
    if (!partner) {
      return res.status(404).json({ success: false, message: "Partner not found" });
    }

    const documents = { ...(partner.documents || {}), flaggedForRetraining: false, deactivated: false };
    await db
      .update(deliveryPartners)
      .set({ documents, updatedAt: new Date() })
      .where(eq(deliveryPartners.id, partnerId));

    return res.status(200).json({ success: true, message: "Partner reinstated" });
  } catch (error) {
    console.error("Reinstate partner error:", error);
    return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
  }
}

// POST /api/admin/partner/:partnerId/flag-for-retraining — quality action (Story 16).
export async function flagPartnerForRetraining(req, res) {
  try {
    const { partnerId } = req.params;
    const [partner] = await db.select().from(deliveryPartners).where(eq(deliveryPartners.id, partnerId)).limit(1);
    if (!partner) {
      return res.status(404).json({ success: false, message: "Partner not found" });
    }

    if (Number(partner.rating) >= 4.0) {
      return res.status(400).json({
        success: false,
        message: "Partner rating is 4.0 or above; retraining flag not applicable",
      });
    }

    const documents = { ...(partner.documents || {}), flaggedForRetraining: true };
    await db
      .update(deliveryPartners)
      .set({ documents, updatedAt: new Date() })
      .where(eq(deliveryPartners.id, partnerId));

    return res.status(200).json({ success: true, message: "Partner flagged for retraining" });
  } catch (error) {
    console.error("Flag partner for retraining error:", error);
    return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
  }
}

// GET /api/admin/reviews?flagged=true — moderation queue.
export async function listFlaggedReviews(req, res) {
  try {
    const onlyFlagged = req.query.flagged !== "false";
    const rows = await db
      .select()
      .from(ratings)
      .where(onlyFlagged ? eq(ratings.isFlagged, true) : undefined)
      .orderBy(desc(ratings.createdAt));
    return res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error("List flagged reviews error:", error);
    return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
  }
}

// DELETE /api/admin/reviews/:reviewId — remove an abusive/fake review (Story 42 admin side).
export async function removeReview(req, res) {
  try {
    const { reviewId } = req.params;
    const deleted = await db.delete(ratings).where(eq(ratings.id, reviewId)).returning();
    if (deleted.length === 0) {
      return res.status(404).json({ success: false, message: "Review not found" });
    }
    return res.status(200).json({ success: true, message: "Review removed" });
  } catch (error) {
    console.error("Remove review error:", error);
    return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
  }
}

// GET /api/admin/promos/expiring — promos expiring within N days (Story 7).
export async function listExpiringPromos(req, res) {
  try {
    const days = Math.max(1, parseInt(req.query.days, 10) || 7);
    const horizon = new Date();
    horizon.setDate(horizon.getDate() + days);

    const platform = await db
      .select()
      .from(coupons)
      .where(and(eq(coupons.active, true), lte(coupons.validTo, horizon)));

    const restaurant = await db
      .select()
      .from(restaurantCoupons)
      .where(and(eq(restaurantCoupons.active, true), lte(restaurantCoupons.validTo, horizon)));

    return res.status(200).json({
      success: true,
      data: {
        windowDays: days,
        platform: platform.map((c) => ({ source: "platform", ...c })),
        restaurant: restaurant.map((c) => ({ source: "restaurant", ...c })),
      },
    });
  } catch (error) {
    console.error("List expiring promos error:", error);
    return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
  }
}

// POST /api/admin/promos/:source/:couponId/decision { action: "extend"|"end", validTo? }
export async function decideExpiringPromo(req, res) {
  try {
    const { source, couponId } = req.params;
    const { action, validTo } = req.body;
    const table = source === "restaurant" ? restaurantCoupons : coupons;

    if (action === "end") {
      await db.update(table).set({ active: false, updatedAt: new Date() }).where(eq(table.id, couponId));
      return res.status(200).json({ success: true, message: "Promo ended" });
    }

    if (action === "extend") {
      if (!validTo) {
        return res.status(400).json({ success: false, message: "validTo is required to extend" });
      }
      await db
        .update(table)
        .set({ validTo: new Date(validTo), active: true, updatedAt: new Date() })
        .where(eq(table.id, couponId));
      return res.status(200).json({ success: true, message: "Promo extended" });
    }

    return res.status(400).json({ success: false, message: "action must be 'extend' or 'end'" });
  } catch (error) {
    console.error("Decide expiring promo error:", error);
    return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
  }
}
