// 대중교통 길찾기(집 → 직장). 백엔드가 ODsay를 서버 키로 대신 호출해 이 모양으로 준다.
// 요청 규격은 docs/BACKEND_TRANSIT_REQUEST.md
import type { Envelope } from "./types";

export type LatLng = { lat: number; lng: number };
// 걷기·버스·지하철 외 수단(기차·고속/시외버스 등)은 "etc"로 묶는다
export type TransitMode = "walk" | "bus" | "subway" | "etc";
export type TransitLeg = {
  mode: TransitMode;
  minutes: number;
  distance_m: number;
  // 걷기 구간은 null
  line: { name: string; color: string | null } | null;
  start_name: string | null;
  end_name: string | null;
  // 탄 정류장 수. 걷기는 null
  stop_count: number | null;
};
export type TransitRoute = {
  total_minutes: number;
  transfer_count: number;
  // 원. 모르면 null
  fare: number | null;
  walk_minutes: number;
  distance_m: number;
  legs: TransitLeg[];
};
// too_close: 출발·도착이 가까워 걸어가는 게 나음(ODsay는 700m 이내면 경로를 주지 않음)
// no_route: 대중교통 경로 없음 / source_unavailable: 공급처 장애·호출 한도 초과(다시 시도할 수 있음)
// not_ready: 백엔드에 길찾기 API가 아직 없음(404). 다시 시도해도 같다
export type TransitUnavailable =
  "too_close" | "no_route" | "source_unavailable" | "not_ready";
export type TransitResult = {
  routes: TransitRoute[];
  unavailable_reason: TransitUnavailable | null;
};

export const TRANSIT_ROUTE_LIMIT = 3;
// 좌표는 소수 3자리(약 100m)로 줄여 보낸다. 직장 위치를 정밀하게 남기지 않고, 서버 캐시도 잘 맞는다
const coord = (n: number) => n.toFixed(3);
export function transitQuery(
  from: LatLng,
  to: LatLng,
  limit = TRANSIT_ROUTE_LIMIT,
) {
  return new URLSearchParams({
    from_lat: coord(from.lat),
    from_lng: coord(from.lng),
    to_lat: coord(to.lat),
    to_lng: coord(to.lng),
    limit: String(limit),
  }).toString();
}

// 두 좌표 사이 직선거리(m)
export function distanceM(a: LatLng, b: LatLng) {
  const r = Math.PI / 180;
  const h =
    Math.sin(((b.lat - a.lat) * r) / 2) ** 2 +
    Math.cos(a.lat * r) *
      Math.cos(b.lat * r) *
      Math.sin(((b.lng - a.lng) * r) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

export const TOO_CLOSE_M = 700;
const BUS = { name: "샘플 버스 1001", color: "#3B82F6" };
const SUBWAY = { name: "샘플 지하철 2호선", color: "#22C55E" };
// 샘플 모드: 직선거리로 그럴듯한 경로 2개를 만든다(지하철 위주·버스 위주). 실제 경로가 아니다
export function sampleTransit(
  from: LatLng,
  to: LatLng,
): Envelope<TransitResult> {
  const d = distanceM(from, to);
  if (d <= TOO_CLOSE_M)
    return { data: { routes: [], unavailable_reason: "too_close" } };
  // 실제 이동거리는 직선의 1.3배쯤
  const ride = Math.round(d * 1.3);
  const walk = (
    m: number,
    start: string | null,
    end: string | null,
  ): TransitLeg => ({
    mode: "walk",
    minutes: Math.max(1, Math.round(m / 67)),
    distance_m: m,
    line: null,
    start_name: start,
    end_name: end,
    stop_count: null,
  });
  const make = (legs: TransitLeg[], fare: number): TransitRoute => ({
    total_minutes: legs.reduce((s, l) => s + l.minutes, 0),
    transfer_count: Math.max(
      0,
      legs.filter((l) => l.mode !== "walk").length - 1,
    ),
    fare,
    walk_minutes: legs
      .filter((l) => l.mode === "walk")
      .reduce((s, l) => s + l.minutes, 0),
    distance_m: legs.reduce((s, l) => s + l.distance_m, 0),
    legs,
  });
  const subway = make(
    [
      walk(400, null, "출발역"),
      {
        mode: "subway",
        // 지하철은 분당 약 600m + 역마다 정차
        minutes: Math.round(ride / 600) + 2,
        distance_m: ride,
        line: SUBWAY,
        start_name: "출발역",
        end_name: "도착역",
        stop_count: Math.max(1, Math.round(ride / 1200)),
      },
      walk(300, "도착역", null),
    ],
    1550,
  );
  const bus = make(
    [
      walk(200, null, "출발 정류장"),
      {
        mode: "bus",
        minutes: Math.round(ride / 350) + 3,
        distance_m: ride,
        line: BUS,
        start_name: "출발 정류장",
        end_name: "도착 정류장",
        stop_count: Math.max(1, Math.round(ride / 500)),
      },
      walk(250, "도착 정류장", null),
    ],
    1550,
  );
  const routes = [subway, bus].sort(
    (a, b) => a.total_minutes - b.total_minutes,
  );
  return { data: { routes, unavailable_reason: null } };
}
