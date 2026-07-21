// REST API handlers. Each returns { status, body }.
import { db, makeId } from './db.js';
import {
  decorateAndSort,
  recommend,
  utilisationStats,
  minPrice,
  aggregateDeals,
  AGE_GROUPS,
} from './logic.js';
import { regionTree } from './regions.js';
import { listPlugins, pluginCatalog, runPluginAction } from './plugins/registry.js';

export const CATEGORIES = [
  { key: 'climbing', label: '클라이밍', emoji: '🧗' },
  { key: 'crossfit', label: '크로스핏', emoji: '🏋️' },
  { key: 'jiujitsu', label: '주짓수', emoji: '🥋' },
  { key: 'boxing', label: '복싱', emoji: '🥊' },
  { key: 'fitness', label: '헬스', emoji: '💪' },
  { key: 'pilates', label: '필라테스', emoji: '🤸' },
  { key: 'aerobic', label: '에어로빅', emoji: '💃' },
  { key: 'dance', label: '스포츠댄스', emoji: '🕺' },
  { key: 'yoga', label: '요가', emoji: '🧘' },
  { key: 'tennis', label: '테니스', emoji: '🎾' },
  { key: 'swimming', label: '수영', emoji: '🏊' },
  { key: 'screengolf', label: '스크린골프', emoji: '⛳' },
];

const ok = (body) => ({ status: 200, body });
const created = (body) => ({ status: 201, body });
const notFound = (msg = '찾을 수 없습니다') => ({ status: 404, body: { error: msg } });
const badReq = (msg) => ({ status: 400, body: { error: msg } });

// GET /api/meta — categories + age groups + region tree for the UI
export function getMeta() {
  return ok({
    categories: CATEGORIES,
    ageGroups: Object.entries(AGE_GROUPS).map(([key, v]) => ({ key, ...v })),
    regions: regionTree(),
  });
}

// GET /api/regions — city > district > zone 트리
export function getRegions() {
  return ok({ regions: regionTree() });
}

// GET /api/facilities?category=&sort=&lat=&lng=&q=&zone=&district=&neighborhood=
export function listFacilities(query) {
  let items = db.facilities();
  const { category, sort, lat, lng, q, zone, district, neighborhood } = query;

  if (category && category !== 'all') {
    items = items.filter((f) => f.category === category);
  }
  if (zone && zone !== 'all') items = items.filter((f) => f.zone === zone);
  if (district) items = items.filter((f) => f.region && f.region.district === district);
  if (neighborhood)
    items = items.filter((f) => f.region && f.region.neighborhood === neighborhood);
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

// GET /api/recommend?ageGroup=&categories=a,b&lat=&lng=&zone=
export function getRecommendations(query) {
  const { ageGroup, categories, lat, lng, zone } = query;
  const cats = categories ? categories.split(',').filter(Boolean) : [];
  const origin =
    lat != null && lng != null && !Number.isNaN(+lat) && !Number.isNaN(+lng)
      ? { lat: +lat, lng: +lng }
      : null;
  const items = recommend(db.facilities(), { ageGroup, categories: cats, origin, zone });
  return ok({ recommendations: items });
}

// GET /api/deals?zone= — 마감 임박 특가(유휴 인벤토리)
export function getDeals(query) {
  const { zone } = query;
  return ok({ deals: aggregateDeals(db.facilities(), { zone }) });
}

// ---- Hub (플러그인) ----

// GET /api/hub — 등록된 로컬 서비스 플러그인 목록
export function hubList() {
  return ok({ plugins: listPlugins() });
}

// GET /api/hub/:id/catalog?zone=&category=
export function hubCatalog(id, query) {
  const result = pluginCatalog(id, query);
  if (!result) return notFound('플러그인을 찾을 수 없습니다');
  return ok(result);
}

// POST /api/hub/:id/:action
export function hubAction(id, action, body) {
  return runPluginAction(id, action, body, { db, makeId });
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

// GET /api/my?user= — 마이 탭용 집계(수강권 + 예약 + 크루)
export function getMy(query) {
  const user = (query.user || '').trim();
  const s = db.all;
  const passes = user ? s.passes.filter((p) => p.userName === user) : [];
  const reservations = user
    ? s.reservations
        .filter((r) => r.userName === user)
        .map((r) => {
          const f = db.facility(r.facilityId);
          return { ...r, facilityName: f ? f.name : r.facilityId, emoji: f ? f.emoji : '📍' };
        })
    : [];
  const crew = user ? (s.crewMembers || []).filter((c) => c.userName === user) : [];
  return ok({ user, passes, reservations, crew });
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
