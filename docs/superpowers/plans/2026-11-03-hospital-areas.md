# 병원 원 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 병원 레이어를 켜면 화면 안 병원을 48px 기준으로 묶은 옅은 원과 개수 라벨을 그리고, 라벨을 누르면 그 원의 병원 목록 시트를 연다.

**Architecture:** `Repository.hospitals`가 `/hospitals`를 부르고, 순수 함수 `hospitalAreas`(src/state/hospital.ts)가 줌에 맞춰 원을 만든다. 원은 `MapProps.hospitalAreas`로 런타임에 넘어가 `shapeState`에 실리고, 런타임은 `kakao.maps.Circle`과 라벨 CustomOverlay로 그린다. MapHome이 요청·안내·시트를 학교 레이어와 같은 방식으로 붙인다.

**Tech Stack:** Expo, React Native Web, 카카오 지도 JS 런타임(String.raw), vitest + Testing Library.

**Spec:** docs/superpowers/specs/2026-11-03-hospital-areas-design.md

## Global Constraints

- 한국어로 출력·주석·문서를 쓴다. TDD. 비밀값 커밋 금지.
- 요청 tier는 정확히 `general,hospital,clinic`.
- 묶는 거리 48px, 1px당 미터 `156543.03 * cos(lat°) / 2^zoom`, 반경 = 가장 먼 병원 거리 + 30m, 최소 40m.
- 색 `#0E7FA8`, 원 채움 불투명도 0.12, 테두리 1px 불투명도 0.5, 원 zIndex 1, 라벨 zIndex 4.
- 문구 그대로: 스위치 "병원" / "가까이 모인 병원·의원을 원으로 묶어 보여줘요", 라벨 "병원 {N}", 준비 중 "병원 정보를 준비 중이에요", 상한 "병원이 많아 일부만 세었어요. 확대하면 정확해져요", 출처 "건강보험심사평가원".
- 서버 상한 `HOSPITAL_LIMIT = 500`.
- 원 id `hospital-area:{시드 병원 id}`.

## Review Focus

- 줌이 바뀌면 원이 다시 묶여야 한다(카메라 zoom이 useMemo 의존성에 있어야 함).
- 좌표 null인 병원이 섞여도 오류 없이 빠진다.
- 레이어를 끄면 원·안내·시트가 모두 사라진다.
- 응답이 정확히 500곳일 때만 상한 안내가 뜬다(499면 안 뜬다).
- 원 라벨을 눌러도 지도 클릭(mapClick)으로 처리되지 않는다.

---

### Task 1: 병원 타입·Repository·샘플

**Files:**

- Modify: `src/api/types.ts`, `src/api/repository.ts`, `src/api/fixtures.ts`
- Test: `tests/hospital-repository.test.ts`

**Interfaces:**

- Produces: `type HospitalTier = "general" | "hospital" | "clinic" | "dental" | "oriental" | "public" | "other"`; `type Hospital = { id: string; name: string; class_name: string | null; tier: HospitalTier; address: string; lat: number | null; lng: number | null; tel: string | null; homepage: string | null; doctors: number | null; distance_m: number | null }`; `Repository.hospitals(bbox: BBox, signal?: AbortSignal): Promise<Envelope<Hospital[]>>`; fixtures `HOSPITALS: Hospital[]`(부산진구·해운대 각 3곳 이상, 치과 1곳 포함), `HOSPITAL_META: Meta`.

- [ ] 테스트: api 모드에서 `/hospitals?bbox=...&tier=general%2Chospital%2Cclinic`를 부른다(URLSearchParams 인코딩). 샘플 모드는 bbox 안이면서 tier가 general·hospital·clinic인 것만 돌려준다(치과 제외).
- [ ] 실패 확인 → 구현 → 통과 → 커밋 `feat: 병원 API 타입과 Repository 추가`

### Task 2: 원 묶기 함수

**Files:**

- Create: `src/state/hospital.ts`
- Test: `tests/hospital-areas.test.ts`

**Interfaces:**

- Produces: `HOSPITAL_COLOR = "#0E7FA8"`, `HOSPITAL_TIERS = ["general","hospital","clinic"] as const`, `HOSPITAL_LIMIT = 500`, `HOSPITAL_SOURCE = "건강보험심사평가원"`, `HOSPITAL_TIER_LABEL: Record<"general"|"hospital"|"clinic", string>` = 종합병원/병원/의원, `type HospitalArea = { id: string; lat: number; lng: number; radius_m: number; members: Hospital[] }`, `hospitalAreas(list: Hospital[], zoom: number): HospitalArea[]`, `tierSummary(members: Hospital[]): string`("종합병원 2 · 의원 7", 0인 종별 생략).

- [ ] 테스트(값 고정):
  - 줌 14에서 위도 35.16, 경도 차 0.003(약 273m)인 두 의원은 한 원, 0.006(약 546m)이면 두 원.
  - 시드는 종별 → 의사 수 순: 의원(의사 1)과 종합병원(의사 50)이 묶이면 원 id는 종합병원 id, members 첫 번째도 종합병원.
  - 혼자인 병원 원의 radius_m은 40, 두 병원(중심에서 각 136m)이면 166 근처(±2).
  - 줌 16에서는 줌 14에서 묶이던 273m 두 병원이 나뉜다.
  - 좌표 null 병원은 빠진다. 빈 목록은 빈 배열.
  - `tierSummary`.
- [ ] 실패 확인 → 구현(거리는 equirectangular 근사) → 통과 → 커밋 `feat: 병원을 화면 거리로 묶는 함수 추가`

### Task 3: 런타임에 원 그리기

**Files:**

- Modify: `src/map/types.ts`(MapProps `hospitalAreas?: HospitalArea[]`), `src/map/bridge.ts`(`shapeState`에 `areas`), `src/map/kakaoRuntime.ts`, `src/map/MapCanvas.tsx`, `src/map/MapCanvas.web.tsx`(shapeState 의존성에 `p.hospitalAreas`)
- Test: `tests/kakao-runtime.test.ts`(fakeKakao에 `Circle` 추가)

**Interfaces:**

- Consumes: Task 2 `HospitalArea`.
- Produces: shapeState 메시지 `areas: { id, lat, lng, radius_m, count }[]`. 라벨 버튼 class `pg-area`, aria-label `병원 {N}곳 보기`, 누르면 `{ type: "marker", id }`.

- [ ] 테스트: 원 2개를 넘기면 Circle 2개(center·radius·fillColor `#0E7FA8`·fillOpacity 0.12·strokeWeight 1·strokeOpacity 0.5·zIndex 1)와 라벨 2개(zIndex 4, textContent "병원 3")가 생긴다. 라벨을 누르면 marker만 보내고 mapClick은 보내지 않는다. 빈 배열이면 이전 원이 지워진다.
- [ ] 실패 확인 → 구현(renderShapes가 areas도 그림; 라벨 클릭은 markerClick 타임스탬프로 지도 클릭과 구분) → 통과 → 커밋 `feat: 지도에 병원 원 그리기`

### Task 4: 병원 시트

**Files:**

- Create: `src/screens/HospitalAreaContent.tsx`
- Test: `tests/hospital-sheet.test.tsx`

**Interfaces:**

- Consumes: Task 2 상수·`tierSummary`, `homepageUrl`(SchoolContent).
- Produces: `HospitalAreaContent({ area, meta }: { area: HospitalArea; meta?: Meta })`.

- [ ] 테스트: 제목 "병원 3곳", 종별 줄, 각 줄 "{class_name} · 의사 N명"(null이면 class_name만), 줄을 누르면 주소(부산광역시 뺌)·전화·홈페이지가 보이고 다시 누르면 접힌다, 출처·기준일 "2026.11.02".
- [ ] 실패 확인 → 구현 → 통과 → 커밋 `feat: 병원 원 시트 추가`

### Task 5: 레이어 스위치와 연결

**Files:**

- Modify: `App.tsx`, `src/screens/MapHome.tsx`, `README.md`, `docs/API_INTEGRATION.md`
- Test: `tests/hospital-app.test.tsx`

**Interfaces:**

- Consumes: Task 1~4 전부.
- Produces: MapHome props `hospitals?: boolean; onHospitals?: (on: boolean) => void`, selected 종류 `{ kind: "hospitals"; area: HospitalArea; meta?: Meta }`.

- [ ] 테스트: 스위치 기본 꺼짐·저장, 켜고 줌 14 이상이면 tier를 붙여 요청, 줌 13이면 요청 없음, 500곳이면 상한 안내, 404면 준비 중 안내, `hospital-area:` 마커 이벤트로 시트 열림, 레이어 끄면 시트 닫힘.
- [ ] 실패 확인 → 구현(학교 effect를 따라 씀, `hospitalAreas`는 useMemo([hospitalList, camera.zoom])) → 통과 → 문서 갱신 → 커밋 `feat: 병원 레이어 스위치와 지도 연결`
