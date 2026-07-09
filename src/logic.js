// Domain logic: distance, sorting, and age-based recommendation.

// Haversine distance in kilometres between two lat/lng points.
export function distanceKm(a, b) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Lowest listed price for a facility (used for price sorting).
export function minPrice(facility) {
  const prices = facility.priceTable.map((p) => p.price).filter((p) => p > 0);
  return prices.length ? Math.min(...prices) : 0;
}

// Occupancy ratio 0..1 — higher means busier.
export function occupancyRatio(f) {
  return f.capacityMax ? f.currentOccupancy / f.capacityMax : 0;
}

// Attach a computed distance (when the user shares a location) and sort.
export function decorateAndSort(facilities, { origin, sort } = {}) {
  const list = facilities.map((f) => ({
    ...f,
    distanceKm: origin ? Number(distanceKm(origin, f).toFixed(2)) : null,
    minPrice: minPrice(f),
    occupancyRatio: Number(occupancyRatio(f).toFixed(2)),
  }));

  switch (sort) {
    case 'price':
      list.sort((a, b) => a.minPrice - b.minPrice);
      break;
    case 'rating':
      list.sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount);
      break;
    case 'distance':
      list.sort((a, b) => {
        if (a.distanceKm == null) return 1;
        if (b.distanceKm == null) return -1;
        return a.distanceKm - b.distanceKm;
      });
      break;
    default:
      list.sort((a, b) => b.rating - a.rating);
  }
  return list;
}

// Age groups map to the personas in the plan.
export const AGE_GROUPS = {
  youth: { label: '10~20대', prefers: ['climbing', 'crossfit', 'jiujitsu'] },
  '3040': { label: '30~40대', prefers: ['crossfit', 'climbing', 'jiujitsu', 'yoga'] },
  '4060': { label: '40~60대+', prefers: ['aerobic', 'yoga', 'swimming'] },
};

// Personalised curation: score each facility for a given age group and
// preferred categories, then return the top matches with a reason.
export function recommend(facilities, { ageGroup, categories = [], origin } = {}) {
  const group = AGE_GROUPS[ageGroup];
  const preferred = new Set([...(group ? group.prefers : []), ...categories]);

  const scored = facilities.map((f) => {
    let score = 0;
    const reasons = [];

    if (categories.includes(f.category)) {
      score += 40;
      reasons.push('선호 종목 일치');
    } else if (group && group.prefers.includes(f.category)) {
      score += 25;
      reasons.push(`${group.label} 인기 종목`);
    }

    if (f.ageGroups.includes(ageGroup)) {
      score += 20;
      reasons.push('연령대 맞춤');
    }

    score += f.rating * 4; // up to ~20
    if (f.reviewCount > 150) {
      score += 6;
      reasons.push('후기 많음');
    }

    if (origin) {
      const d = distanceKm(origin, f);
      if (d < 3) {
        score += 12;
        reasons.push('내 주변');
      } else if (d < 6) {
        score += 6;
      }
    }

    // Prefer facilities with room to join.
    if (occupancyRatio(f) < 0.7) score += 4;

    return {
      ...f,
      distanceKm: origin ? Number(distanceKm(origin, f).toFixed(2)) : null,
      minPrice: minPrice(f),
      score: Number(score.toFixed(1)),
      reasons: reasons.slice(0, 2),
    };
  });

  return scored
    .filter((f) => preferred.size === 0 || preferred.has(f.category) || f.score > 30)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

// Partner-side analytics: utilisation grouped by weekday and time slot.
export function utilisationStats(facility, reservations) {
  const days = ['월', '화', '수', '목', '금', '토', '일'];
  const byDay = Object.fromEntries(days.map((d) => [d, 0]));
  const bySlot = {};

  for (const cls of facility.schedule) {
    const slot = `${cls.time}`;
    bySlot[slot] = bySlot[slot] || { booked: 0, capacity: 0 };
  }

  const facRes = reservations.filter((r) => r.facilityId === facility.id);
  for (const r of facRes) {
    if (byDay[r.classDay] != null) byDay[r.classDay] += 1;
    const slot = r.classTime;
    bySlot[slot] = bySlot[slot] || { booked: 0, capacity: 0 };
    bySlot[slot].booked += 1;
  }

  return {
    totalReservations: facRes.length,
    checkedIn: facRes.filter((r) => r.checkedIn).length,
    occupancyRatio: Number(occupancyRatio(facility).toFixed(2)),
    byDay,
    bySlot,
  };
}
