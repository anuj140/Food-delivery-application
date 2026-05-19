import { db } from "../db.js";
import { deliveryPartners, deliveryAssignments, orders } from "../schema.js";
import { eq, and, not } from "drizzle-orm";

export async function getFleet(req, res) {
  try {
    const fleetRows = await db
      .select({ partner: deliveryPartners, assignment: deliveryAssignments, order: orders })
      .from(deliveryPartners)
      .leftJoin(
        deliveryAssignments,
        and(eq(deliveryPartners.id, deliveryAssignments.partnerId), not(eq(deliveryAssignments.status, "delivered"))),
      )
      .leftJoin(orders, eq(deliveryAssignments.orderId, orders.id));

    const fleet = fleetRows.map(({ partner, assignment, order }) => ({
      partnerId: partner.id,
      userId: partner.userId,
      vehicleType: partner.vehicleType,
      isOnline: partner.isOnline,
      currentLat: partner.currentLat ? Number(partner.currentLat) : null,
      currentLng: partner.currentLng ? Number(partner.currentLng) : null,
      lastLocationUpdate: partner.lastLocationUpdate,
      assignment: assignment
        ? {
            assignmentId: assignment.id,
            orderId: assignment.orderId,
            status: assignment.status,
            sequence: assignment.sequence,
            partnerEarnings: assignment.partnerEarnings,
          }
        : null,
      orderStatus: order?.status || null,
    }));

    return res.status(200).json({ success: true, data: fleet });
  } catch (error) {
    console.error("Get fleet error:", error);
    return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
  }
}

export async function getFleetStats(req, res) {
  try {
    const partners = await db.select().from(deliveryPartners);
    const assignments = await db
      .select({ partnerId: deliveryAssignments.partnerId, status: deliveryAssignments.status })
      .from(deliveryAssignments)
      .where(not(eq(deliveryAssignments.status, "delivered")));

    const activeMap = new Map();
    assignments.forEach((assignment) => {
      activeMap.set(assignment.partnerId, assignment.status);
    });

    const stats = {
      idle: 0,
      enRouteToPickup: 0,
      enRouteToDropoff: 0,
    };

    partners.forEach((partner) => {
      const status = activeMap.get(partner.id);
      if (!partner.isOnline || !status) {
        stats.idle += 1;
        return;
      }

      if (status === "assigned" || status === "arrived_at_restaurant") {
        stats.enRouteToPickup += 1;
      } else if (status === "picked_up" || status === "arrived_at_customer") {
        stats.enRouteToDropoff += 1;
      } else {
        stats.idle += 1;
      }
    });

    return res.status(200).json({ success: true, data: stats });
  } catch (error) {
    console.error("Get fleet stats error:", error);
    return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
  }
}
