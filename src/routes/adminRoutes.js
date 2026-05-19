import express from "express";
import { authMiddleware, requireRole } from "../middleware/auth.js";
import { getFleet, getFleetStats } from "../controllers/admin.js";

const router = express.Router();
router.use(authMiddleware, requireRole("admin"));

router.get("/fleet", getFleet);
router.get("/fleet/stats", getFleetStats);

export default router;
