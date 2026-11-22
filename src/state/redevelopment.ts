import type {
  Redevelopment,
  RedevelopmentKind,
  RedevelopmentStage,
  RedevelopmentZone,
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
export const REDEVELOPMENT_ZONE_SOURCE = "브이월드 용도지역지구정보";
// 정비구역 빗금 간격(화면 px). 학구도(빗금 없는 파랑 면)와 구분된다
export const HATCH_SPACING_PX = 10;
// 구역 하나에 긋는 사선 수 상한. 넘으면(멀리서 본 큰 구역) 빗금 없이 면만 칠한다
const HATCH_MAX_LINES = 600;
// 화면 전체에 긋는 사선 수 상한. 넘으면 작은 구역부터 빗금을 빼고 면만 칠한다(사선 하나하나가 지도 도형이라 무겁다)
export const REDEV_HATCH_TOTAL_MAX = 2000;

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

// ── 정비구역 경계 ─────────────────────────────────────

export type LngLat = [number, number];
export type RedevelopmentZoneShape = {
  // 마커 id와 같은 꼴(redevzone:경계ID). 누르면 이 id로 이벤트가 온다
  id: string;
  // GeoJSON MultiPolygon 좌표: 다각형마다 [바깥 고리, 구멍…]
  polygons: LngLat[][][];
  // 구역 안으로 잘라 낸 45° 사선
  hatch: [LngLat, LngLat][];
  // 정비예정구역(아직 지정 전)은 점선 테두리
  dashed: boolean;
};

// 경계 종류 이름(시트 배지)
export const REDEVELOPMENT_ZONE_LAYER_LABEL = {
  zone: "정비구역",
  promotion: "재정비촉진구역",
  planned: "정비예정구역",
} as const;

// 다각형(바깥 고리 + 구멍) 안에만 45° 사선을 spacingM 간격으로 긋는다.
// 구역 첫 점 기준으로 m 평면에 펴서 사선과 변의 교점을 구하고, 짝수-홀수 규칙으로 안쪽 구간만 남긴다
export function hatchSegments(
  rings: LngLat[][],
  spacingM: number,
): [LngLat, LngLat][] {
  const first = rings[0]?.[0];
  if (!first || !(spacingM > 0)) return [];
  const [lng0, lat0] = first;
  const kx = 111320 * Math.cos((lat0 * Math.PI) / 180);
  const ky = 110540;
  const xy = rings.map((ring) =>
    ring.map(([lng, lat]) => [(lng - lng0) * kx, (lat - lat0) * ky]),
  );
  // 사선은 x - y = c. 사선 사이 수직 간격이 spacingM이면 c는 spacingM·√2씩 커진다
  const us = xy.flat().map(([x, y]) => x - y);
  const min = Math.min(...us);
  const max = Math.max(...us);
  const step = spacingM * Math.SQRT2;
  if ((max - min) / step > HATCH_MAX_LINES) return [];
  const back = (c: number, v: number): LngLat => {
    const x = (c + v) / 2;
    const y = (v - c) / 2;
    return [lng0 + x / kx, lat0 + y / ky];
  };
  const out: [LngLat, LngLat][] = [];
  for (let c = Math.ceil(min / step) * step; c <= max; c += step) {
    const vs: number[] = [];
    for (const ring of xy) {
      for (let i = 0; i + 1 < ring.length; i++) {
        const [x1, y1] = ring[i];
        const [x2, y2] = ring[i + 1];
        const u1 = x1 - y1;
        const u2 = x2 - y2;
        // 반열린 구간으로 꼭짓점을 두 번 세지 않는다
        if ((u1 <= c && c < u2) || (u2 <= c && c < u1)) {
          const t = (c - u1) / (u2 - u1);
          vs.push(x1 + t * (x2 - x1) + (y1 + t * (y2 - y1)));
        }
      }
    }
    vs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < vs.length; i += 2)
      out.push([back(c, vs[i]), back(c, vs[i + 1])]);
  }
  return out;
}

// 화면 1px의 길이(m). 앱 줌 = 18 - 카카오 레벨, 카카오 레벨 L에서 1px = 2^(L-3) m
const metersPerPx = (zoom: number) => 2 ** (15 - zoom);

// 지도에 넘길 정비구역 도형. 빗금 간격은 줌에 맞춰 화면에서 늘 HATCH_SPACING_PX가 되게 한다
// 바깥 고리 넓이(경위도 그대로, 크기 비교용)
function ringArea(ring: LngLat[]): number {
  let a = 0;
  for (let k = 0; k < ring.length - 1; k++)
    a += ring[k][0] * ring[k + 1][1] - ring[k + 1][0] * ring[k][1];
  return Math.abs(a) / 2;
}

// 고른 구역 표시는 따로 넘긴다(고르기만 바뀌면 빗금을 다시 계산·그리지 않게)
export function redevelopmentZoneShapes(
  zones: RedevelopmentZone[],
  zoom: number,
): RedevelopmentZoneShape[] {
  const spacing = HATCH_SPACING_PX * metersPerPx(Math.round(zoom));
  const shapes = zones.map((z) => {
    const polygons = z.geometry.coordinates as LngLat[][][];
    return {
      id: `redevzone:${z.zone_id}`,
      polygons,
      hatch: polygons.flatMap((rings) => hatchSegments(rings, spacing)),
      dashed: z.layer === "planned",
      area: polygons.reduce((n, rings) => n + ringArea(rings[0] ?? []), 0),
    };
  });
  // 큰 구역부터 상한까지 빗금을 남긴다
  let left = REDEV_HATCH_TOTAL_MAX;
  const keep = new Set<string>();
  for (const s of [...shapes].sort((a, b) => b.area - a.area)) {
    if (s.hatch.length <= left) {
      keep.add(s.id);
      left -= s.hatch.length;
    }
  }
  return shapes.map(({ area: _area, ...s }) => ({
    ...s,
    hatch: keep.has(s.id) ? s.hatch : [],
  }));
}
