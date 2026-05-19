import express from "express";
import { authMiddleware, requireRole } from "../middleware/auth.js";
import {
  updatePartnerProfile,
  updatePartnerLocation,
  getAvailableOrders,
  acceptOrder,
  getActiveOrders,
  updateOrderStatus,
  uploadDeliveryProof,
  verifyOtp,
} from "../controllers/partners.js";

const router = express.Router();
router.use(authMiddleware, requireRole("partner"));

router.post("/profile", updatePartnerProfile); // ✅
router.post("/location", updatePartnerLocation); // ✅
router.get("/available-orders", getAvailableOrders); // ✅
router.post("/orders/:orderId/accept", acceptOrder); // ✅
router.get("/active-orders", getActiveOrders); // ✅
router.patch("/orders/:orderId/status", updateOrderStatus); //✅
router.post("/orders/:orderId/proof", uploadDeliveryProof); // ✅
router.post("/orders/:orderId/otp-verify", verifyOtp);

export default router;
