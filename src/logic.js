// Domain logic: distance, sorting, and age-based recommendation.
import { zoneById, zoneFitBonus } from './regions.js';

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
// zone: 선택 시 해당 지역 코어의 큐레이션 전략(타깃 페르소나·추천 종목)을 가중.
export function recommend(facilities, { ageGroup, categories = [], origin, zone } = {}) {
  const zoneObj = zone ? zoneById(zone) : null;
  // 존을 고르면 존의 타깃 페르소나를 연령대로 승계(미지정 시)
  const effectiveAge = ageGroup || (zoneObj ? zoneObj.persona : '');
  const group = AGE_GROUPS[effectiveAge];
  const preferred = new Set([
    ...(group ? group.prefers : []),
    ...categories,
    ...(zoneObj ? zoneObj.categories : []),
  ]);

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

    // 지역 코어 큐레이션 가중치
    if (zoneObj) {
      const zb = zoneFitBonus(f, zoneObj);
      if (zb > 0) {
        score += zb;
        if (f.zone === zoneObj.id) reasons.push(`${zoneObj.label} 추천`);
        else if (zoneObj.categories.includes(f.category)) reasons.push(`${zoneObj.personaLabel} 맞춤`);
      }
    }

    if (f.ageGroups.includes(effectiveAge)) {
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
      reasons: [...new Set(reasons)].slice(0, 2),
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

// 야놀자식 '마감 임박 특가' — 시설의 유휴 시간대 인벤토리를 모아
// 할인율이 큰 순으로 노출한다. (인벤토리 yield 관리)
export function aggregateDeals(facilities, { zone } = {}) {
  const deals = [];
  for (const f of facilities) {
    if (zone && f.zone !== zone) continue;
    for (const d of f.idleDeals || []) {
      const discountPct = Math.round((1 - d.dealPrice / d.originalPrice) * 100);
      deals.push({
        facilityId: f.id,
        facilityName: f.name,
        emoji: f.emoji,
        category: f.category,
        zone: f.zone,
        neighborhood: f.region ? f.region.neighborhood : '',
        ...d,
        discountPct,
      });
    }
  }
  return deals.sort((a, b) => b.discountPct - a.discountPct || a.spotsLeft - b.spotsLeft);
}
