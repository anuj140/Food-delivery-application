import express from "express";
import { authMiddleware, requireRole } from "../middleware/auth.js";
import { listOffers } from "../controllers/offers.js";

const router = express.Router();

// Offers section — visible to authenticated customers (Story 48).
router.get("/", authMiddleware, requireRole("customer"), listOffers);

export default router;
