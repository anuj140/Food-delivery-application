// @ts-nocheck
import { z } from "zod";

// Auth validators
export const registerSchema = z
  .object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    role: z.enum(["customer", "restaurant", "partner", "admin"]),
    vehicleType: z.enum(["bike", "scooter", "car"]).optional(),
  })
  .refine((data) => data.role !== "partner" || !!data.vehicleType, {
    message: "Vehicle type is required when registering as a partner",
    path: ["vehicleType"],
  });

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const addCartItemSchema = z.object({
  menuItemId: z.string().uuid("Invalid menu item ID"),
  quantity: z.number().int().positive("Quantity must be at least 1"),
  customizations: z.record(z.any()).optional(),
});

export const updateCartItemSchema = z.object({
  quantity: z.number().int().positive("Quantity must be at least 1").optional(),
  customizations: z.record(z.any()).optional(),
});

export const addressSchema = z.object({
  label: z.string().min(1, "Address label is required").max(100),
  addressLine: z.string().min(1, "Address line is required"),
  city: z.string().min(1, "City is required"),
  pincode: z.string().min(3, "Pincode is required"),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  isDefault: z.boolean().optional(),
});

export const validateCouponSchema = z.object({
  code: z.string().min(1, "Coupon code is required"),
});

export const orderCreationSchema = z.object({
  addressId: z.string().uuid("Invalid address ID"),
  couponCode: z.string().optional(),
  scheduledTime: z.string().optional(),
  specialInstructions: z.string().optional(),
  paymentMethod: z.enum(["card", "upi", "net_banking", "wallet", "cod"]),
  paymentGateway: z.enum(["razorpay", "stripe"]).optional(),
});

export const paymentInitiationSchema = z.object({
  orderId: z.string().uuid("Invalid order ID"),
  gateway: z.enum(["razorpay", "stripe"]),
  method: z.enum(["card", "upi", "net_banking", "wallet", "cod"]),
});

export const orderStatusUpdateSchema = z.object({
  status: z.enum(["preparing", "ready"]),
});

export const partnerProfileSchema = z.object({
  vehicleType: z.enum(["bike", "scooter", "car"]).optional(),
  isOnline: z.boolean().optional(),
  licenseUrl: z.string().url("Invalid license URL").optional(),
  registrationUrl: z.string().url("Invalid registration URL").optional(),
});

export const partnerLocationSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

export const partnerOrderStatusSchema = z.object({
  status: z.enum([
    "arrived_at_restaurant",
    "picked_up",
    "arrived_at_customer",
    "delivered",
  ]),
});

export const otpVerifySchema = z.object({
  otpCode: z.string().length(6, "OTP code must be 6 digits"),
});

export const ratingSchema = z.object({
  foodRating: z.coerce.number().int().min(1).max(5),
  deliveryRating: z.coerce.number().int().min(1).max(5),
  reviewText: z.string().optional(),
});

export const tipSchema = z.object({
  amount: z.coerce.number().positive("Tip amount must be positive"),
});

export const callbackRequestSchema = z.object({});

// Restaurant validators
export const createRestaurantSchema = z.object({
  name: z.string().min(1, "Restaurant name is required").max(255),
  address: z.string().min(1, "Address is required"),
  lat: z.coerce.number().min(-90, "Latitude must be between -90 and 90").max(90),
  lng: z.coerce.number().min(-180, "Longitude must be between -180 and 180").max(180),
  cuisineType: z.array(z.string().min(1)).min(1, "At least one cuisine type is required"),
});

export const updateRestaurantSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  address: z.string().min(1).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  cuisineType: z.array(z.string().min(1)).optional(),
  isOpen: z.boolean().optional(),
  bankAccountDetails: z.record(z.any()).optional(),
});

// Menu item validators
export const createMenuItemSchema = z.object({
  name: z.string().min(1, "Dish name is required").max(255),
  description: z.string().optional(),
  price: z.coerce.number().positive("Price must be positive"),
  category: z.string().min(1, "Category is required").max(100),
  imageUrl: z.string().url("Invalid image URL").optional(),
  isVeg: z.boolean().optional().default(true),
});

export const updateMenuItemSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  price: z.coerce.number().positive().optional(),
  category: z.string().min(1).max(100).optional(),
  imageUrl: z.string().url().optional(),
  isVeg: z.boolean().optional(),
});

export const updateMenuItemAvailabilitySchema = z.object({
  isAvailable: z.boolean(),
});

// Bulk upload schema
export const bulkMenuUploadSchema = z.object({
  items: z.array(createMenuItemSchema).min(1, "At least one item is required"),
});

// ---------------------------------------------------------------------------
// MVP 4 validators
// ---------------------------------------------------------------------------
export const reviewReplySchema = z.object({
  reply: z.string().min(1, "Reply text is required").max(1000),
});

export const reviewFlagSchema = z.object({
  reason: z.string().min(1, "Flag reason is required").max(500),
});

const timeSlotSchema = z.object({
  start: z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM"),
  end: z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM"),
});

export const createRestaurantCouponSchema = z.object({
  code: z.string().min(3, "Coupon code is required").max(50),
  discountType: z.enum(["percentage", "fixed"]),
  discountValue: z.coerce.number().positive("Discount value must be positive"),
  minOrderValue: z.coerce.number().min(0).optional().default(0),
  maxDiscount: z.coerce.number().min(0).optional().default(0),
  validFrom: z.string().optional(),
  validTo: z.string(),
  timeSlots: z.array(timeSlotSchema).optional().default([]),
  usageLimit: z.coerce.number().int().min(0).optional().default(0),
});

export const createComboSchema = z.object({
  name: z.string().min(1, "Combo name is required").max(255),
  comboPrice: z.coerce.number().positive("Combo price must be positive"),
  items: z
    .array(
      z.object({
        menuItemId: z.string().uuid("Invalid menu item ID"),
        quantity: z.number().int().positive(),
      }),
    )
    .min(2, "A combo needs at least 2 items"),
});

export const redeemLoyaltySchema = z.object({
  points: z.coerce.number().int().positive("Points to redeem must be positive"),
});

export const resolveDisputeSchema = z.object({
  status: z.enum(["resolved_customer_wins", "resolved_partner_wins"]),
  adminNotes: z.string().max(2000).optional(),
});

// Helper function to validate
export function validateData(schema, data) {
  try {
    return { valid: true, data: schema.parse(data) };
  } catch (error) {
    return { valid: false, errors: error.errors };
  }
}
