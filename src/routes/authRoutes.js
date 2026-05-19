import express from "express";
import { register, login, getProfile } from "../controllers/auth.js";
import { authMiddleware } from "../middleware/auth.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.get("/me", authMiddleware, getProfile);

export default router;
