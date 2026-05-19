import { db } from "../db.js";
import { addresses } from "../schema.js";
import { eq } from "drizzle-orm";
import { addressSchema, validateData } from "../utils/validators.js";

export async function addAddress(req, res) {
  try {
    const userId = req.user.id;
    const validation = validateData(addressSchema, req.body);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validation.errors,
      });
    }

    const { label, addressLine, city, pincode, lat, lng, isDefault } = validation.data;

    if (isDefault) {
      await db
        .update(addresses)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(eq(addresses.userId, userId));
    }

    const [newAddress] = await db
      .insert(addresses)
      .values({
        userId,
        label,
        addressLine,
        city,
        pincode,
        lat: lat.toString(),
        lng: lng.toString(),
        isDefault: Boolean(isDefault),
      })
      .returning();

    return res.status(201).json({
      success: true,
      message: "Address added successfully",
      data: newAddress,
    });
  } catch (error) {
    console.error("Add address error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
}

export async function listAddresses(req, res) {
  try {
    const userId = req.user.id;
    const allAddresses = await db.select().from(addresses).where(eq(addresses.userId, userId));

    return res.status(200).json({
      success: true,
      data: allAddresses,
    });
  } catch (error) {
    console.error("List addresses error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
}

export async function updateAddress(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const validation = validateData(addressSchema, req.body);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validation.errors,
      });
    }

    const [existingAddress] = await db.select().from(addresses).where(eq(addresses.id, id)).limit(1);
    if (!existingAddress || existingAddress.userId !== userId) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    const { label, addressLine, city, pincode, lat, lng, isDefault } = validation.data;

    if (isDefault) {
      await db
        .update(addresses)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(eq(addresses.userId, userId));
    }

    const [updatedAddress] = await db
      .update(addresses)
      .set({
        label,
        addressLine,
        city,
        pincode,
        lat: lat.toString(),
        lng: lng.toString(),
        isDefault: Boolean(isDefault),
        updatedAt: new Date(),
      })
      .where(eq(addresses.id, id))
      .returning();

    return res.status(200).json({
      success: true,
      message: "Address updated successfully",
      data: updatedAddress,
    });
  } catch (error) {
    console.error("Update address error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
}

export async function deleteAddress(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const [existingAddress] = await db.select().from(addresses).where(eq(addresses.id, id)).limit(1);
    if (!existingAddress || existingAddress.userId !== userId) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    await db.delete(addresses).where(eq(addresses.id, id));

    return res.status(200).json({
      success: true,
      message: "Address deleted successfully",
    });
  } catch (error) {
    console.error("Delete address error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
}
