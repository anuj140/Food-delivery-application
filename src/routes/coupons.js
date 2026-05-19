import express from "express";
import { authMiddleware, requireRole } from "../middleware/auth.js";
import { validateCoupon, listAvailableCoupons } from "../controllers/coupons.js";

const router = express.Router();
router.use(authMiddleware, requireRole("customer"));

router.post("/validate", validateCoupon);
router.get("/available", listAvailableCoupons); 

export default router;
