import express from "express";
import { authMiddleware, requireRole } from "../middleware/auth.js";
import { getBalance, redeemPoints } from "../controllers/loyalty.js";

const router = express.Router();
router.use(authMiddleware, requireRole("customer"));

router.get("/balance", getBalance);
router.post("/redeem", redeemPoints);

export default router;
