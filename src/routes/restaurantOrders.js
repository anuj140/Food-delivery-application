import express from "express";
import { authMiddleware, requireRole } from "../middleware/auth.js";
import {
  listRestaurantOrders,
  acceptOrder,
  rejectOrder,
  updateOrderStatus,
} from "../controllers/restaurantOrders.js";

const router = express.Router();
router.use(authMiddleware, requireRole("restaurant"));

router.get("/", listRestaurantOrders);
router.patch("/:orderId/accept", acceptOrder);
router.patch("/:orderId/reject", rejectOrder);
router.patch("/:orderId/status", updateOrderStatus);

export default router;
