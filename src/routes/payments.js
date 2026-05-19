import express from "express";
import { authMiddleware, requireRole } from "../middleware/auth.js";
import {
  initiatePayment,
  handlePaymentWebhook,
  getPaymentStatus,
} from "../controllers/payments.js";

const router = express.Router();

router.post("/webhook", handlePaymentWebhook);
router.use(authMiddleware, requireRole("customer"));
router.post("/initiate", initiatePayment);
router.get("/status/:orderId", getPaymentStatus);

export default router;
