import type { Geometry, Position } from "geojson";
import type { BBox } from "../api/types";

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

// 점(lng, lat)이 다각형 안에 있는지. 바깥 고리 안이면서 구멍(안쪽 고리) 밖이어야 한다
export function containsPoint(g: Geometry, lng: number, lat: number): boolean {
  const polygons =
    g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
  return polygons.some(
    ([outer, ...holes]) =>
      !!outer && inRing(outer, lng, lat) && !holes.some((h) => inRing(h, lng, lat)),
  );
}

// 반직선 교차 수로 고리 안을 판정한다
function inRing(ring: Position[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
}
