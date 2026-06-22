import express from "express";
import { authMiddleware, requireRole } from "../middleware/auth.js";
import { getFleet, getFleetStats } from "../controllers/admin.js";
import {
  getDispute,
  resolveDispute,
  getPartnerAppeal,
  reinstatePartner,
  flagPartnerForRetraining,
  listFlaggedReviews,
  removeReview,
  listExpiringPromos,
  decideExpiringPromo,
} from "../controllers/disputes.js";

const router = express.Router();
router.use(authMiddleware, requireRole("admin"));

router.get("/fleet", getFleet);
router.get("/fleet/stats", getFleetStats);

// Dispute resolution (Story 17)
router.get("/disputes/:orderId", getDispute);
router.post("/disputes/:orderId/resolve", resolveDispute);

// Partner appeals / retraining (Stories 10/16)
router.get("/partner/:partnerId/appeal", getPartnerAppeal);
router.post("/partner/:partnerId/reinstate", reinstatePartner);
router.post("/partner/:partnerId/flag-for-retraining", flagPartnerForRetraining);

// Review moderation (Story 42)
router.get("/reviews", listFlaggedReviews);
router.delete("/reviews/:reviewId", removeReview);

// Expiring promos (Story 7)
router.get("/promos/expiring", listExpiringPromos);
router.post("/promos/:source/:couponId/decision", decideExpiringPromo);

export default router;
