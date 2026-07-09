// 전주 지역 세분화 메타데이터 (city > district > neighborhood/zone) 와
// 존(zone)별 큐레이션 규칙. 야놀자식 '지역 코어' 타깃팅 전략을 데이터화한다.

export const CITY = '전주시';

// 핵심 큐레이션 존. 각 존은 구(district) 하위의 핵심 동(neighborhood)을 묶어
// 타깃 페르소나와 추천 종목(고명)을 정의한다.
export const ZONES = [
  {
    id: 'hyoja-newtown',
    district: '완산구',
    label: '효자동 신시가지',
    tagline: '2030 트렌디 스포츠 존',
    persona: 'youth',
    personaLabel: '2030 MZ세대',
    theme: 'trendy',
    emoji: '🔥',
    neighborhoods: ['효자동'],
    categories: ['climbing', 'crossfit', 'jiujitsu', 'pilates'],
    note: '신시가지 중심의 트렌디한 MZ세대 겨냥 — 크로스핏·클라이밍·주짓수·필라테스 집중 배치',
  },
  {
    id: 'samcheon-seosin',
    district: '완산구',
    label: '삼천·서신 생활권',
    tagline: '4060 건강·커뮤니티 존',
    persona: '4060',
    personaLabel: '4060 생활체육',
    theme: 'community',
    emoji: '🌿',
    neighborhoods: ['삼천동', '서신동'],
    categories: ['aerobic', 'dance', 'swimming', 'screengolf'],
    note: '주거 밀집 중장년층 겨냥 — 에어로빅·스포츠댄스·실내수영·스크린골프 배치',
  },
  {
    id: 'songcheon-eco',
    district: '덕진구',
    label: '송천 에코시티·혁신도시',
    tagline: '3040 패밀리 웰니스 존',
    persona: '3040',
    personaLabel: '3040 직장인·주부',
    theme: 'family',
    emoji: '👨‍👩‍👧',
    neighborhoods: ['송천동', '만성동'],
    categories: ['yoga', 'tennis', 'pilates', 'swimming'],
    note: '신도시 젊은 부부·자녀 겨냥 — 퇴근 후 요가·테니스·필라테스, 자녀 연계 프로그램',
  },
  {
    id: 'jbnu',
    district: '덕진구',
    label: '전북대 상권',
    tagline: '대학생 가성비·마감임박 특가 존',
    persona: 'youth',
    personaLabel: '대학생',
    theme: 'value',
    emoji: '⚡',
    neighborhoods: ['덕진동', '금암동'],
    categories: ['fitness', 'jiujitsu', 'boxing', 'climbing'],
    note: '대학가 인구 겨냥 — 가성비 헬스·주짓수·복싱, 마감임박 타임세일 집중 노출',
  },
];

export function zoneById(id) {
  return ZONES.find((z) => z.id === id) || null;
}

// city > district > zone 트리 (프론트 지역 셀렉터용)
export function regionTree() {
  const districts = {};
  for (const z of ZONES) {
    districts[z.district] = districts[z.district] || {
      district: z.district,
      zones: [],
    };
    districts[z.district].zones.push({
      id: z.id,
      label: z.label,
      tagline: z.tagline,
      persona: z.persona,
      personaLabel: z.personaLabel,
      theme: z.theme,
      emoji: z.emoji,
      neighborhoods: z.neighborhoods,
      categories: z.categories,
    });
  }
  return { city: CITY, districts: Object.values(districts) };
}

// 존 큐레이션 적합도 가중치: 시설 카테고리가 존의 추천 종목이면 가점,
// 페르소나 연령대가 맞으면 가점.
export function zoneFitBonus(facility, zone) {
  if (!zone) return 0;
  let bonus = 0;
  if (zone.categories.includes(facility.category)) bonus += 30;
  if (facility.ageGroups.includes(zone.persona)) bonus += 15;
  if (facility.zone === zone.id) bonus += 20; // 실제 해당 존에 위치
  return bonus;
}
