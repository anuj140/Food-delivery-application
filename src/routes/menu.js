import express from "express";
import { authMiddleware } from "../middleware/auth.js";
import {
  createMenuItem,
  updateMenuItem,
  updateMenuItemAvailability,
  deleteMenuItem,
  getRestaurantMenu,
} from "../controllers/menu.js";

const router = express.Router();

router.get("/restaurant/:id", getRestaurantMenu);
router.post("/restaurant/:restoId", authMiddleware, createMenuItem);
router.put("/item/:dishId", authMiddleware, updateMenuItem);
router.patch("/item/:dishId/availability", authMiddleware, updateMenuItemAvailability);
router.delete("/item/:dishId", authMiddleware, deleteMenuItem);

export default router;
