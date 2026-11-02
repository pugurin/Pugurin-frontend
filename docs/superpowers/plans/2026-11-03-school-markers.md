# 학교 마커 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 줌 14 이상에서 지도 화면 안의 학교를 초·중·고·특수·기타별 색·글자·도형 마커로 보여주고, 누르면 학교 정보 시트를 연다.

**Architecture:**

- 데이터는 `Repository.schools(bbox)`(`GET /schools`)로 받는다.
- 레벨별 색·도형·글자와 이름 줄이기는 순수 모듈 `src/state/school.ts`에 둔다.
- 지도에는 `MarkerItem`의 학교 변형으로 넘기고, 카카오 런타임이 CSS로 도형을 그린다.
- MapHome은 학교 레이어 스위치(App에 저장), 요청, 범례, 시트를 연결한다.

**Tech Stack:** Expo + React Native(Web) + TypeScript, 카카오맵 JS 런타임(`src/map/kakaoRuntime.ts`), vitest + @testing-library/react

**Spec:** `docs/superpowers/specs/2026-11-02-school-markers-design.md`

## Global Constraints

- 문구·주석은 한국어로 쓴다. TDD로 진행하고, 비밀값은 커밋하지 않는다.
- 레벨 표(spec 1절 그대로):
  - elementary: `#D08A00`, 동그라미 18×18, "초"
  - middle: `#1F8A87`, 네모(반경 3px) 16×16, "중"
  - high: `#5B3FA0`, 마름모(45° 회전, 반경 2px) 13×13, "고"
  - special: `#6B6B66`, 네모 16×16, "특"
  - other: `#6B6B66`, 동그라미 18×18, "기"
- 마커 칸 규격:
  - 흰 바탕, 높이 26px, 레벨 색 테두리 1.5px, 반경 9px, 왼쪽 여백 3px, 오른쪽 여백 8px
  - 20×20 배지 자리 가운데에 도형을 둔다. 도형은 칸 테두리 안쪽에서 사방 최소 2px 떨어진다.
  - 도형 글자는 흰색 굵게 10px(마름모는 9.5px, -45°로 되돌림), 이름은 11px 굵게. 꼬리는 없다.
- 이름 줄이기: 끝의 "초등학교"→"초", "중학교"→"중", "고등학교"→"고", "여자"→"여"로 바꾼다. 앞의 "부산"은 남긴다. 시트에는 원래 이름을 쓴다.
- rank 규칙:
  - 학교는 고 5, 중 5.1, 초 5.2, 특수 5.3, 기타 5.4이고, 선택된 학교는 0이다.
  - 런타임은 학교를 attach 경매보다도 뒤에 자리 잡게 한다.
  - 선택해도 색은 레벨 색 그대로 둔다.
- 학교 점(겹쳐서 점이 된 학교)을 누르면 확대하지 않고 `marker` 이벤트를 보낸다.
- `SCHOOL_MIN_ZOOM = 14`. 요청 조건은 학교 켜짐 + `!outside` + 줌 ≥ 14다. 220ms 디바운스와 AbortController를 쓰고, 쿼리는 `bbox`뿐이다(`level` 없음).
- 학교 스위치는 처음엔 꺼짐이고, App에서 `loadStored("schools", false)` / `store("schools", v)`로 저장한다.
- 404·503 `DATA_NOT_READY`: 학교 마커를 조용히 생략한다. 레이어가 켜져 있으면 "학교 정보를 준비 중이에요" 한 줄을 띄운다.
- 안내 문구 기본값: "배정 학교(학군)가 아니라 직선거리로 가까운 학교입니다". 출처 문구: "나이스 교육정보 개방 포털"
- 학교 응답의 `meta`는 `onMeta`로 넘기지 않는다.

## Review Focus

1. **좌표 없는 학교:** `lat`/`lng`가 null이면 마커를 만들지 않는다. 런타임에 NaN 좌표가 넘어가면 안 된다. (작업 3)
2. **비어 있는 필드:** `tel`, `homepage`, `foundation`, `coed`, `opened_on`이 null이면 그 줄·칩을 숨긴다. "null"이나 빈 칩이 보이면 안 된다. (작업 4)
3. **이름 줄이기 예외:** "부산중학교"는 "부산중", "부산여자고등학교"는 "부산여고"가 된다. 이름 끝이 규칙에 없으면(예: "해마루학교") 그대로 둔다. (작업 2)
4. **경매 탭·토지 탭:** 두 탭에서도 학교 레이어가 켜져 있으면 학교가 함께 보인다. 학교 때문에 경매·실거래 요청이 바뀌면 안 된다. (작업 5)
5. **빠른 지도 이동과 레이어 끄기:** 지도를 빨리 움직이거나 레이어를 끄면 이전 학교 요청을 취소한다. 끈 뒤에 늦게 온 응답이 마커를 다시 그리면 안 된다. (작업 5)

---

### Task 1: 학교 타입과 Repository

**Files:**

- Modify: `src/api/types.ts` — `SchoolLevel`, `School`. `Meta`에 `school_notice?: string`을 더하고, `source_attribution?: string | string[]`로 넓힌다.
- Modify: `src/state/auction.ts:122` — `source_attribution`이 배열이면 `join(" · ")`로 쓴다.
- Modify: `src/api/repository.ts` — `schools`
- Modify: `src/api/fixtures.ts` — `SCHOOLS`, `SCHOOL_META`
- Test: `tests/school-repository.test.ts`(새 파일)

**Interfaces:**

- Produces:
  ```ts
  export type SchoolLevel = "elementary" | "middle" | "high" | "special" | "other";
  export type School = {
    id: string; name: string; kind: string | null; level: SchoolLevel;
    foundation: string | null; coed: string | null; address: string;
    lat: number | null; lng: number | null; tel: string | null;
    homepage: string | null; opened_on: string | null; distance_m: number | null;
  };
  // Repository
  schools(bbox: BBox, signal?: AbortSignal): Promise<Envelope<School[]>>
  ```
- `SCHOOLS`: 우동·센텀 근처(대략 129.13~129.17, 35.16~35.18) 5곳이다.
  - 초 2: "우동초등학교", "센텀초등학교"
  - 중 1: "해운대중학교"
  - 고 1: "해운대여자고등학교"
  - 특수 1: "해마루학교"
  - 한 곳은 `tel`·`homepage`를 null로 둔다.
- `SCHOOL_META`: `{ data_as_of: "2026-11-02", source_attribution: ["나이스 교육정보 개방 포털", "건강보험심사평가원"], school_notice: "배정 학교(학군)가 아니라 직선거리로 가까운 학교입니다" }`

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
it("학교는 bbox만 실어 /schools로 부른다", async () => {
  await repo.schools([129.1, 35.1, 129.2, 35.2]);
  expect(url).toContain("/schools?bbox=129.1%2C35.1%2C129.2%2C35.2");
  expect(url).not.toContain("level=");
});
it("샘플 모드는 bbox 안 학교와 안내 문구를 돌려준다", async () => {
  const r = await sample.schools([129.0, 35.0, 129.3, 35.3]);
  expect(r.data.map((s) => s.level).sort()).toEqual([
    "elementary",
    "elementary",
    "high",
    "middle",
    "special",
  ]);
  expect(r.meta?.school_notice).toBe(
    "배정 학교(학군)가 아니라 직선거리로 가까운 학교입니다",
  );
  expect((await sample.schools([0, 0, 1, 1])).data).toEqual([]);
});
```

`tests/auction-format.test.ts`(또는 경매 시트 테스트)에는 `source_attribution: ["A", "B"]`면 출처가 "출처: A · B"로 나오는 단언을 하나 더한다.

- [ ] **Step 2: 실패 확인.** `npx vitest run tests/school-repository.test.ts`를 실행한다. 예상: FAIL(`repo.schools is not a function`)
- [ ] **Step 3: 구현.** 쿼리는 `URLSearchParams({ bbox: bbox.join(",") })`로 만든다. 샘플은 bbox 안의 `SCHOOLS`로 거르고 `SCHOOL_META`를 붙인다.
- [ ] **Step 4: 통과 확인.** 같은 명령과 `npx vitest run`을 실행한다. 예상: 모두 PASS
- [ ] **Step 5: Commit.** `git commit -m "feat: 학교 API 타입과 Repository 추가"`

---

### Task 2: 학교 레벨 정의와 이름 줄이기

**Files:**

- Create: `src/state/school.ts`
- Test: `tests/school-format.test.ts`(새 파일)

**Interfaces:**

- Consumes: Task 1의 `School`, `SchoolLevel`
- Produces:
  ```ts
  export const SCHOOL_MIN_ZOOM = 14;
  export const SCHOOL_NOTICE =
    "배정 학교(학군)가 아니라 직선거리로 가까운 학교입니다";
  export const SCHOOL_SOURCE = "나이스 교육정보 개방 포털";
  export type SchoolShape = "circle" | "square" | "diamond";
  export const SCHOOL_LEVEL: Record<
    SchoolLevel,
    {
      color: string;
      shape: SchoolShape;
      badge: string;
      name: string;
      legend: string;
      rank: number;
    }
  >;
  export function schoolShortName(name: string): string;
  ```
- `SCHOOL_LEVEL` 값(Global Constraints 표를 그대로 옮긴다):
  - name(시트 칩): "초등학교" / "중학교" / "고등학교" / "특수학교" / "기타 학교"
  - legend(범례): "초" / "중" / "고" / "특수" / "기타"
  - rank: high 5, middle 5.1, elementary 5.2, special 5.3, other 5.4

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
expect(schoolShortName("우동초등학교")).toBe("우동초");
expect(schoolShortName("해운대중학교")).toBe("해운대중");
expect(schoolShortName("해운대여자고등학교")).toBe("해운대여고");
expect(schoolShortName("부산중학교")).toBe("부산중");
expect(schoolShortName("부산여자고등학교")).toBe("부산여고");
expect(schoolShortName("해마루학교")).toBe("해마루학교");
expect(schoolShortName("부산국제외국인학교")).toBe("부산국제외국인학교");
expect(SCHOOL_LEVEL.high).toMatchObject({
  color: "#5B3FA0",
  shape: "diamond",
  badge: "고",
  rank: 5,
});
expect(SCHOOL_LEVEL.special).toMatchObject({
  color: "#6B6B66",
  shape: "square",
  badge: "특",
  legend: "특수",
});
expect(SCHOOL_LEVEL.other).toMatchObject({ shape: "circle", badge: "기" });
```

- [ ] **Step 2: 실패 확인.** `npx vitest run tests/school-format.test.ts`를 실행한다. 예상: FAIL(모듈 없음)
- [ ] **Step 3: 구현.**
  - "여자"→"여"는 줄일 접미사("초등학교"/"중학교"/"고등학교") 바로 앞에 붙어 있을 때만 바꾼다.
  - 접미사가 없는 이름은 그대로 둔다.
- [ ] **Step 4: 통과 확인.** 같은 명령을 실행한다. 예상: PASS
- [ ] **Step 5: Commit.** `git commit -m "feat: 학교 레벨 표시 정의와 이름 줄이기"`

---

### Task 3: 지도 위 학교 마커

**Files:**

- Modify: `src/map/markers.ts` — `MarkerItem.school?: SchoolLevel`, `schoolItems`
- Modify: `src/map/types.ts` — `MapProps.schools?: School[]`
- Modify: `src/map/bridge.ts` — `markerState`에 학교 항목을 합친다
- Modify: `src/map/MapCanvas.tsx`, `src/map/MapCanvas.web.tsx` — markerState effect 의존성에 `p.schools`를 더한다
- Modify: `src/map/kakaoRuntime.ts` — `.pg-marker.school` CSS, 도형 요소, 가운데 앵커, 정렬, 점 클릭
- Test: `tests/map-markers.test.ts`, `tests/kakao-runtime.test.ts`

**Interfaces:**

- Consumes: Task 2의 `SCHOOL_LEVEL`, `schoolShortName`
- Produces:
  - `MarkerItem`에 `school?: SchoolLevel; badge?: string; shape?: SchoolShape`를 더한다. 카카오 런타임 문자열 안에서는 import할 수 없으므로 글자와 도형을 항목에 실어 보낸다.
  - `schoolItems(schools: School[], selected: string | null): MarkerItem[]`. 마커 id는 `school:{id}`다. Task 5는 이 접두어로 분기한다.

- [ ] **Step 1: 실패하는 테스트 작성(`tests/map-markers.test.ts`)**

```ts
it("학교는 줄인 이름과 레벨 색으로, 좌표 없는 학교는 빼고 만든다", () => {
  const items = schoolItems([hs, { ...es, lat: null, lng: null }], null);
  expect(items).toEqual([
    expect.objectContaining({
      id: "school:h1",
      school: "high",
      amount: "해운대여고",
      title: "",
      sub: "",
      region: false,
      color: "#5B3FA0",
      rank: 5,
    }),
  ]);
});
it("선택된 학교는 rank 0이고 색은 그대로다", () => {
  expect(schoolItems([hs], "school:h1")[0]).toMatchObject({
    rank: 0,
    color: "#5B3FA0",
  });
});
```

- [ ] **Step 2: 실패하는 테스트 작성(`tests/kakao-runtime.test.ts`, 기존 가짜 카카오 사용)**
  - 학교 버튼에 `pg-marker school lv-high` 클래스가 붙는지, 첫 자식이 `.badge` 안의 `.shape` 요소이고 글자가 "고"인지 확인한다.
  - 학교 오버레이의 `yAnchor`가 0.5인지 확인한다.
  - 같은 좌표에 실거래 마커, attach 경매, 학교를 함께 넘기면 학교만 `dot`이 되고, 실거래와 경매는 점이 되지 않는지 확인한다.
  - 점이 된 학교를 클릭하면 `send({type:"marker", id:"school:h1"})`이 나가고 `setLevel`은 불리지 않는지 확인한다.
- [ ] **Step 3: 실패 확인.** `npx vitest run tests/map-markers.test.ts tests/kakao-runtime.test.ts`를 실행한다. 예상: 새 테스트 FAIL
- [ ] **Step 4: 구현.**
  - `bridge.markerState`의 items 뒤에 `...schoolItems(p.schools ?? [], p.selected)`를 붙인다.
  - 런타임:
    - 정렬은 "attach 없는 비학교 → attach 있는 것 → 학교" 3단계로 하고, 각 단계 안에서는 rank 순으로 둔다.
    - `markerButton`은 `m.school`이면 `<span class="badge"><span class="shape"><span>글자</span></span></span><span class="name">이름</span>` 구조로 만든다. `MarkerItem.badge`와 `shape`(위 Produces)를 써서 그린다.
    - 충돌 사각형은 지역 마커처럼 가운데 기준으로 잡는다.
    - CSS 값은 Global Constraints 그대로 쓴다. 칸 `display:flex;align-items:center;gap:4px;height:26px;box-sizing:border-box;padding:0 8px 0 3px;border-radius:9px;border:1.5px solid var(--color);background:#fff`, `.badge{width:20px;height:20px;display:flex;align-items:center;justify-content:center}`, 도형 3종 크기와 회전도 표대로 둔다.
    - 점 클릭 조건 `dot && !m.auction`에 `&& !m.school`을 더한다.
- [ ] **Step 5: 통과 확인.** 같은 명령과 `npx vitest run`을 실행한다. 예상: 모두 PASS
- [ ] **Step 6: Commit.** `git commit -m "feat: 지도에 학교 마커 표시"`

---

### Task 4: 학교 시트

**Files:**

- Create: `src/screens/SchoolContent.tsx`
- Test: `tests/school-sheet.test.tsx`(새 파일)

**Interfaces:**

- Consumes: Task 1의 `School`, `Meta`, Task 2의 `SCHOOL_LEVEL`, `SCHOOL_NOTICE`, `SCHOOL_SOURCE`
- Produces: `SchoolContent({ school, meta }: { school: School; meta?: Meta })`

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
it("레벨 칩·설립·남녀공학·원래 이름·주소·전화·홈페이지·개교일·안내·출처를 보여준다", ...);
// "고등학교", "공립", "여", "해운대여자고등학교", 주소에 "부산광역시 " 없음, 전화번호, "홈페이지 열기 ↗",
// "2001.03.01 개교", meta.school_notice, "출처: 나이스 교육정보 개방 포털 · 기준일 2026-11-02"
it("비어 있는 전화·홈페이지·설립·남녀공학·개교일은 줄과 칩을 숨긴다", ...);
it("meta가 없으면 기본 안내 문구와 출처(기준일 없이)를 쓴다", ...);
```

- [ ] **Step 2: 실패 확인.** `npx vitest run tests/school-sheet.test.tsx`를 실행한다. 예상: FAIL
- [ ] **Step 3: 구현.**
  - 구조는 `AuctionContent`의 머리 부분(칩 줄, 제목, 안내 박스, 출처)을 본뜨고 `Badge`를 재사용한다.
  - 전화는 앱에서 `Linking.openURL("tel:…")`이고, 웹(`Platform.OS === "web"`)에서는 글자만 보여준다.
  - 홈페이지는 `Linking.openURL(homepage)`로 연다.
- [ ] **Step 4: 통과 확인.** 같은 명령을 실행한다. 예상: PASS
- [ ] **Step 5: Commit.** `git commit -m "feat: 학교 정보 시트 추가"`

---

### Task 5: 학교 레이어 연결 (App · MapHome)

**Files:**

- Modify: `App.tsx` — `schools` 상태(`loadStored("schools", false)`), `store("schools", v)`, MapHome props
- Modify: `src/screens/MapHome.tsx` — props, 레이어 스위치, 요청 effect, 준비 중 안내, 범례, 마커 클릭, 시트
- Test: `tests/school-map.test.tsx`(새 파일, `tests/auction-map.test.tsx`처럼 MapCanvas를 목으로 바꾸고 `schools` prop을 기록)

**Interfaces:**

- Consumes: Task 1의 `repo.schools`, Task 2의 `SCHOOL_MIN_ZOOM`/`SCHOOL_LEVEL`, Task 3의 `school:` 접두어, Task 4의 `SchoolContent`
- Produces:
  - MapHome 선택 props: `schools?: boolean`(기본 false), `onSchools?: (on: boolean) => void`
  - `selected`에 `{ kind: "school"; school: School; meta?: Meta }`를 더한다.

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
it("레이어 시트에 '학교' 스위치가 있고 누르면 onSchools(true)", ...);
it("학교가 켜져 있고 줌 14 이상이면 bbox로 학교를 부르고 MapCanvas schools에 넘긴다", ...);
it("꺼져 있거나 줌 14 미만이면 부르지 않고 schools는 빈 배열이다", ...);
it("경매 탭·토지 탭에서도 학교를 부르며, 실거래·경매 요청 인자는 그대로다", ...);
it("지도를 다시 움직이면 이전 학교 요청을 취소하고, 끄면 진행 중 요청을 취소한다", ...);
it("404·503이면 마커 없이 '학교 정보를 준비 중이에요'를 띄운다", ...);
it("켜져 있고 줌 14 이상이면 범례(초·중·고·특수)를 띄운다", ...);
it("학교 마커를 누르면 학교 시트가 열리고 원래 이름이 보인다", ...);
```

App 쪽(`tests/auctions-app.test.tsx` 방식)에는 다음 테스트를 하나 둔다: 저장소에 `schools=true`가 있으면 MapHome이 켜진 상태로 렌더링되고, 스위치를 끄면 `store("schools", false)`가 불린다.

- [ ] **Step 2: 실패 확인.** `npx vitest run tests/school-map.test.tsx`를 실행한다. 예상: FAIL
- [ ] **Step 3: 구현.**
  - 레이어 시트의 "지적도" 행 아래에 "학교" 행을 둔다. 설명은 "초·중·고 위치를 지도에 표시해요"다.
  - 요청 effect는 경매 effect와 같은 모양으로 짠다(220ms, AbortController, 의존성 `[repo, camera, schools, outside, retry]`).
  - 응답 `meta`는 상태에 두고 시트에 넘긴다. `onMeta`로는 넘기지 않는다.
  - 범례 조건은 켜짐 + 줌 ≥ 14 + 준비 중 아님이다.
    - 위치는 "목록 보기" 버튼 위, 왼쪽 아래다.
    - 기타는 화면 안에 `other` 학교가 있을 때만 범례에 더한다.
    - 도형 미니어처는 레벨 색 10px 동그라미, 9px 네모, 7px 마름모다.
  - 준비 중 안내는 경매 안내와 같은 `top: "24%"` 자리를 쓰되, 경매 안내가 보일 때는 그 아래(`top: "32%"`)에 둔다.
  - `school:` 마커 클릭: `schools` 배열에서 찾아 `setSelected({ kind: "school", school, meta })`, `setStage("peek")`를 부르고, Sheet key는 `school:{id}`다.
- [ ] **Step 4: 통과 확인.** 같은 명령, `npx vitest run`, `npm run typecheck`를 실행한다.
  - 예상: 테스트 모두 PASS
  - 타입 오류는 main에 이미 있던 `MapCanvas.tsx` WebView 오류 2개 말고는 없어야 한다.
- [ ] **Step 5: Commit.** `git commit -m "feat: 학교 레이어 스위치와 지도 연결"`

---

### Task 6: 문서와 전체 검증

**Files:**

- Modify: `README.md` — "구현 범위"에 학교 레이어 한 문단
- Modify: `docs/API_INTEGRATION.md` — `/schools` 연결 상태

- [ ] **Step 1: 문서 수정.** 학교 레이어, 기본 꺼짐과 저장, 줌 14, 404·503 처리, "배정 학교 아님" 안내를 적는다.
- [ ] **Step 2: 전체 검증.** `npx vitest run && npm run typecheck; npm run build:web`를 실행한다.
  - 예상: 테스트 모두 PASS, 타입 오류는 기존 2개뿐, `dist/` 생성
- [ ] **Step 3: 모양 확인.**
  - 웹 미리보기에서 확인한다. 8081 포트 주인을 먼저 확인하고, CI=1 없이 띄운다. 카카오 키가 `.env.local`에 있어야 지도가 뜬다. 키는 사용자가 직접 넣는다. 없으면 이 단계는 머지 후 https://pugurin.netlify.app 에서 확인한다고 보고한다.
  - 샘플 모드로 학교 레이어를 켠 뒤 `.pg-marker.school`마다 칸 테두리 안쪽과 `.shape` 경계 사이 거리를 `getBoundingClientRect`로 잰다. 사방 2px 이상이어야 한다.
- [ ] **Step 4: Commit.** `git commit -m "docs: 학교 레이어 연결 상태 기록"`
