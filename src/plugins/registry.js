// 허브 플러그인 레지스트리.
// 새 로컬 서비스는 이 파일에 import 한 줄만 추가하면 허브에 등록된다.
// (모듈형 API 아키텍처 — 야놀자가 레저/카셰어링을 붙인 방식)
import oneday from './experiences/oneday.js';
import crew from './experiences/crew.js';
import rental from './experiences/rental.js';
import planned from './wellness/planned.js';

const PLUGINS = [oneday, crew, rental, ...planned];

const byId = new Map(PLUGINS.map((p) => [p.id, p]));

// 매니페스트(요약) 목록 — 프론트 허브 화면용
export function listPlugins() {
  return PLUGINS.map((p) => ({
    id: p.id,
    name: p.name,
    icon: p.icon,
    kind: p.kind,
    status: p.status,
    summary: p.summary,
    itemCount: p.status === 'active' ? p.catalog().length : 0,
  }));
}

export function getPlugin(id) {
  return byId.get(id) || null;
}

// 플러그인 카탈로그 조회
export function pluginCatalog(id, query) {
  const p = getPlugin(id);
  if (!p) return null;
  return { plugin: { id: p.id, name: p.name, icon: p.icon, status: p.status }, items: p.catalog(query) };
}

// 플러그인 액션 실행 (예약/가입/대여 등)
export function runPluginAction(id, action, body, ctx) {
  const p = getPlugin(id);
  if (!p) return { status: 404, body: { error: '플러그인을 찾을 수 없습니다' } };
  if (!p.actions || typeof p.actions[action] !== 'function') {
    return { status: 404, body: { error: '지원하지 않는 액션입니다' } };
  }
  // this 바인딩: 액션 내부에서 this.catalog() 사용 가능
  return p.actions[action].call(p, body, ctx);
}
