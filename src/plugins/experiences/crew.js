// 허브 플러그인: 동호회 크루 매칭
// 지역·종목별 운동 크루를 찾아 가입한다. (커뮤니티 확장 · Phase 2 연계)
export default {
  id: 'crew',
  name: '동호회 크루 매칭',
  icon: '🤝',
  kind: 'experience',
  status: 'active',
  summary: '같이 운동할 사람? 우리 동네 스포츠 크루에 합류하세요.',
  catalog(query = {}) {
    const items = [
      { id: 'cr-01', title: '효자동 클라이밍 크루', category: 'climbing', zone: 'hyoja-newtown', neighborhood: '효자동', members: 24, level: '초중급', meetup: '매주 수·토' },
      { id: 'cr-02', title: '신시가지 새벽 러닝&크로스핏', category: 'crossfit', zone: 'hyoja-newtown', neighborhood: '효자동', members: 18, level: '전체', meetup: '주 3회 새벽' },
      { id: 'cr-03', title: '삼천동 실버 라인댄스 모임', category: 'dance', zone: 'samcheon-seosin', neighborhood: '삼천동', members: 31, level: '입문환영', meetup: '평일 오후' },
      { id: 'cr-04', title: '에코시티 테니스 동호회', category: 'tennis', zone: 'songcheon-eco', neighborhood: '송천동', members: 27, level: '중급', meetup: '주말 오전' },
      { id: 'cr-05', title: '전북대 주짓수 스파링 크루', category: 'jiujitsu', zone: 'jbnu', neighborhood: '덕진동', members: 22, level: '중급 이상', meetup: '평일 야간' },
      { id: 'cr-06', title: '전북대 헬린이 크루', category: 'fitness', zone: 'jbnu', neighborhood: '덕진동', members: 40, level: '초보', meetup: '자유' },
    ];
    return filterCatalog(items, query);
  },
  actions: {
    // POST /api/hub/crew/join { itemId, userName }
    join(body, { db, makeId }) {
      const { itemId, userName } = body || {};
      const crew = this.catalog().find((x) => x.id === itemId);
      if (!crew) return { status: 400, body: { error: '해당 크루를 찾을 수 없습니다' } };
      const membership = {
        id: makeId('cm'),
        plugin: 'crew',
        crewId: itemId,
        crewTitle: crew.title,
        userName: userName || '게스트',
        joinedAt: new Date().toISOString(),
      };
      db.update((s) => s.crewMembers.push(membership));
      return { status: 201, body: { membership, members: crew.members + 1 } };
    },
  },
};

function filterCatalog(items, { zone, category }) {
  return items.filter(
    (i) => (!zone || i.zone === zone) && (!category || i.category === category),
  );
}
