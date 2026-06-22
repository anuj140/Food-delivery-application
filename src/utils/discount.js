// Shared discount helpers used by both platform coupons (controllers/coupons.js)
// and restaurant-funded coupons (controllers/restaurantCoupons.js).

// Computes the discount a coupon yields for a given subtotal.
// Works for both platform `coupons` and `restaurant_coupons` (same field shape).
export function calculateDiscount(coupon, subtotal) {
  if (!coupon) {
    return 0;
  }

  if (coupon.discountType === "percentage") {
    const discountValue = (subtotal * Number(coupon.discountValue)) / 100;
    const cap = Number(coupon.maxDiscount);
    // maxDiscount of 0 means "no cap"
    return cap > 0 ? Math.min(discountValue, cap) : discountValue;
  }

  return Math.min(Number(coupon.discountValue), subtotal);
}

// Returns true if `date` falls inside one of the coupon's time slots.
// `timeSlots` is an array like [{ start: "12:00", end: "15:00" }].
// Empty/missing slots means the coupon is valid at any time of day.
export function isWithinTimeSlots(timeSlots, date = new Date()) {
  if (!Array.isArray(timeSlots) || timeSlots.length === 0) {
    return true;
  }

  const minutesNow = date.getHours() * 60 + date.getMinutes();

  return timeSlots.some((slot) => {
    if (!slot || !slot.start || !slot.end) {
      return false;
    }
    const [sh, sm] = slot.start.split(":").map(Number);
    const [eh, em] = slot.end.split(":").map(Number);
    const startMin = sh * 60 + sm;
    const endMin = eh * 60 + em;
    return minutesNow >= startMin && minutesNow <= endMin;
  });
}

// A coupon is usable if active, within its valid window, under its usage limit,
// meets the minimum order value, and (for restaurant coupons) within a time slot.
export function isCouponUsable(coupon, subtotal, now = new Date()) {
  if (!coupon.active) return false;
  if (coupon.validFrom && now < new Date(coupon.validFrom)) return false;
  if (coupon.validTo && now > new Date(coupon.validTo)) return false;
  if (Number(coupon.usageLimit) > 0 && Number(coupon.usedCount) >= Number(coupon.usageLimit)) return false;
  if (subtotal < Number(coupon.minOrderValue)) return false;
  if (coupon.timeSlots && !isWithinTimeSlots(coupon.timeSlots, now)) return false;
  return true;
}
