// 앱(MapLibre RN)과 웹(maplibre-gl)이 함께 쓰는 지도 스타일·마커 레이어 정의
import type {
  LayerSpecification,
  StyleSpecification,
} from "@maplibre/maplibre-gl-style-spec";
import type { Marker, Property } from "../api/types";
import { markerId } from "../state/market";
import type { MapProps } from "./types";

const VWORLD_KEY = process.env.EXPO_PUBLIC_VWORLD_KEY ?? "";
const VWORLD_DOMAIN = process.env.EXPO_PUBLIC_VWORLD_DOMAIN ?? "";
export const HAS_VWORLD = VWORLD_KEY.length > 0;

// OpenFreeMap: 키 없이 쓰는 무료 벡터 지도(OpenStreetMap 데이터). VWorld 키가 없을 때의 기본 배경
export const OPENFREEMAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";
const GLYPHS = "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf";
export const MARKER_FONT = ["Noto Sans Bold"];

// MapLibre 줌은 512px 타일 기준이라 화면·API가 쓰는 줌(256px 타일 기준)보다 1 작다
export const toMapZoom = (zoom: number) => zoom - 1;
export const fromMapZoom = (zoom: number) => zoom + 1;
export const MIN_ZOOM = 4;
export const MAX_ZOOM = 19;

export const MARKER_COLOR: Record<Property, string> = {
  apartment: "#3E64A0",
  officetel: "#7B5A9E",
  villa: "#B0506B",
  land: "#4F7A3A",
};
export const SELECTED_COLOR = "#111110";

const vworldWmts = (layer: "Base" | "Satellite") =>
  `https://api.vworld.kr/req/wmts/1.0.0/${VWORLD_KEY}/${layer}/{z}/{y}/{x}.${layer === "Satellite" ? "jpeg" : "png"}`;
const VWORLD_CADASTRAL =
  "https://api.vworld.kr/req/wms?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0" +
  "&LAYERS=lp_pa_cbnd_bubun,lp_pa_cbnd_bonbun&STYLES=lp_pa_cbnd_bubun_line,lp_pa_cbnd_bonbun_line" +
  "&CRS=EPSG:3857&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256&FORMAT=image/png&TRANSPARENT=true" +
  `&KEY=${VWORLD_KEY}&DOMAIN=${encodeURIComponent(VWORLD_DOMAIN)}`;

// OpenFreeMap 지명을 한글 우선으로 바꾼다 ("Busan\n부산" → "부산")
export function koreanLabels(style: StyleSpecification): StyleSpecification {
  const name = [
    "coalesce",
    ["get", "name:ko"],
    ["get", "name:nonlatin"],
    ["get", "name"],
  ];
  return {
    ...style,
    layers: style.layers.map((l) =>
      l.type === "symbol" && l.layout?.["text-field"]
        ? { ...l, layout: { ...l.layout, "text-field": name } }
        : l,
    ) as LayerSpecification[],
  };
}

// 배경 지도 스타일. VWorld 키가 있으면 VWorld 타일, 없으면 OpenFreeMap(받아 둔 스타일)
export function baseStyle(
  base: MapProps["base"],
  cadastral: boolean,
  freeStyle: StyleSpecification | null,
): StyleSpecification {
  const cadastralLayer = HAS_VWORLD && cadastral;
  const style: StyleSpecification =
    HAS_VWORLD || !freeStyle
      ? {
          version: 8,
          glyphs: GLYPHS,
          sources: HAS_VWORLD
            ? {
                vworld: {
                  type: "raster",
                  tiles: [vworldWmts(base === "satellite" ? "Satellite" : "Base")],
                  tileSize: 256,
                  minzoom: 6,
                  maxzoom: 19,
                  attribution: "© VWorld",
                },
              }
            : {},
          layers: [
            { id: "bg", type: "background", paint: { "background-color": "#EDEDE8" } },
            ...(HAS_VWORLD
              ? [{ id: "vworld", type: "raster", source: "vworld" } as LayerSpecification]
              : []),
          ],
        }
      : freeStyle;
  if (!cadastralLayer) return style;
  return {
    ...style,
    sources: {
      ...style.sources,
      cadastral: { type: "raster", tiles: [VWORLD_CADASTRAL], tileSize: 256, minzoom: 14, maxzoom: 19 },
    },
    layers: [...style.layers, { id: "cadastral", type: "raster", source: "cadastral", paint: { "raster-opacity": 0.9 } }],
  };
}

function price(v?: number | null) {
  if (v == null) return "정보 없음";
  return v >= 1e8
    ? (v / 1e8).toFixed(1).replace(/\.0$/, "") + "억"
    : Math.round(v / 1e4).toLocaleString("ko-KR") + "만";
}
const man = (v?: number | null) =>
  v == null ? "—" : Math.round(v / 1e4).toLocaleString("ko-KR");

// 마커 글자 (디자인 W3 표기). region: 지역명 / 대표값 / 건수, 그 외: 금액 / 면적 · 계약월
export function markerLines(m: Marker, unit: MapProps["unit"]) {
  if (m.kind === "region") {
    const s = m.summary;
    const amount =
      s.median_price_per_pyeong != null
        ? "평당 " + price(s.median_price_per_pyeong)
        : s.median_deposit_per_pyeong != null
          ? "평당 보증금 " + price(s.median_deposit_per_pyeong)
          : "보증금 " + man(s.median_deposit) + " · 월 " + man(s.median_monthly_rent);
    return { title: m.name, amount, sub: m.transaction_count.toLocaleString("ko-KR") + "건" };
  }
  const l = m.latest;
  const amount =
    l.deal_type === "sale"
      ? price(l.price)
      : l.deal_type === "jeonse"
        ? "전세 " + price(l.deposit)
        : man(l.deposit) + "/" + man(l.monthly_rent);
  const area = l.land_area_pyeong ?? l.supply_area_pyeong ?? l.exclusive_area_pyeong;
  const prefix = l.supply_area_pyeong == null && l.land_area_pyeong == null ? "전용 " : "";
  const value = area == null ? "—" : unit === "㎡" ? (area * 3.3058).toFixed(1) : String(area);
  return {
    title: "",
    amount,
    sub: `${prefix}${value}${unit} · '${l.contract_date.slice(2, 7).replace("-", ".")}`,
  };
}

// 마커 → GeoJSON. 선택 > 구·동 > 거래 건수 순으로 먼저 자리를 잡는다(겹치면 뒤의 것이 점으로)
export function markerFeatures(
  markers: Marker[],
  property: Property,
  unit: MapProps["unit"],
  selected: string | null,
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: markers.map((m) => {
      const id = markerId(m);
      const isSelected = id === selected;
      const { title, amount, sub } = markerLines(m, unit);
      const count = "transaction_count" in m ? m.transaction_count : 0;
      return {
        type: "Feature",
        id,
        properties: {
          id,
          region: m.kind === "region",
          title,
          amount,
          sub,
          box: isSelected ? "box-selected" : `box-${property}`,
          color: isSelected ? SELECTED_COLOR : MARKER_COLOR[property],
          rank: isSelected ? 0 : m.kind === "region" ? 1 : 2 + 1 / (1 + count),
        },
        geometry: { type: "Point", coordinates: [m.lng, m.lat] },
      };
    }),
  };
}

export const MARKER_SOURCE = "markers";

// 겹쳐서 글자가 숨겨진 마커도 위치가 보이도록 점을 먼저 깐다
export const MARKER_DOT_LAYER: LayerSpecification = {
  id: "marker-dot",
  type: "circle",
  source: MARKER_SOURCE,
  paint: {
    "circle-radius": 6,
    "circle-color": ["get", "color"],
    "circle-stroke-color": "#FFFFFF",
    "circle-stroke-width": 2,
  },
};

export const MARKER_LABEL_LAYER: LayerSpecification = {
  id: "marker-label",
  type: "symbol",
  source: MARKER_SOURCE,
  layout: {
    "symbol-sort-key": ["get", "rank"],
    "icon-image": ["get", "box"],
    "icon-text-fit": "both",
    "icon-text-fit-padding": [4, 9, 4, 9],
    "text-field": [
      "case",
      ["get", "region"],
      ["format", ["get", "title"], { "font-scale": 0.82 }, "\n", {}, ["get", "amount"], {}, "\n", {}, ["get", "sub"], { "font-scale": 0.82 }],
      ["format", ["get", "amount"], {}, "\n", {}, ["get", "sub"], { "font-scale": 0.82 }],
    ],
    "text-font": MARKER_FONT,
    "text-size": 16,
    "text-line-height": 1.2,
    "text-anchor": ["case", ["get", "region"], "center", "bottom"],
    "text-offset": ["case", ["get", "region"], ["literal", [0, 0]], ["literal", [0, -0.75]]],
    "text-allow-overlap": false,
    "icon-allow-overlap": false,
    "text-padding": 3,
  },
  paint: { "text-color": "#FFFFFF" },
};
