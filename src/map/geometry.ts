import type { Geometry, Position } from "geojson";
import type { BBox } from "../api/types";

// 앱 줌 z에서 1px당 미터(카카오 레벨 L = 18 - z, 1px = 2^(L-3)m)
const metersPerPx = (zoom: number): number => 2 ** (15 - zoom);
// 위도·경도 1도의 미터(근사)
const METERS_PER_DEG = 111320;

// 다각형 경계의 bbox(min_lng, min_lat, max_lng, max_lat). 꼭짓점이 없으면 null
export function geometryBBox(g: Geometry): BBox | null {
  const points: Position[] =
    g.type === "Polygon"
      ? g.coordinates.flat()
      : g.type === "MultiPolygon"
        ? g.coordinates.flat(2)
        : [];
  if (!points.length) return null;
  const lngs = points.map((p) => p[0]);
  const lats = points.map((p) => p[1]);
  return [
    Math.min(...lngs),
    Math.min(...lats),
    Math.max(...lngs),
    Math.max(...lats),
  ];
}

// 경계가 화면 가로·세로 px 안에 들어오는 가장 큰 줌. 학교 마커가 보이는 14 아래로는 내리지 않는다
export function fitZoom(bbox: BBox, viewPx = 640, min = 14, max = 16): number {
  const [w, s, e, n] = bbox;
  const width = (e - w) * Math.cos((((s + n) / 2) * Math.PI) / 180) * METERS_PER_DEG;
  const height = (n - s) * METERS_PER_DEG;
  const span = Math.max(width, height);
  let zoom = max;
  while (zoom > min && span > viewPx * metersPerPx(zoom)) zoom -= 1;
  return zoom;
}
