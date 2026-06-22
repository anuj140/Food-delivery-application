import { db } from "../db.js";
import { ratings, orders, deliveryAssignments, users } from "../schema.js";
import { eq, and, desc, sql } from "drizzle-orm";
import { reviewReplySchema, reviewFlagSchema, validateData } from "../utils/validators.js";

// GET /api/restaurants/:id/reviews?sort=recent|helpful&page=
// Public, paginated list of a restaurant's reviews. "helpful" surfaces replied
// reviews and ones with photos/text first; "recent" orders by newest.
export async function listRestaurantReviews(req, res) {
  try {
    const { id } = req.params;
    const sort = req.query.sort === "helpful" ? "helpful" : "recent";
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = 10;
    const offset = (page - 1) * pageSize;

    const orderBy =
      sort === "helpful"
        ? [
            desc(sql`(CASE WHEN ${ratings.restaurantReply} IS NOT NULL THEN 1 ELSE 0 END)`),
            desc(sql`COALESCE(array_length(${ratings.photos}, 1), 0)`),
            desc(ratings.createdAt),
          ]
        : [desc(ratings.createdAt)];

    const rows = await db
      .select({
        id: ratings.id,
        foodRating: ratings.foodRating,
        deliveryRating: ratings.deliveryRating,
        reviewText: ratings.reviewText,
        photos: ratings.photos,
        restaurantReply: ratings.restaurantReply,
        repliedAt: ratings.repliedAt,
        createdAt: ratings.createdAt,
      })
      .from(ratings)
      .where(and(eq(ratings.restaurantId, id), eq(ratings.isFlagged, false)))
      .orderBy(...orderBy)
      .limit(pageSize)
      .offset(offset);

    return res.status(200).json({ success: true, data: rows, page, sort });
  } catch (error) {
    console.error("List restaurant reviews error:", error);
    return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
  }
}

// POST /api/restaurants/:id/reviews/:reviewId/reply  (restaurant owner)
// Requires loadRestaurantOwner middleware -> req.restaurant.
export async function replyToReview(req, res) {
  try {
    const { id, reviewId } = req.params;
    if (id !== req.restaurant.id) {
      return res.status(403).json({ success: false, message: "You do not own this restaurant" });
    }

    const validation = validateData(reviewReplySchema, req.body);
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: "Validation failed", errors: validation.errors });
    }

    const [review] = await db.select().from(ratings).where(eq(ratings.id, reviewId)).limit(1);
    if (!review || review.restaurantId !== req.restaurant.id) {
      return res.status(404).json({ success: false, message: "Review not found" });
    }

    await db
      .update(ratings)
      .set({ restaurantReply: validation.data.reply, repliedAt: new Date(), updatedAt: new Date() })
      .where(eq(ratings.id, reviewId));

    return res.status(200).json({ success: true, message: "Reply posted" });
  } catch (error) {
    console.error("Reply to review error:", error);
    return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
  }
}

// POST /api/reviews/:reviewId/flag  (customer flags a fake/abusive review)
export async function flagReview(req, res) {
  try {
    const { reviewId } = req.params;
    const validation = validateData(reviewFlagSchema, req.body);
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: "Validation failed", errors: validation.errors });
    }

    const [review] = await db.select().from(ratings).where(eq(ratings.id, reviewId)).limit(1);
    if (!review) {
      return res.status(404).json({ success: false, message: "Review not found" });
    }

    await db
      .update(ratings)
      .set({ isFlagged: true, flagReason: validation.data.reason, updatedAt: new Date() })
      .where(eq(ratings.id, reviewId));

    return res.status(200).json({ success: true, message: "Review reported to admin for moderation" });
  } catch (error) {
    console.error("Flag review error:", error);
    return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
  }
}

// GET /api/partner/reviews  (delivery partner sees own delivery ratings/comments)
// Requires loadPartner middleware -> req.partner.
export async function listPartnerReviews(req, res) {
  try {
    const rows = await db
      .select({
        id: ratings.id,
        deliveryRating: ratings.deliveryRating,
        reviewText: ratings.reviewText,
        createdAt: ratings.createdAt,
        orderId: ratings.orderId,
      })
      .from(ratings)
      .innerJoin(deliveryAssignments, eq(deliveryAssignments.orderId, ratings.orderId))
      .where(eq(deliveryAssignments.partnerId, req.partner.id))
      .orderBy(desc(ratings.createdAt));

    // Map a coarse reason so the partner sees "why" (Story 22).
    const data = rows.map((r) => ({
      ...r,
      feedback: Number(r.deliveryRating) <= 3 ? "low_delivery_rating" : "positive",
    }));

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("List partner reviews error:", error);
    return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
  }
}

// GET /api/restaurant/reviews  (owner dashboard: all ratings for own restaurant)
// Requires loadRestaurantOwner middleware -> req.restaurant.
export async function listOwnRestaurantReviews(req, res) {
  try {
    const rows = await db
      .select({
        id: ratings.id,
        customerId: ratings.customerId,
        customerEmail: users.email,
        foodRating: ratings.foodRating,
        deliveryRating: ratings.deliveryRating,
        reviewText: ratings.reviewText,
        photos: ratings.photos,
        restaurantReply: ratings.restaurantReply,
        isFlagged: ratings.isFlagged,
        createdAt: ratings.createdAt,
      })
      .from(ratings)
      .leftJoin(users, eq(users.id, ratings.customerId))
      .where(eq(ratings.restaurantId, req.restaurant.id))
      .orderBy(desc(ratings.createdAt));

    return res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error("List own restaurant reviews error:", error);
    return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
  }
}
