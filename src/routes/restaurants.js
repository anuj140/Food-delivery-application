import express from "express";
import { authMiddleware } from "../middleware/auth.js";
import {
  createRestaurant,
  getRestaurantById,
  updateRestaurant,
  listRestaurants,
} from "../controllers/restaurants.js";

const router = express.Router();

router.post("/", authMiddleware, createRestaurant);
router.get("/", listRestaurants);
router.get("/:id", getRestaurantById);
router.put("/:id", authMiddleware, updateRestaurant);

export default router;
