import "dotenv/config";

// Validation
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required");
}

export const config = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || "development",
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: "7d",
  corsOrigin: (process.env.CORS_ORIGIN || "http://localhost:3000").split(","),
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  },
  appName: process.env.APP_NAME || "FoodDeliveryBackend",
};

// Use common middleware such as cors, expressJson, urlencoded

// Global error handler middleware

// Define port 

// Listen on port number