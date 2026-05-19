import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  decimal,
  jsonb,
  index,
  uniqueIndex,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Enums
export const userRoleEnum = pgEnum("user_role", ["customer", "restaurant", "partner", "admin"]);
export const couponDiscountTypeEnum = pgEnum("coupon_discount_type", ["percentage", "fixed"]);
export const orderStatusEnum = pgEnum("order_status", [
  "pending_payment",
  "paid",
  "accepted",
  "preparing",
  "ready",
  "assigned",
  "completed",
  "cancelled",
]);
export const paymentStatusEnum = pgEnum("payment_status", ["pending", "success", "failed", "refunded"]);

// Users table
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    hashedPassword: varchar("hashed_password", { length: 255 }).notNull(),
    role: userRoleEnum("role").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => {
    return {
      emailIdx: uniqueIndex("users_email_idx").on(table.email),
      roleIdx: index("users_role_idx").on(table.role),
    };
  },
);

// Restaurants table
export const restaurants = pgTable(
  "restaurants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    address: text("address").notNull(),
    lat: decimal("lat", { precision: 10, scale: 8 }).notNull(),
    lng: decimal("lng", { precision: 11, scale: 8 }).notNull(),
    cuisineType: text("cuisine_type").array().notNull().default([]),
    isOpen: boolean("is_open").notNull().default(true),
    avgRating: decimal("avg_rating", { precision: 3, scale: 1 }).notNull().default("0"),
    commissionRate: decimal("commission_rate", { precision: 5, scale: 2 })
      .notNull()
      .default("18.00"),
    bankAccountDetails: jsonb("bank_account_details"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => {
    return {
      userIdIdx: index("restaurants_user_id_idx").on(table.userId),
      nameIdx: index("restaurants_name_idx").on(table.name),
      geoIdx: index("restaurants_geo_idx").on(table.lat, table.lng),
    };
  },
);

// Menu items table
export const menuItems = pgTable(
  "menu_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    price: decimal("price", { precision: 10, scale: 2 }).notNull(),
    category: varchar("category", { length: 100 }).notNull(),
    imageUrl: text("image_url"),
    isVeg: boolean("is_veg").notNull().default(true),
    isAvailable: boolean("is_available").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => {
    return {
      restaurantIdIdx: index("menu_items_restaurant_id_idx").on(table.restaurantId),
      categoryIdx: index("menu_items_category_idx").on(table.category),
      availabilityIdx: index("menu_items_availability_idx").on(table.isAvailable),
    };
  },
);

export const addresses = pgTable(
  "addresses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    label: varchar("label", { length: 100 }).notNull(),
    addressLine: text("address_line").notNull(),
    city: varchar("city", { length: 100 }).notNull(),
    pincode: varchar("pincode", { length: 20 }).notNull(),
    lat: decimal("lat", { precision: 10, scale: 8 }).notNull(),
    lng: decimal("lng", { precision: 11, scale: 8 }).notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index("addresses_user_id_idx").on(table.userId),
  }),
);

export const carts = pgTable(
  "carts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: uniqueIndex("carts_user_id_idx").on(table.userId),
  }),
);

export const cartItems = pgTable(
  "cart_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cartId: uuid("cart_id").notNull().references(() => carts.id, { onDelete: "cascade" }),
    menuItemId: uuid("menu_item_id").notNull().references(() => menuItems.id, { onDelete: "cascade" }),
    quantity: decimal("quantity", { precision: 10, scale: 0 }).notNull().default("1"),
    customizations: jsonb("customizations").notNull().default({}),
    priceAtAdd: decimal("price_at_add", { precision: 10, scale: 2 }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    cartIdIdx: index("cart_items_cart_id_idx").on(table.cartId),
    menuItemIdIdx: index("cart_items_menu_item_id_idx").on(table.menuItemId),
  }),
);

export const coupons = pgTable(
  "coupons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 50 }).notNull().unique(),
    discountType: couponDiscountTypeEnum("discount_type").notNull(),
    discountValue: decimal("discount_value", { precision: 10, scale: 2 }).notNull(),
    minOrderValue: decimal("min_order_value", { precision: 10, scale: 2 }).notNull().default("0"),
    maxDiscount: decimal("max_discount", { precision: 10, scale: 2 }).notNull().default("0"),
    validFrom: timestamp("valid_from").notNull().defaultNow(),
    validTo: timestamp("valid_to").notNull(),
    usageLimit: decimal("usage_limit", { precision: 10, scale: 0 }).notNull().default("1"),
    usedCount: decimal("used_count", { precision: 10, scale: 0 }).notNull().default("0"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    codeIdx: uniqueIndex("coupons_code_idx").on(table.code),
  }),
);

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    customerId: uuid("customer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    restaurantId: uuid("restaurant_id").notNull().references(() => restaurants.id, { onDelete: "cascade" }),
    addressId: uuid("address_id").notNull().references(() => addresses.id, { onDelete: "cascade" }),
    couponId: uuid("coupon_id").references(() => coupons.id),
    status: orderStatusEnum("status").notNull().default("pending_payment"),
    subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull().default("0"),
    deliveryFee: decimal("delivery_fee", { precision: 10, scale: 2 }).notNull().default("0"),
    packagingFee: decimal("packaging_fee", { precision: 10, scale: 2 }).notNull().default("0"),
    taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }).notNull().default("0"),
    discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }).notNull().default("0"),
    totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull().default("0"),
    scheduledTime: timestamp("scheduled_time"),
    specialInstructions: text("special_instructions"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    customerIdIdx: index("orders_customer_id_idx").on(table.customerId),
    restaurantIdIdx: index("orders_restaurant_id_idx").on(table.restaurantId),
    statusIdx: index("orders_status_idx").on(table.status),
  }),
);

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
    menuItemId: uuid("menu_item_id").notNull().references(() => menuItems.id, { onDelete: "cascade" }),
    nameSnapshot: varchar("name_snapshot", { length: 255 }).notNull(),
    priceSnapshot: decimal("price_snapshot", { precision: 10, scale: 2 }).notNull(),
    quantity: decimal("quantity", { precision: 10, scale: 0 }).notNull(),
    customizationsSnapshot: jsonb("customizations_snapshot").notNull().default({}),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    orderIdIdx: index("order_items_order_id_idx").on(table.orderId),
    menuItemIdIdx: index("order_items_menu_item_id_idx").on(table.menuItemId),
  }),
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
    gateway: varchar("gateway", { length: 50 }).notNull(),
    gatewayTxnId: varchar("gateway_txn_id", { length: 255 }).notNull(),
    amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
    method: varchar("method", { length: 50 }).notNull(),
    status: paymentStatusEnum("status").notNull().default("pending"),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    orderIdIdx: index("payments_order_id_idx").on(table.orderId),
    gatewayTxnIdIdx: uniqueIndex("payments_gateway_txn_id_idx").on(table.gatewayTxnId),
  }),
);

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  restaurant: one(restaurants, {
    fields: [users.id],
    references: [restaurants.userId],
  }),
  addresses: many(addresses),
  cart: one(carts, {
    fields: [users.id],
    references: [carts.userId],
  }),
}));

export const restaurantsRelations = relations(restaurants, ({ one, many }) => ({
  user: one(users, {
    fields: [restaurants.userId],
    references: [users.id],
  }),
  menuItems: many(menuItems),
  orders: many(orders),
}));

export const menuItemsRelations = relations(menuItems, ({ one, many }) => ({
  restaurant: one(restaurants, {
    fields: [menuItems.restaurantId],
    references: [restaurants.id],
  }),
  cartItems: many(cartItems),
  orderItems: many(orderItems),
}));

export const cartsRelations = relations(carts, ({ one, many }) => ({
  user: one(users, {
    fields: [carts.userId],
    references: [users.id],
  }),
  items: many(cartItems),
}));

export const cartItemsRelations = relations(cartItems, ({ one }) => ({
  cart: one(carts, {
    fields: [cartItems.cartId],
    references: [carts.id],
  }),
  menuItem: one(menuItems, {
    fields: [cartItems.menuItemId],
    references: [menuItems.id],
  }),
}));

export const addressesRelations = relations(addresses, ({ one }) => ({
  user: one(users, {
    fields: [addresses.userId],
    references: [users.id],
  }),
}));

export const couponsRelations = relations(coupons, ({ many }) => ({
  orders: many(orders),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  customer: one(users, {
    fields: [orders.customerId],
    references: [users.id],
  }),
  restaurant: one(restaurants, {
    fields: [orders.restaurantId],
    references: [restaurants.id],
  }),
  address: one(addresses, {
    fields: [orders.addressId],
    references: [addresses.id],
  }),
  coupon: one(coupons, {
    fields: [orders.couponId],
    references: [coupons.id],
  }),
  items: many(orderItems),
  payments: many(payments),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  menuItem: one(menuItems, {
    fields: [orderItems.menuItemId],
    references: [menuItems.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  order: one(orders, {
    fields: [payments.orderId],
    references: [orders.id],
  }),
}));

export const deliveryPartnerVehicleTypeEnum = pgEnum("delivery_partner_vehicle_type", ["bike", "scooter", "car"]);
export const deliveryAssignmentStatusEnum = pgEnum("delivery_assignment_status", [
  "assigned",
  "arrived_at_restaurant",
  "picked_up",
  "arrived_at_customer",
  "delivered",
]);
export const tipStatusEnum = pgEnum("tip_status", ["pending", "completed"]);

export const deliveryPartners = pgTable(
  "delivery_partners",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    vehicleType: deliveryPartnerVehicleTypeEnum("vehicle_type").notNull(),
    isOnline: boolean("is_online").notNull().default(false),
    currentLat: decimal("current_lat", { precision: 10, scale: 8 }),
    currentLng: decimal("current_lng", { precision: 11, scale: 8 }),
    lastLocationUpdate: timestamp("last_location_update"),
    rating: decimal("rating", { precision: 2, scale: 1 }).notNull().default("5.0"),
    totalDeliveries: decimal("total_deliveries", { precision: 10, scale: 0 }).notNull().default("0"),
    documents: jsonb("documents"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index("delivery_partners_user_id_idx").on(table.userId),
    geoIdx: index("delivery_partners_geo_idx").on(table.currentLat, table.currentLng),
  }),
);

export const deliveryAssignments = pgTable(
  "delivery_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    partnerId: uuid("partner_id")
      .notNull()
      .references(() => deliveryPartners.id, { onDelete: "cascade" }),
    sequence: decimal("sequence", { precision: 2, scale: 0 }).notNull().default("1"),
    status: deliveryAssignmentStatusEnum("status").notNull().default("assigned"),
    otpCode: varchar("otp_code", { length: 6 }),
    otpVerifiedAt: timestamp("otp_verified_at"),
    proofPhotoUrl: text("proof_photo_url"),
    partnerEarnings: decimal("partner_earnings", { precision: 10, scale: 2 }).notNull().default("0"),
    pickedUpAt: timestamp("picked_up_at"),
    deliveredAt: timestamp("delivered_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    orderIdIdx: index("delivery_assignments_order_id_idx").on(table.orderId),
    partnerIdIdx: index("delivery_assignments_partner_id_idx").on(table.partnerId),
    statusIdx: index("delivery_assignments_status_idx").on(table.status),
  }),
);

export const locationHistory = pgTable(
  "location_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assignmentId: uuid("assignment_id")
      .notNull()
      .references(() => deliveryAssignments.id, { onDelete: "cascade" }),
    lat: decimal("lat", { precision: 10, scale: 8 }).notNull(),
    lng: decimal("lng", { precision: 11, scale: 8 }).notNull(),
    recordedAt: timestamp("recorded_at").notNull().defaultNow(),
  },
  (table) => ({
    assignmentIdIdx: index("location_history_assignment_id_idx").on(table.assignmentId),
  }),
);

export const tips = pgTable(
  "tips",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    partnerId: uuid("partner_id")
      .notNull()
      .references(() => deliveryPartners.id, { onDelete: "cascade" }),
    amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
    status: tipStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    orderIdIdx: index("tips_order_id_idx").on(table.orderId),
    partnerIdIdx: index("tips_partner_id_idx").on(table.partnerId),
  }),
);

export const ratings = pgTable(
  "ratings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    foodRating: decimal("food_rating", { precision: 1, scale: 0 }).notNull(),
    deliveryRating: decimal("delivery_rating", { precision: 1, scale: 0 }).notNull(),
    reviewText: text("review_text"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    orderIdIdx: index("ratings_order_id_idx").on(table.orderId),
  }),
);

export const deliveryPartnersRelations = relations(deliveryPartners, ({ one, many }) => ({
  user: one(users, {
    fields: [deliveryPartners.userId],
    references: [users.id],
  }),
  assignments: many(deliveryAssignments),
}));

export const deliveryAssignmentsRelations = relations(deliveryAssignments, ({ one, many }) => ({
  order: one(orders, {
    fields: [deliveryAssignments.orderId],
    references: [orders.id],
  }),
  partner: one(deliveryPartners, {
    fields: [deliveryAssignments.partnerId],
    references: [deliveryPartners.id],
  }),
  locationHistory: many(locationHistory),
}));

export const locationHistoryRelations = relations(locationHistory, ({ one }) => ({
  assignment: one(deliveryAssignments, {
    fields: [locationHistory.assignmentId],
    references: [deliveryAssignments.id],
  }),
}));

export const tipsRelations = relations(tips, ({ one }) => ({
  order: one(orders, {
    fields: [tips.orderId],
    references: [orders.id],
  }),
  partner: one(deliveryPartners, {
    fields: [tips.partnerId],
    references: [deliveryPartners.id],
  }),
}));

export const ratingsRelations = relations(ratings, ({ one }) => ({
  order: one(orders, {
    fields: [ratings.orderId],
    references: [orders.id],
  }),
}));
