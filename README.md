# 플레이패스 (PlayPass)

> **"전주의 모든 운동을 내 손안에, 플레이패스"**
> 지역 기반 스포츠 통합 플랫폼 · **Phase 1 MVP**

에어로빅부터 주짓수까지 전주 전역의 운동 시설을 앱 하나로 **비교 · 예약 · 등록**하는
로컬 스포츠 생태계 플랫폼입니다. 이 저장소는 Phase 1(가격 비교 및 시설 등록 대행)
목표를 검증하기 위한 실행 가능한 MVP입니다.

## 빠른 시작

의존성 설치가 필요 없습니다. Node.js 18+ 만 있으면 됩니다.

```bash
node server.js
# 또는
npm start
```

- 사용자 앱: <http://localhost:3000/>
- 파트너(시설 관리자) 앱: <http://localhost:3000/partner.html>

시드 데이터로 초기화하려면:

```bash
npm run seed   # data/db.json 을 seed.json 기준으로 재설정
```

## 구현된 핵심 기능 (Phase 1)

### A. 사용자 앱 (User App)
- **종목별 필터링** — 클라이밍 · 크로스핏 · 주짓수 · 에어로빅 · 요가 · 수영
- **위치 기반 검색 / 정렬** — 거리순(Haversine) · 가격순 · 후기순, 브라우저 위치 또는 전주 주요 지점 선택
- **시설 상세 페이지** — 시설 소개, 가격표(상세 비교), 강사 프로필, 실시간 수용 인원
- **결제 및 수강권 등록** — 요금제 결제 → 수강권 발급(프로모션 할인 자동 적용)
- **클래스 예약** — 실시간 잔여 좌석 확인 및 예약
- **연령별 맞춤 추천** — 연령대 + 선호 종목 + 위치 기반 개인화 큐레이션

### B. 파트너 앱 (Partner / Gym App)
- **실시간 예약 · 출석 관리 대시보드** — 예약 현황 및 출석 체크 토글
- **프로모션 툴** — 타임세일 · 신규 가입 이벤트를 시설이 직접 등록/중지
- **통계 분석** — 요일별 / 시간대별 이용률, 수용률, 누적 매출, 수강권 판매 현황

## 아키텍처

Phase 3(구독형 짐플릭스 모델)로의 전환을 염두에 두고 **모듈화된 계층 구조**로 설계했습니다.

```
PlayPass/
├── server.js          # HTTP 서버 + 라우팅 + 정적 파일 서빙 (무의존성)
├── src/
│   ├── db.js          # JSON 파일 기반 데이터 스토어 (seed → db 분리)
│   ├── logic.js       # 도메인 로직: 거리 계산 · 정렬 · 추천 · 통계
│   └── api.js         # REST API 핸들러 (뷰와 무관한 순수 로직)
├── data/
│   ├── seed.json      # 전주 시설 시드 데이터 (불변)
│   └── reset.js       # 시드 초기화 스크립트
└── public/            # 프론트엔드 SPA
    ├── index.html · js/app.js       # 사용자 앱
    ├── partner.html · js/partner.js # 파트너 앱
    └── css/style.css
```

- **데이터 계층 분리**(`db.js`)로 향후 PostgreSQL 등 실 DB 교체가 용이합니다.
- **API 핸들러가 순수 함수**(`{status, body}` 반환)라 서버/서버리스 어디든 이식 가능합니다.
- **추천/통계 로직 독립 모듈**(`logic.js`)은 추후 AI 기반 루틴 추천으로 확장할 지점입니다.

## API 요약

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| GET | `/api/meta` | 종목 카테고리 · 연령대 메타 |
| GET | `/api/facilities?category=&sort=&lat=&lng=&q=` | 시설 목록(필터/정렬/검색) |
| GET | `/api/facilities/:id` | 시설 상세 + 활성 프로모션 |
| GET | `/api/recommend?ageGroup=&categories=&lat=&lng=` | 연령별 맞춤 추천 |
| POST | `/api/checkout` | 수강권 결제/등록 |
| POST | `/api/reservations` | 클래스 예약 |
| GET | `/api/passes?user=` | 내 수강권 조회 |
| GET | `/api/partner/:id/dashboard` | 파트너 대시보드 데이터 |
| POST | `/api/partner/checkin` | 출석 체크 토글 |
| POST | `/api/partner/promotions` | 프로모션 등록 |
| POST | `/api/partner/promotions/:id/toggle` | 프로모션 활성/중지 |

## 로드맵

- **Phase 1 (현재)** — 전주 주요 시설 가격 비교 / 예약 / 등록 플랫폼 ✅ MVP
- **Phase 2** — 운동 후기, 크루 매칭 등 소셜/커뮤니티 기능
- **Phase 3** — '플레이패스 멤버십' 구독형 모델(짐플릭스), 통합 포인트 관리

## 참고

- 시연용 MVP로, 결제는 실제 PG 연동 없이 등록 처리만 수행합니다.
- 런타임 데이터는 `data/db.json`(gitignore)에 저장되며 `npm run seed`로 초기화됩니다.
