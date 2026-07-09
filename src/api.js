// REST API handlers. Each returns { status, body }.
import { db, makeId } from './db.js';
import {
  decorateAndSort,
  recommend,
  utilisationStats,
  minPrice,
  AGE_GROUPS,
} from './logic.js';

export const CATEGORIES = [
  { key: 'climbing', label: '클라이밍', emoji: '🧗' },
  { key: 'crossfit', label: '크로스핏', emoji: '🏋️' },
  { key: 'jiujitsu', label: '주짓수', emoji: '🥋' },
  { key: 'aerobic', label: '에어로빅', emoji: '💃' },
  { key: 'yoga', label: '요가', emoji: '🧘' },
  { key: 'swimming', label: '수영', emoji: '🏊' },
];

const ok = (body) => ({ status: 200, body });
const created = (body) => ({ status: 201, body });
const notFound = (msg = '찾을 수 없습니다') => ({ status: 404, body: { error: msg } });
const badReq = (msg) => ({ status: 400, body: { error: msg } });

// GET /api/meta — categories + age groups for the UI
export function getMeta() {
  return ok({
    categories: CATEGORIES,
    ageGroups: Object.entries(AGE_GROUPS).map(([key, v]) => ({ key, ...v })),
  });
}

// GET /api/facilities?category=&sort=&lat=&lng=&q=
export function listFacilities(query) {
  let items = db.facilities();
  const { category, sort, lat, lng, q } = query;

  if (category && category !== 'all') {
    items = items.filter((f) => f.category === category);
  }
  if (q) {
    const needle = q.toLowerCase();
    items = items.filter(
      (f) =>
        f.name.toLowerCase().includes(needle) ||
        f.address.toLowerCase().includes(needle) ||
        (f.tags || []).some((t) => t.toLowerCase().includes(needle)),
    );
  }

  const origin =
    lat != null && lng != null && !Number.isNaN(+lat) && !Number.isNaN(+lng)
      ? { lat: +lat, lng: +lng }
      : null;

  return ok({ facilities: decorateAndSort(items, { origin, sort }) });
}

// GET /api/facilities/:id — detail with active promotions
export function getFacility(id) {
  const f = db.facility(id);
  if (!f) return notFound('시설을 찾을 수 없습니다');
  const promotions = db.promotions().filter((p) => p.facilityId === id && p.active);
  return ok({ facility: { ...f, minPrice: minPrice(f) }, promotions });
}

// GET /api/recommend?ageGroup=&categories=a,b&lat=&lng=
export function getRecommendations(query) {
  const { ageGroup, categories, lat, lng } = query;
  const cats = categories ? categories.split(',').filter(Boolean) : [];
  const origin =
    lat != null && lng != null && !Number.isNaN(+lat) && !Number.isNaN(+lng)
      ? { lat: +lat, lng: +lng }
      : null;
  const items = recommend(db.facilities(), { ageGroup, categories: cats, origin });
  return ok({ recommendations: items });
}

// POST /api/checkout — { facilityId, planName, userName }
// Registers a membership pass (수강권) after "payment".
export function checkout(body) {
  const { facilityId, planName, userName } = body || {};
  if (!facilityId || !planName) return badReq('facilityId와 planName은 필수입니다');
  const f = db.facility(facilityId);
  if (!f) return notFound('시설을 찾을 수 없습니다');
  const plan = f.priceTable.find((p) => p.name === planName);
  if (!plan) return badReq('해당 요금제를 찾을 수 없습니다');

  // Apply an active promotion discount if present.
  const promo = db.promotions().find((p) => p.facilityId === facilityId && p.active);
  const discountPct = promo ? promo.discountPct : 0;
  const paid = Math.round(plan.price * (1 - discountPct / 100));

  const pass = {
    id: makeId('pass'),
    facilityId,
    facilityName: f.name,
    planName: plan.name,
    userName: userName || '게스트',
    listPrice: plan.price,
    discountPct,
    paid,
    purchasedAt: new Date().toISOString(),
    status: 'active',
  };

  db.update((s) => s.passes.push(pass));
  return created({ pass });
}

// GET /api/passes?user=
export function listPasses(query) {
  const { user } = query;
  let items = db.passes();
  if (user) items = items.filter((p) => p.userName === user);
  return ok({ passes: items });
}

// POST /api/reservations — { facilityId, className, classDay, classTime, userName }
export function createReservation(body) {
  const { facilityId, className, classDay, classTime, userName } = body || {};
  if (!facilityId || !className) return badReq('facilityId와 className은 필수입니다');
  const f = db.facility(facilityId);
  if (!f) return notFound('시설을 찾을 수 없습니다');

  const cls = f.schedule.find(
    (c) => c.class === className && c.day === classDay && c.time === classTime,
  );
  if (cls && cls.spots <= 0) return badReq('해당 클래스는 마감되었습니다');

  const reservation = {
    id: makeId('r'),
    facilityId,
    userName: userName || '게스트',
    classDay,
    classTime,
    className,
    status: 'confirmed',
    checkedIn: false,
  };

  db.update((s) => {
    s.reservations.push(reservation);
    const target = s.facilities.find((x) => x.id === facilityId);
    const c = target.schedule.find(
      (x) => x.class === className && x.day === classDay && x.time === classTime,
    );
    if (c && c.spots > 0) c.spots -= 1;
    if (target.currentOccupancy < target.capacityMax) target.currentOccupancy += 1;
  });

  return created({ reservation });
}

// ---- Partner (Gym) side ----

// GET /api/partner/:facilityId/dashboard
export function partnerDashboard(facilityId) {
  const f = db.facility(facilityId);
  if (!f) return notFound('시설을 찾을 수 없습니다');
  const reservations = db.reservations().filter((r) => r.facilityId === facilityId);
  const stats = utilisationStats(f, db.reservations());
  const promotions = db.promotions().filter((p) => p.facilityId === facilityId);
  const passes = db.passes().filter((p) => p.facilityId === facilityId);
  const revenue = passes.reduce((sum, p) => sum + p.paid, 0);
  return ok({ facility: f, reservations, stats, promotions, passes, revenue });
}

// POST /api/partner/checkin — { reservationId }
export function toggleCheckin(body) {
  const { reservationId } = body || {};
  const r = db.reservations().find((x) => x.id === reservationId);
  if (!r) return notFound('예약을 찾을 수 없습니다');
  db.update(() => {
    r.checkedIn = !r.checkedIn;
  });
  return ok({ reservation: r });
}

// POST /api/partner/promotions — { facilityId, type, title, desc, discountPct }
export function createPromotion(body) {
  const { facilityId, type, title, desc, discountPct } = body || {};
  if (!facilityId || !title) return badReq('facilityId와 title은 필수입니다');
  if (!db.facility(facilityId)) return notFound('시설을 찾을 수 없습니다');
  const promo = {
    id: makeId('p'),
    facilityId,
    type: type || 'custom',
    title,
    desc: desc || '',
    discountPct: Number(discountPct) || 0,
    active: true,
  };
  db.update((s) => s.promotions.push(promo));
  return created({ promotion: promo });
}

// POST /api/partner/promotions/:id/toggle
export function togglePromotion(id) {
  const p = db.promotions().find((x) => x.id === id);
  if (!p) return notFound('프로모션을 찾을 수 없습니다');
  db.update(() => {
    p.active = !p.active;
  });
  return ok({ promotion: p });
}
