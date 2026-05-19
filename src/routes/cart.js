import express from "express";
import { authMiddleware, requireRole } from "../middleware/auth.js";
import {
  addCartItem,
  updateCartItem,
  deleteCartItem,
  getCart,
} from "../controllers/cart.js";

const router = express.Router();
router.use(authMiddleware, requireRole("customer"));

router.get("/", getCart);
router.post("/items", addCartItem);
router.put("/items/:itemId", updateCartItem);
router.delete("/items/:itemId", deleteCartItem);

export default router;
