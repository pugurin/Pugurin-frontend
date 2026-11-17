# 관심 단지·지역 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 단지·지역(법정동) ☆ 등록/해제와 더보기 → 관심 목록을, 백엔드 없이 앱 안 가짜 서버로 동작하게 만든다.

**Architecture:** `src/api/interests.ts`에 API 명세 §10 모양의 `InterestsApi`와 기기 저장 `SampleInterests`. App이 세션별 관심 상태를 `InterestsContext`로 내려 주고, 시트의 `StarButton`과 `InterestsScreen`이 그걸 쓴다.

**Tech Stack:** Expo RN + react-native-web, TypeScript, vitest + @testing-library/react, AsyncStorage(`state/storage.ts`)

**Spec:** `docs/superpowers/specs/2026-11-13-interests-design.md`

## Global Constraints

- 문구: "로그인하면 관심 등록할 수 있어요", "관심 단지에 담았어요", "관심 단지에서 뺐어요", "관심 지역에 담았어요", "관심 지역에서 뺐어요", "관심 지역은 10개까지예요", 빈 상태 "지도에서 ☆를 눌러 담아 보세요"
- 지역 최대 10개(`REGION_LIMIT = 10`), 등록은 멱등
- 지역 ☆는 법정동(region_code 10자리)에서만 보인다
- 저장 키 `sample_interests.<user_id>` (storage가 `pugurin.` 접두사를 붙임)

## Review Focus

1. 로그아웃하거나 다른 계정으로 로그인하면 이전 계정의 ☆가 남아 있으면 안 된다 → Task 2 테스트
2. 탈퇴하면 그 계정 관심 목록도 지워진다 → Task 1 `clear` 테스트 + Task 3 App 연결
3. ☆를 빠르게 두 번 눌러도 중복 등록·상태 꼬임이 없다 → Task 1 멱등 테스트, Task 2는 요청 중 버튼 비활성
4. 10개 찬 상태에서 11번째 ☆는 에러 토스트만 띄우고 별이 채워지지 않는다 → Task 2 테스트
5. 시·군·구 시트에는 지역 ☆가 안 보인다 → Task 3 테스트

---

### Task 1: 관심 데이터 계층

**Files:**
- Create: `src/api/interests.ts`
- Test: `tests/interests.test.ts`

**Interfaces:**
- Produces:
  - `type ComplexInterest = { complex_id: string; name: string; property_type: Property; address: string; lat: number; lng: number; created_at: string; latest: Transaction | null }`
  - `type RegionInterest = { region_code: string; name: string; lat: number; lng: number; created_at: string }`
  - `type ComplexInput = Omit<ComplexInterest, "created_at" | "latest">`, `type RegionInput = Omit<RegionInterest, "created_at">`
  - `const REGION_LIMIT = 10`
  - `interface InterestsApi { listComplexes(s: Session): Promise<ComplexInterest[]>; addComplex(s, c: ComplexInput): Promise<void>; removeComplex(s, id: string): Promise<void>; listRegions(s): Promise<RegionInterest[]>; addRegion(s, r: RegionInput): Promise<void>; removeRegion(s, code: string): Promise<void>; clear(s): Promise<void> }`
  - `class SampleInterests implements InterestsApi { constructor(delay = 250) }`
  - `isDong(code: string): boolean` (10자리)

- [ ] **Step 1: 실패하는 테스트** (auth.test.tsx처럼 AsyncStorage를 Map으로 모킹)
  - `등록은 멱등이고 최신순으로 돌려준다`: 같은 단지 두 번 add → list 길이 1, 두 단지 add → 나중 것이 [0]
  - `단지 목록에 목 거래 중 최신 거래를 붙인다`: `COMPLEXES[0]`로 add → `latest?.complex_id === COMPLEXES[0].id`, 거래 없는 가짜 id면 `latest === null`
  - `지역은 10개까지`: 10개 add 후 11번째 → `rejects.toMatchObject({ code: "LIMIT_EXCEEDED", message: "관심 지역은 10개까지예요" })`, 이미 있는 지역 재등록은 10개여도 통과
  - `계정마다 따로 저장하고 clear는 그 계정만 지운다`
  - `isDong("2635010500") === true`, `isDong("26350") === false`
- [ ] **Step 2:** `npx vitest run tests/interests.test.ts` → FAIL (모듈 없음)
- [ ] **Step 3:** 구현. 사용자별 `{ complexes: (ComplexInput & {created_at})[]; regions: RegionInterest[] }` 저장, `latest`는 list 때 `TRANSACTIONS`에서 complex_id가 같고 `is_cancelled`가 아닌 것 중 contract_date 최대값
- [ ] **Step 4:** 테스트 PASS
- [ ] **Step 5:** 커밋 `feat: 관심 단지·지역 샘플 서버 (#140)`

### Task 2: 관심 상태 컨텍스트와 ☆ 버튼

**Files:**
- Create: `src/state/interests.tsx`, `src/components/StarButton.tsx`
- Modify: `src/components/ui.tsx` (`Icon`에 `fill?: string` 추가)
- Test: `tests/star-button.test.tsx`

**Interfaces:**
- Consumes: Task 1
- Produces:
  - `useInterestsState(api: InterestsApi, session: Session | null, notify, onLogin): InterestsValue` — 세션이 바뀌면 두 목록을 다시 불러오고, 세션이 없으면 빈 목록
  - `type InterestsValue = { complexes: ComplexInterest[]; regions: RegionInterest[]; hasComplex(id): boolean; hasRegion(code): boolean; toggleComplex(c: ComplexInput): Promise<void>; toggleRegion(r: RegionInput): Promise<void> }`
  - `InterestsContext` (기본값: 아무것도 없고 toggle은 no-op), `InterestsProvider`
  - `<StarButton kind="complex" item={ComplexInput} />` / `<StarButton kind="region" item={RegionInput} />` — 접근성 라벨 "관심 단지 등록"/"관심 단지 해제"(지역도 같은 꼴), 켜지면 `fill={C.primary}`

- [ ] **Step 1: 실패하는 테스트** (Provider로 감싸 렌더)
  - 세션 없음: ☆ 누르면 notify("로그인하면 관심 등록할 수 있어요")와 onLogin 호출
  - 세션 있음: 누르면 라벨이 "관심 단지 해제"로, notify("관심 단지에 담았어요"); 다시 누르면 "관심 단지에서 뺐어요"
  - 지역 10개 찬 상태에서 새 지역 ☆ → notify("관심 지역은 10개까지예요"), 라벨은 "관심 지역 등록" 그대로
  - 세션을 다른 사용자로 바꿔 렌더하면 이전 사용자의 ☆가 꺼져 있다
- [ ] **Step 2:** FAIL 확인
- [ ] **Step 3:** 구현. toggle 중엔 버튼 `disabled`
- [ ] **Step 4:** PASS
- [ ] **Step 5:** 커밋 `feat: 관심 ☆ 버튼과 상태 (#140)`

### Task 3: 시트와 App 연결

**Files:**
- Modify: `src/screens/MarketSheets.tsx` (ComplexContent의 점선 ☆ Pressable → `StarButton`; RegionContent 제목 줄에 `isDong(marker.region_code)`일 때만 `StarButton`)
- Modify: `App.tsx` (`SampleInterests` 인스턴스, `useInterestsState`, `InterestsProvider`로 감싸기, 탈퇴 시 `interests.clear(session)`)
- Test: `tests/interests-sheet.test.tsx`

- [ ] **Step 1: 실패하는 테스트**: 기존 시트 테스트(`tests/hospital-sheet.test.tsx` 등) 렌더 방식을 따라 ComplexContent에 "관심 단지 등록" 버튼이 있고 "2차에서 열려요" 문구가 없다; RegionContent는 동(2635010500)에서 "관심 지역 등록"이 있고 구(26350)에서는 없다
- [ ] **Step 2:** FAIL 확인 → **Step 3:** 구현 → **Step 4:** `npx vitest run` 전체 PASS
- [ ] **Step 5:** 커밋 `feat: 단지·지역 시트에 관심 등록 연결 (#140)`

### Task 4: 관심 목록 화면

**Files:**
- Create: `src/screens/InterestsScreen.tsx`
- Modify: `src/screens/MoreScreen.tsx` (로그인 카드 아래 "관심 목록" 행, `onInterests?: () => void`, 오른쪽에 개수), `App.tsx` (route `{ kind: "interests" }`)
- Test: `tests/interests-screen.test.tsx`

**Interfaces:**
- `InterestsScreen({ onBack, onComplex(id: string), onRegion(r: RegionInterest), unit }: ...)` — 컨텍스트에서 목록을 읽음
- App: `onComplex` → 기존 `openComplex(id)`; `onRegion` → `select({ type: "region", region_code, region_level: "dong", name, lat, lng })`
- 로그인 안 한 상태에서 "관심 목록"을 누르면 로그인 화면으로

- [ ] **Step 1: 실패하는 테스트**
  - 탭 라벨 "단지 2", "지역 1/10"
  - 단지 행: 이름, 최근 거래 가격(`priceLabel`), 행 누르면 onComplex(id)
  - 지역 탭 행 누르면 onRegion 호출; ★ 누르면 행이 사라진다
  - 빈 목록이면 "지도에서 ☆를 눌러 담아 보세요"
- [ ] **Step 2:** FAIL → **Step 3:** 구현(Header·Section 등 기존 ui 재사용) → **Step 4:** 전체 PASS, `npx tsc --noEmit` 통과
- [ ] **Step 5:** 커밋 `feat: 관심 목록 화면 (#140)`

### Task 5: 화면 확인과 PR

- [ ] 웹 미리보기(sample 모드)에서: 로그인 → 단지 ☆ → 동 ☆ → 더보기 → 관심 목록 → 항목 눌러 지도 이동 → 로그아웃 후 ☆ 꺼짐 확인, 스크린샷
- [ ] push 후 base `137-auth-screens`로 PR, `Closes #140`, 라벨 enhancement·size:M. 머지는 하지 않는다
