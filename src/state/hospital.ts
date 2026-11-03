import type { Hospital } from "../api/types";

// 병원 원·라벨 색
export const HOSPITAL_COLOR = "#0E7FA8";
// 지도에 올리는 병원 종별. 치과·한방·보건소 등은 올리지 않는다. 순서가 묶기 순서다
export const HOSPITAL_TIERS = ["general", "hospital", "clinic"] as const;
// 병원 원을 요청하는 최소 줌. 학교 레이어와 같다
export const HOSPITAL_MIN_ZOOM = 14;
// 화면 영역 하나에서 받는 병원 수 상한
export const HOSPITAL_LIMIT = 500;
// 병원 데이터 출처 문구
export const HOSPITAL_SOURCE = "건강보험심사평가원";

export const HOSPITAL_TIER_LABEL: Record<
  (typeof HOSPITAL_TIERS)[number],
  string
> = {
  general: "종합병원",
  hospital: "병원",
  clinic: "의원",
};

// 한 원으로 묶는 화면 거리(px)
const GROUP_PX = 48;
// 앱 줌 z는 18 - 카카오 레벨이고, 카카오 지도(TM 좌표)는 레벨 L에서 1px이 2^(L-3)m다.
// 그래서 1px당 미터는 2^(15 - 줌)이다(줌 14에서 2m, 48px이면 약 96m)
const metersPerPx = (zoom: number): number => 2 ** (15 - zoom);
// 위도·경도 1도의 미터. 위도는 경도와 같은 값으로 단순화한다(근사 오차는 0.2% 안팎)
const METERS_PER_DEG = 111320;
// 반경 여유와 최소 반경(m)
const RADIUS_PAD_M = 30;
const RADIUS_MIN_M = 40;

export type HospitalArea = {
  id: string;
  lat: number;
  lng: number;
  radius_m: number;
  members: Hospital[];
};

type Placed = Hospital & { lat: number; lng: number };

// 두 지점 사이 거리(m). 가까운 거리용 equirectangular 근사
const distanceM = (
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number => {
  const midRad = (((aLat + bLat) / 2) * Math.PI) / 180;
  const dx = (bLng - aLng) * Math.cos(midRad) * METERS_PER_DEG;
  const dy = (bLat - aLat) * METERS_PER_DEG;
  return Math.hypot(dx, dy);
};

// 종별 → 의사 수 많은 순(null은 0, 종별 안에서 맨 뒤) → id 순
const compare = (a: Hospital, b: Hospital): number => {
  const tier =
    HOSPITAL_TIERS.indexOf(a.tier as (typeof HOSPITAL_TIERS)[number]) -
    HOSPITAL_TIERS.indexOf(b.tier as (typeof HOSPITAL_TIERS)[number]);
  if (tier !== 0) return tier;
  const doctors = (b.doctors ?? 0) - (a.doctors ?? 0);
  if (doctors !== 0) return doctors;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
};

// 화면 거리 48px 안의 병원을 한 원으로 묶는다. 시드는 정렬 앞쪽 병원이다
export function hospitalAreas(list: Hospital[], zoom: number): HospitalArea[] {
  const ordered = list
    .filter(
      (h): h is Placed =>
        h.lat != null &&
        h.lng != null &&
        (HOSPITAL_TIERS as readonly string[]).includes(h.tier),
    )
    .sort(compare);
  const taken = new Set<string>();
  const areas: HospitalArea[] = [];
  for (const seed of ordered) {
    if (taken.has(seed.id)) continue;
    const reach = GROUP_PX * metersPerPx(zoom);
    const members = ordered.filter(
      (h) =>
        !taken.has(h.id) &&
        (h === seed || distanceM(seed.lat, seed.lng, h.lat, h.lng) <= reach),
    );
    members.forEach((h) => taken.add(h.id));
    const lat = members.reduce((s, h) => s + h.lat, 0) / members.length;
    const lng = members.reduce((s, h) => s + h.lng, 0) / members.length;
    const far = Math.max(
      ...members.map((h) => distanceM(lat, lng, h.lat, h.lng)),
    );
    areas.push({
      id: `hospital-area:${seed.id}`,
      lat,
      lng,
      radius_m: Math.max(far + RADIUS_PAD_M, RADIUS_MIN_M),
      members,
    });
  }
  return areas;
}

// "종합병원 2 · 의원 7". 0인 종별은 뺀다
export function tierSummary(members: Hospital[]): string {
  return HOSPITAL_TIERS.map((t) => ({
    label: HOSPITAL_TIER_LABEL[t],
    n: members.filter((h) => h.tier === t).length,
  }))
    .filter((x) => x.n > 0)
    .map((x) => `${x.label} ${x.n}`)
    .join(" · ");
}
