// @ts-nocheck
import express from "express";
import cors from "cors";
import "dotenv/config";
import { config } from "./config.js";
import { initializeDatabase, disconnectDatabase } from "./db.js";
import authRoutes from "./routes/authRoutes.js";
import restaurantRoutes from "./routes/restaurants.js";
import menuRoutes from "./routes/menu.js";
import cartRoutes from "./routes/cart.js";
import addressRoutes from "./routes/addresses.js";
import couponRoutes from "./routes/coupons.js";
import orderRoutes from "./routes/orders.js";
import paymentRoutes from "./routes/payments.js";
import restaurantOrderRoutes from "./routes/restaurantOrders.js";
import partnerRoutes from "./routes/partnerRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import reviewRoutes from "./routes/reviews.js";
import loyaltyRoutes from "./routes/loyalty.js";
import offerRoutes from "./routes/offers.js";
import restaurantDashboardRoutes from "./routes/restaurantDashboard.js";

const app = express();

app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/auth", authRoutes);
app.use("/auth", authRoutes);
app.use("/api/restaurants", restaurantRoutes);
app.use("/api/menu", menuRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/addresses", addressRoutes);
app.use("/api/coupons", couponRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/partner", partnerRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/restaurant/orders", restaurantOrderRoutes);
app.use("/api/restaurant", restaurantDashboardRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/loyalty", loyaltyRoutes);
app.use("/api/offers", offerRoutes);

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: `${config.appName} is running`,
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({
    success: false,
    message: "Internal server error",
    error: err.message,
  });
});

const port = config.port || 3000;

initializeDatabase().then(() => {
  app.listen(port, () => {
    console.log(`${config.appName} listening on port ${port}`);
  });
});

process.on("SIGINT", async () => {
  await disconnectDatabase();
  process.exit(0);
});
