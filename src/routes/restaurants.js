import express from "express";
import { authMiddleware, requireRole } from "../middleware/auth.js";
import { loadRestaurantOwner } from "../middleware/ownership.js";
import {
  createRestaurant,
  getRestaurantById,
  updateRestaurant,
  listRestaurants,
} from "../controllers/restaurants.js";
import { listRestaurantReviews, replyToReview } from "../controllers/reviews.js";
import { createRestaurantCoupon } from "../controllers/restaurantCoupons.js";
import { createCombo, listCombos } from "../controllers/combos.js";

const router = express.Router();

router.post("/", authMiddleware, createRestaurant);
router.get("/", listRestaurants);
router.get("/:id", getRestaurantById);
router.put("/:id", authMiddleware, updateRestaurant);

// Reviews (Stories 39/40/41/42)
router.get("/:id/reviews", listRestaurantReviews);
router.post(
  "/:id/reviews/:reviewId/reply",
  authMiddleware,
  requireRole("restaurant"),
  loadRestaurantOwner,
  replyToReview,
);

// Restaurant-funded coupons & combos (Stories 12/13/14)
router.post("/:id/coupons", authMiddleware, requireRole("restaurant"), loadRestaurantOwner, createRestaurantCoupon);
router.get("/:id/combos", listCombos);
router.post("/:id/combos", authMiddleware, requireRole("restaurant"), loadRestaurantOwner, createCombo);

export default router;
