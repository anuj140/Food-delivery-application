import express from "express";
import { authMiddleware, requireRole } from "../middleware/auth.js";
import { loadRestaurantOwner } from "../middleware/ownership.js";
import { listOwnRestaurantReviews } from "../controllers/reviews.js";
import {
  topDishes,
  cancellationRate,
  peakHours,
  commissionBreakdown,
} from "../controllers/analytics.js";

const router = express.Router();
router.use(authMiddleware, requireRole("restaurant"), loadRestaurantOwner);

// Reviews dashboard (Story 20)
router.get("/reviews", listOwnRestaurantReviews);

// Analytics (Stories 18/23/25/26)
router.get("/analytics/top-dishes", topDishes);
router.get("/analytics/cancellation-rate", cancellationRate);
router.get("/analytics/peak-hours", peakHours);
router.get("/analytics/commission-breakdown", commissionBreakdown);

export default router;
