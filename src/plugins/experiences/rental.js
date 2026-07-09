// 허브 플러그인: 스포츠 용품 대여/커머스
// 공간 → 경험 → 커머스로 이어지는 허브 확장 축.
export default {
  id: 'rental',
  name: '스포츠 용품 대여',
  icon: '🎒',
  kind: 'commerce',
  status: 'active',
  summary: '장비가 없어도 OK. 필요한 용품을 빌리고 바로 운동하세요.',
  catalog(query = {}) {
    const items = [
      { id: 'rt-01', title: '클라이밍 암벽화', category: 'climbing', pricePerDay: 3000, deposit: 10000, stock: 12 },
      { id: 'rt-02', title: '주짓수 도복 세트', category: 'jiujitsu', pricePerDay: 4000, deposit: 20000, stock: 8 },
      { id: 'rt-03', title: '복싱 글러브+핸드랩', category: 'boxing', pricePerDay: 3000, deposit: 15000, stock: 10 },
      { id: 'rt-04', title: '테니스 라켓', category: 'tennis', pricePerDay: 5000, deposit: 30000, stock: 6 },
      { id: 'rt-05', title: '요가매트+블럭', category: 'yoga', pricePerDay: 2000, deposit: 5000, stock: 20 },
      { id: 'rt-06', title: '수영 용품 세트(수경+모자)', category: 'swimming', pricePerDay: 2000, deposit: 5000, stock: 15 },
    ];
    return filterCatalog(items, query);
  },
  actions: {
    // POST /api/hub/rental/rent { itemId, userName, days }
    rent(body, { db, makeId }) {
      const { itemId, userName, days } = body || {};
      const item = this.catalog().find((x) => x.id === itemId);
      if (!item) return { status: 400, body: { error: '해당 용품을 찾을 수 없습니다' } };
      const d = Math.max(1, Number(days) || 1);
      const order = {
        id: makeId('rt'),
        plugin: 'rental',
        itemId,
        title: item.title,
        userName: userName || '게스트',
        days: d,
        total: item.pricePerDay * d,
        deposit: item.deposit,
        rentedAt: new Date().toISOString(),
      };
      db.update((s) => s.hubBookings.push(order));
      return { status: 201, body: { order } };
    },
  },
};

function filterCatalog(items, { category }) {
  return items.filter((i) => !category || i.category === category);
}
