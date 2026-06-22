import express from "express";
import { authMiddleware, requireRole } from "../middleware/auth.js";
import { loadPartner } from "../middleware/ownership.js";
import { uploadSingle } from "../middleware/upload.js";
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
import { listPartnerReviews } from "../controllers/reviews.js";
import { selfieVerify, thermalBagPhoto, shiftRequirements } from "../controllers/compliance.js";

const router = express.Router();
router.use(authMiddleware, requireRole("partner"));

router.post("/profile", updatePartnerProfile); // ✅
router.post("/location", updatePartnerLocation); // ✅
router.get("/available-orders", getAvailableOrders); // ✅
router.post("/orders/:orderId/accept", acceptOrder); // ✅
router.get("/active-orders", getActiveOrders); // ✅
router.patch("/orders/:orderId/status", updateOrderStatus); //✅
router.post("/orders/:orderId/proof", uploadSingle("photo"), uploadDeliveryProof); // ✅
router.post("/orders/:orderId/otp-verify", verifyOtp);

// MVP 4 — partner reviews (Stories 22/23) & compliance (Stories 11/16)
router.get("/reviews", loadPartner, listPartnerReviews);
router.post("/selfie-verify", loadPartner, uploadSingle("photo"), selfieVerify);
router.post("/thermal-bag-photo", loadPartner, uploadSingle("photo"), thermalBagPhoto);
router.get("/shift-requirements", loadPartner, shiftRequirements);

export default router;
