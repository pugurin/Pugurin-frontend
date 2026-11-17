import type {
  Redevelopment,
  RedevelopmentKind,
  RedevelopmentStage,
} from "../api/types";

// 진행 중인 구역 마커 색(흰 바탕 위 굵은 글자 대비 4.5:1 이상)
export const REDEVELOPMENT_COLOR = "#C2410C";
// 해제·준공 등 끝난 구역 마커 색
export const REDEVELOPMENT_DONE_COLOR = "#6B6B66";
// 재개발 마커를 요청하는 최소 줌. 부산 전체가 349곳이라 동 단위부터 띄운다
export const REDEVELOPMENT_MIN_ZOOM = 12;
// 화면 영역 하나에서 받는 구역 수(서버 page_size 최대)
export const REDEVELOPMENT_LIMIT = 500;
export const REDEVELOPMENT_SOURCE = "부산광역시 정비사업 정보";

export const REDEVELOPMENT_KIND_LABEL: Record<RedevelopmentKind, string> = {
  redevelopment: "재개발",
  reconstruction: "재건축",
  small_reconstruction: "소규모재건축",
  small_redevelopment: "소규모재개발",
  street_housing: "가로주택정비",
  residential_improvement: "주거환경개선",
  urban_environment: "도시환경정비",
  other: "정비사업",
};

// 사업 진행 단계. 시트의 진행 표시 순서이며, 짧은 이름은 마커와 진행 표시에 쓴다
export const REDEVELOPMENT_STEPS = [
  { stage: "planned", short: "정비예정", label: "정비예정구역·기본계획" },
  { stage: "designated", short: "구역지정", label: "정비계획 수립·구역 지정" },
  { stage: "committee", short: "추진위", label: "추진위원회 구성" },
  { stage: "association", short: "조합설립", label: "조합설립인가" },
  { stage: "review", short: "건축심의", label: "건축심의·통합심의" },
  { stage: "project_approved", short: "사업시행", label: "사업시행계획인가" },
  { stage: "disposal_approved", short: "관리처분", label: "관리처분계획인가" },
  { stage: "construction", short: "착공", label: "이주·철거·착공" },
  { stage: "completed", short: "준공", label: "준공" },
] as const satisfies readonly {
  stage: RedevelopmentStage;
  short: string;
  label: string;
}[];

// 진행 표시 밖의 단계
const OTHER_STAGE: Partial<Record<RedevelopmentStage, string>> = {
  cancelled: "해제",
  transferred: "이전고시",
  dissolved: "조합해산",
};

// 지도에 띄우는 단계. 해제·준공 이후 구역은 지도에서 뺀다(목록용)
export const REDEVELOPMENT_MAP_STAGES: readonly RedevelopmentStage[] = [
  ...REDEVELOPMENT_STEPS.filter((x) => x.stage !== "completed").map(
    (x) => x.stage,
  ),
  "unknown",
];

// 끝난 구역인지(해제·준공·이전고시·조합해산)
export function isDone(r: Redevelopment): boolean {
  return ["cancelled", "completed", "transferred", "dissolved"].includes(
    r.stage,
  );
}

// 마커·시트에 쓰는 단계 이름. 표에 없는 단계는 원문을 쓴다
export function stageShort(r: Redevelopment): string {
  const step = REDEVELOPMENT_STEPS.find((x) => x.stage === r.stage);
  return step?.short ?? OTHER_STAGE[r.stage] ?? r.step_raw ?? "단계 미상";
}

// 진행 표시에서 지금 단계의 위치(0부터). 진행 표시 밖이면 -1
export function stepIndex(r: Redevelopment): number {
  if (r.stage === "transferred" || r.stage === "dissolved")
    return REDEVELOPMENT_STEPS.length - 1;
  return REDEVELOPMENT_STEPS.findIndex((x) => x.stage === r.stage);
}

// 마커에 쓰는 짧은 구역명. 끝의 "구역 재개발" 같은 사업 이름 꼬리를 떼고 12자까지
export function shortAreaName(name: string): string {
  const short = name
    .replace(/\s*(주택)?(재개발|재건축|가로주택정비|정비)(사업|정비사업)?(조합)?$/, "")
    .trim();
  const v = short || name;
  return v.length > 12 ? `${v.slice(0, 11)}…` : v;
}

// 원천이 빈 값을 0·1로 채운 숫자 칸. 이 값 이하는 값 없음으로 본다
const PLACEHOLDER_MAX = 1;
// 이보다 작은 구역 면적(㎡)은 입력 오류로 본다(원천에 1㎡, 10㎡ 같은 값이 있다)
const MIN_AREA_M2 = 100;
// 원천이 빈 글자 칸에 넣은 값
const PLACEHOLDER_TEXT = new Set(["", "0", "1", "-"]);

const realCount = (v: number | null) =>
  v != null && v > PLACEHOLDER_MAX ? v : null;

const realText = (v: string | null) =>
  v == null || PLACEHOLDER_TEXT.has(v.trim()) ? null : v.trim();

// 000-0000-0000, 051-000-0000, 0-0-0처럼 자리만 채운 번호는 뺀다
export function realTel(v: string | null): string | null {
  const tel = realText(v);
  if (!tel) return null;
  const groups = tel.split(/\D+/).filter(Boolean);
  if (groups.join("").length < 9) return null;
  if (groups.length >= 2 && /^0+$/.test(groups[1])) return null;
  return tel;
}

// 파일명 없이 폴더 주소만 온 사진은 열리지 않으니 뺀다
const realImage = (v: string | null) =>
  v && !v.endsWith("/") ? v : null;

// 실데이터의 자리 채움 값을 값 없음(null)으로 바꾼다. 화면에 "용적률 0%"·가짜 전화번호가 뜨지 않게 한다
export function cleanRedevelopment(r: Redevelopment): Redevelopment {
  const areaOk = r.area_m2 != null && r.area_m2 >= MIN_AREA_M2;
  const images = r.images && {
    view: realImage(r.images.view),
    location: realImage(r.images.location),
    panorama: realImage(r.images.panorama),
    layout: realImage(r.images.layout),
  };
  return {
    ...r,
    area_m2: areaOk ? r.area_m2 : null,
    area_pyeong: areaOk ? r.area_pyeong : null,
    households: realCount(r.households),
    buildings: realCount(r.buildings),
    union_members: realCount(r.union_members),
    floor_area_ratio: realCount(r.floor_area_ratio),
    building_coverage_ratio: realCount(r.building_coverage_ratio),
    scale: realText(r.scale),
    business_entity: realText(r.business_entity),
    contractor: realText(r.contractor),
    engineer: realText(r.engineer),
    architect: realText(r.architect),
    specialists: realText(r.specialists),
    tel: realTel(r.tel),
    images: images && Object.values(images).some(Boolean) ? images : null,
  };
}
