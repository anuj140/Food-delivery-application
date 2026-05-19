import { db } from "../db.js";
import { deliveryPartners, users } from "../schema.js";
import { eq } from "drizzle-orm";
import { hashPassword, comparePasswords } from "../utils/hash.js";
import { generateToken } from "../utils/jwt.js";
import { registerSchema, loginSchema, validateData } from "../utils/validators.js";

export async function register(req, res) {
  try {
    // Validate input
    const validation = validateData(registerSchema, req.body);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validation.errors,
      });
    }

    const { email, password, role, vehicleType } = validation.data;

    // Check if user already exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUser.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Email already registered",
      });
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user
    const newUser = await db
      .insert(users)
      .values({
        email,
        hashedPassword,
        role,
      })
      .returning();

    const user = newUser[0];

    if (role === "partner") {
      await db.insert(deliveryPartners).values({
        userId: user.id,
        vehicleType,
        isOnline: false,
        documents: {},
      });
    }

    // Generate token
    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
        token,
      },
    });
  } catch (error) {
    console.error("Register error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
}

export async function login(req, res) {
  try {
    // Validate input
    const validation = validateData(loginSchema, req.body);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validation.errors,
      });
    }

    const { email, password } = validation.data;

    // Find user
    const foundUsers = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (foundUsers.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const user = foundUsers[0];

    // Compare passwords
    const isPasswordValid = await comparePasswords(password, user.hashedPassword);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Generate token
    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
        token,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
}

export async function getProfile(req, res) {
  try {
    const userId = req.user.id;

    const foundUsers = await db.select().from(users).where(eq(users.id, userId)).limit(1);

    if (foundUsers.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const user = foundUsers[0];

    return res.status(200).json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error("Get profile error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
}
