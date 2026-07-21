// 공용 API 디스패처. 로컬 server.js 와 Vercel 서버리스 함수(api/index.js)가
// 동일한 라우팅을 공유하도록 순수 함수로 분리했다.
// 입력: { method, pathname, query, body } → 출력: { status, body }
import * as api from './api.js';
import { db } from './db.js';

export function routeApi({ method, pathname, query = {}, body = {} }) {
  const parts = pathname.split('/').filter(Boolean); // ['api', ...]

  if (method === 'GET') {
    if (pathname === '/api/meta') return api.getMeta();
    if (pathname === '/api/facilities') return api.listFacilities(query);
    if (parts[0] === 'api' && parts[1] === 'facilities' && parts[2]) return api.getFacility(parts[2]);
    if (pathname === '/api/recommend') return api.getRecommendations(query);
    if (pathname === '/api/regions') return api.getRegions();
    if (pathname === '/api/deals') return api.getDeals(query);
    if (pathname === '/api/hub') return api.hubList();
    if (parts[1] === 'hub' && parts[2] && parts[3] === 'catalog') return api.hubCatalog(parts[2], query);
    if (pathname === '/api/passes') return api.listPasses(query);
    if (parts[1] === 'partner' && parts[2] && parts[3] === 'dashboard') return api.partnerDashboard(parts[2]);
  }

  if (method === 'POST') {
    if (pathname === '/api/checkout') return api.checkout(body);
    if (pathname === '/api/reservations') return api.createReservation(body);
    if (pathname === '/api/partner/checkin') return api.toggleCheckin(body);
    if (pathname === '/api/partner/promotions') return api.createPromotion(body);
    if (parts[1] === 'partner' && parts[2] === 'promotions' && parts[3] && parts[4] === 'toggle')
      return api.togglePromotion(parts[3]);
    if (parts[1] === 'hub' && parts[2] && parts[3]) return api.hubAction(parts[2], parts[3], body);
    if (pathname === '/api/dev/reset') {
      db.reset();
      return { status: 200, body: { ok: true } };
    }
  }

  return { status: 404, body: { error: '알 수 없는 API 경로입니다', path: pathname } };
}
