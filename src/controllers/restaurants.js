import { db } from "../db.js";
import { restaurants, menuItems } from "../schema.js";
import { eq, and, sql } from "drizzle-orm";
import {
  createRestaurantSchema,
  updateRestaurantSchema,
  validateData,
} from "../utils/validators.js";

export async function createRestaurant(req, res) {
  try {
    // Validate input
    const validation = validateData(createRestaurantSchema, req.body);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validation.errors,
      });
    }

    const userId = req.user.id;
    const { name, address, lat, lng, cuisineType } = validation.data;

    // Check if user already has a restaurant
    const existingRestaurant = await db
      .select()
      .from(restaurants)
      .where(eq(restaurants.userId, userId))
      .limit(1);

    if (existingRestaurant.length > 0) {
      return res.status(409).json({
        success: false,
        message: "User already has a restaurant profile",
      });
    }

    // Create restaurant
    const newRestaurant = await db
      .insert(restaurants)
      .values({
        userId,
        name,
        address,
        lat: lat.toString(),
        lng: lng.toString(),
        cuisineType,
      })
      .returning();

    const restaurant = newRestaurant[0];

    return res.status(201).json({
      success: true,
      message: "Restaurant created successfully",
      data: restaurant,
    });
  } catch (error) {
    console.error("Create restaurant error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
}

export async function getRestaurantById(req, res) {
  try {
    const { id } = req.params;

    const foundRestaurants = await db
      .select()
      .from(restaurants)
      .where(eq(restaurants.id, id))
      .limit(1);

    if (foundRestaurants.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Restaurant not found",
      });
    }

    const restaurant = foundRestaurants[0];

    return res.status(200).json({
      success: true,
      data: {
        ...restaurant,
        reviewCount: 0,
      },
    });
  } catch (error) {
    console.error("Get restaurant error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
}

export async function updateRestaurant(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Validate input
    const validation = validateData(updateRestaurantSchema, req.body);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validation.errors,
      });
    }

    // Check ownership
    const foundRestaurants = await db
      .select()
      .from(restaurants)
      .where(and(eq(restaurants.id, id), eq(restaurants.userId, userId)))
      .limit(1);

    if (foundRestaurants.length === 0) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this restaurant",
      });
    }

    const updateData = {};
    const data = validation.data;

    if (data.name !== undefined) updateData.name = data.name;
    if (data.address !== undefined) updateData.address = data.address;
    if (data.lat !== undefined) updateData.lat = data.lat.toString();
    if (data.lng !== undefined) updateData.lng = data.lng.toString();
    if (data.cuisineType !== undefined) updateData.cuisineType = data.cuisineType;
    if (data.isOpen !== undefined) updateData.isOpen = data.isOpen;
    if (data.bankAccountDetails !== undefined)
      updateData.bankAccountDetails = data.bankAccountDetails;
    updateData.updatedAt = new Date();

    const updatedRestaurant = await db
      .update(restaurants)
      .set(updateData)
      .where(eq(restaurants.id, id))
      .returning();

    return res.status(200).json({
      success: true,
      message: "Restaurant updated successfully",
      data: updatedRestaurant[0],
    });
  } catch (error) {
    console.error("Update restaurant error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
}

export async function listRestaurants(req, res) {
  try {
    const { cuisine, lat, lng, sort = "rating", limit = 20, offset = 0 } = req.query;
    const latitude = lat ? parseFloat(lat) : null;
    const longitude = lng ? parseFloat(lng) : null;

    const selectFields = {
      id: restaurants.id,
      userId: restaurants.userId,
      name: restaurants.name,
      address: restaurants.address,
      lat: restaurants.lat,
      lng: restaurants.lng,
      cuisineType: restaurants.cuisineType,
      isOpen: restaurants.isOpen,
      avgRating: restaurants.avgRating,
      commissionRate: restaurants.commissionRate,
      bankAccountDetails: restaurants.bankAccountDetails,
      createdAt: restaurants.createdAt,
      updatedAt: restaurants.updatedAt,
    };

    if (latitude !== null && longitude !== null) {
      selectFields.distance = sql`
        (6371 * acos(
          cos(radians(${latitude})) *
          cos(radians(${restaurants.lat})) *
          cos(radians(${restaurants.lng}) - radians(${longitude})) +
          sin(radians(${latitude})) *
          sin(radians(${restaurants.lat}))
        ))
      `.as("distance");
    }

    let query = db.select(selectFields).from(restaurants);

    if (cuisine) {
      query = query.where(
        sql`${restaurants.cuisineType} @> ARRAY[${cuisine}]::text[]`,
      );
    }

    const allRestaurants = await query;

    if (sort === "distance" && (latitude === null || longitude === null)) {
      return res.status(400).json({
        success: false,
        message: "Latitude and longitude are required to sort by distance",
      });
    }

    const enrichedRestaurants = allRestaurants.map((restaurant) => ({
      ...restaurant,
      reviewCount: 0,
    }));

    if (sort === "rating") {
      enrichedRestaurants.sort(
        (a, b) => parseFloat(b.avgRating) - parseFloat(a.avgRating),
      );
    } else if (sort === "distance") {
      enrichedRestaurants.sort((a, b) => a.distance - b.distance);
    }

    const paginatedRestaurants = enrichedRestaurants.slice(
      parseInt(offset, 10),
      parseInt(offset, 10) + parseInt(limit, 10),
    );

    return res.status(200).json({
      success: true,
      data: paginatedRestaurants,
      pagination: {
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10),
        total: enrichedRestaurants.length,
      },
    });
  } catch (error) {
    console.error("List restaurants error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
}

// Helper function to calculate distance using Haversine formula
function calculateDistance(restaurants, userLat, userLng) {
  const R = 6371; // Earth's radius in km

  return restaurants.map((restaurant) => {
    const lat1 = parseFloat(userLat);
    const lon1 = parseFloat(userLng);
    const lat2 = parseFloat(restaurant.lat);
    const lon2 = parseFloat(restaurant.lng);

    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return { ...restaurant, distance };
  });
}
