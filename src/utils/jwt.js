import jwt from "jsonwebtoken";
import { config } from "../config.js";

export function generateToken(payload, expiresIn = config.jwtExpiresIn) {
  return jwt.sign(payload, config.jwtSecret, { expiresIn });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, config.jwtSecret);
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      throw new Error("Token has expired");
    }
    if (error.name === "JsonWebTokenError") {
      throw new Error("Invalid token");
    }
    throw error;
  }
}

export function decodeToken(token) {
  return jwt.decode(token);
}
