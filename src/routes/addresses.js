import express from "express";
import { authMiddleware, requireRole } from "../middleware/auth.js";
import {
  addAddress,
  listAddresses,
  updateAddress,
  deleteAddress,
} from "../controllers/addresses.js";

const router = express.Router();
router.use(authMiddleware, requireRole("customer"));

router.post("/", addAddress);
router.get("/", listAddresses);
router.put("/:id", updateAddress);
router.delete("/:id", deleteAddress);

export default router;
