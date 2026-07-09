// 허브 플러그인: 원데이 스포츠 클래스
// 시설 정규 등록과 별개로, 부담 없이 한 번 참여하는 '경험' 상품.
export default {
  id: 'oneday',
  name: '원데이 스포츠 클래스',
  icon: '🎯',
  kind: 'experience',
  status: 'active',
  summary: '등록 없이 한 번만! 전주 곳곳의 원데이 클래스를 예약하세요.',
  catalog(query = {}) {
    const items = [
      { id: 'od-01', title: '주말 볼더링 원데이', category: 'climbing', zone: 'hyoja-newtown', neighborhood: '효자동', price: 25000, when: '토 11:00', host: '클라임업 효자점', spotsLeft: 6 },
      { id: 'od-02', title: '왕초보 크로스핏 체험', category: 'crossfit', zone: 'hyoja-newtown', neighborhood: '효자동', price: 0, when: '일 10:00', host: '크로스핏 전주 박스', spotsLeft: 8 },
      { id: 'od-03', title: '스크린골프 1일 레슨', category: 'screengolf', zone: 'samcheon-seosin', neighborhood: '삼천동', price: 30000, when: '토 14:00', host: '그린필드 스크린골프', spotsLeft: 4 },
      { id: 'od-04', title: '퇴근 후 힐링 요가', category: 'yoga', zone: 'songcheon-eco', neighborhood: '송천동', price: 20000, when: '수 20:00', host: '하루요가 에코시티', spotsLeft: 5 },
      { id: 'od-05', title: '가족 테니스 원데이', category: 'tennis', zone: 'songcheon-eco', neighborhood: '송천동', price: 35000, when: '일 09:00', host: '에코시티 테니스클럽', spotsLeft: 3 },
      { id: 'od-06', title: '스트레스 해소 복싱 체험', category: 'boxing', zone: 'jbnu', neighborhood: '금암동', price: 12000, when: '금 19:00', host: '파이터스 복싱짐', spotsLeft: 7 },
    ];
    return filterCatalog(items, query);
  },
  actions: {
    // POST /api/hub/oneday/book  { itemId, userName }
    book(body, { db, makeId }) {
      const { itemId, userName } = body || {};
      const item = this.catalog().find((x) => x.id === itemId);
      if (!item) return { status: 400, body: { error: '해당 클래스를 찾을 수 없습니다' } };
      const booking = {
        id: makeId('hb'),
        plugin: 'oneday',
        itemId,
        title: item.title,
        userName: userName || '게스트',
        price: item.price,
        bookedAt: new Date().toISOString(),
      };
      db.update((s) => s.hubBookings.push(booking));
      return { status: 201, body: { booking } };
    },
  },
};

function filterCatalog(items, { zone, category }) {
  return items.filter(
    (i) => (!zone || i.zone === zone) && (!category || i.category === category),
  );
}
