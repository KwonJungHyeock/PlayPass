// 허브 확장 로드맵용 '준비중' 플러그인 묶음.
// 로컬 웰니스 서비스(샐러드 정기배송, 물리치료/마사지, 건강검진 연계)가
// 동일한 플러그인 인터페이스로 손쉽게 붙을 수 있음을 보여준다.
// status: 'planned' 이면 카탈로그는 안내 문구만 반환한다.

const plannedPlugin = (id, name, icon, kind, summary) => ({
  id,
  name,
  icon,
  kind,
  status: 'planned',
  summary,
  catalog() {
    return []; // 오픈 예정 — 상품 없음
  },
});

export default [
  plannedPlugin(
    'salad',
    '로컬 샐러드 정기배송',
    '🥗',
    'wellness',
    '운동 후 식단까지. 전주 로컬 샐러드 정기배송 (오픈 예정)',
  ),
  plannedPlugin(
    'therapy',
    '물리치료·스포츠 마사지',
    '💆',
    'wellness',
    '운동 전후 컨디션 관리. 지역 물리치료·마사지 숍 연계 (오픈 예정)',
  ),
  plannedPlugin(
    'checkup',
    '지역 건강검진 연계',
    '🩺',
    'wellness',
    '내 운동 데이터와 연결되는 지역 밀착형 건강검진 (오픈 예정)',
  ),
];
