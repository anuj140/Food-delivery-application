import express from "express";
import { authMiddleware, requireRole } from "../middleware/auth.js";
import { uploadArray } from "../middleware/upload.js";
import {
  createOrder,
  getOrder,
  cancelOrder,
  getOrderTracking,
  rateOrder,
  tipOrder,
  requestCallback,
} from "../controllers/orders.js";

const router = express.Router();
router.use(authMiddleware, requireRole("customer"));

router.post("/", createOrder);
router.get("/:orderId", getOrder);
router.get("/:orderId/tracking", getOrderTracking);
router.post("/:orderId/rate", uploadArray("photos", 3), rateOrder);
router.post("/:orderId/tip", tipOrder);
router.post("/:orderId/request-callback", requestCallback);
router.post("/:orderId/cancel", cancelOrder);

export default router;
