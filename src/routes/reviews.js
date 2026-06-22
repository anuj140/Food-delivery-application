import express from "express";
import { authMiddleware, requireRole } from "../middleware/auth.js";
import { flagReview } from "../controllers/reviews.js";

const router = express.Router();

// Customer reports a fake/abusive review (Story 42)
router.post("/:reviewId/flag", authMiddleware, requireRole("customer"), flagReview);

export default router;
