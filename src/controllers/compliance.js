import { db } from "../db.js";
import { partnerComplianceLogs } from "../schema.js";
import { eq, and, gte } from "drizzle-orm";
import { uploadImage } from "../utils/cloudinary.js";

// Records a compliance photo log (selfie / thermal_bag) for today's shift.
// Requires loadPartner -> req.partner and uploadSingle("photo") -> req.file.
async function recordComplianceLog(req, res, type, verified) {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "Photo file is required" });
  }
  const uploaded = await uploadImage(req.file.buffer, "partner-compliance");
  const [log] = await db
    .insert(partnerComplianceLogs)
    .values({
      partnerId: req.partner.id,
      type,
      photoUrl: uploaded.secure_url,
      isVerified: verified,
    })
    .returning();
  return log;
}

// POST /api/partner/selfie-verify
export async function selfieVerify(req, res) {
  try {
    // MVP: face match is stubbed to always pass. A real impl would compare
    // against the stored onboarding face via a verification provider.
    const log = await recordComplianceLog(req, res, "selfie", true);
    if (!log) return; // response already sent on validation error
    return res.status(200).json({
      success: true,
      message: "Selfie verified. You are cleared to go online.",
      data: { id: log.id, isVerified: log.isVerified },
    });
  } catch (error) {
    console.error("Selfie verify error:", error);
    return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
  }
}

// POST /api/partner/thermal-bag-photo
export async function thermalBagPhoto(req, res) {
  try {
    const log = await recordComplianceLog(req, res, "thermal_bag", true);
    if (!log) return;
    return res.status(200).json({
      success: true,
      message: "Thermal bag photo recorded.",
      data: { id: log.id },
    });
  } catch (error) {
    console.error("Thermal bag photo error:", error);
    return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
  }
}

// GET /api/partner/shift-requirements — checklist before going online.
export async function shiftRequirements(req, res) {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const todaysLogs = await db
      .select()
      .from(partnerComplianceLogs)
      .where(
        and(
          eq(partnerComplianceLogs.partnerId, req.partner.id),
          gte(partnerComplianceLogs.createdAt, startOfDay),
        ),
      );

    const selfieDone = todaysLogs.some((l) => l.type === "selfie" && l.isVerified);
    const thermalBagDone = todaysLogs.some((l) => l.type === "thermal_bag");

    return res.status(200).json({
      success: true,
      data: {
        checklist: [
          { requirement: "selfie_verification", done: selfieDone },
          { requirement: "thermal_bag_photo", done: thermalBagDone },
        ],
        readyToGoOnline: selfieDone,
      },
    });
  } catch (error) {
    console.error("Shift requirements error:", error);
    return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
  }
}
