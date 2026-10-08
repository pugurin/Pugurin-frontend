import React, { useEffect, useRef, useState } from "react";
import {
  setWorkerUrl,
  Map as MapLibre,
  type GeoJSONSource,
  type LayerSpecification as WebLayer,
  type StyleSpecification as WebStyle,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { StyleSpecification } from "@maplibre/maplibre-gl-style-spec";
import type { BBox } from "../api/types";
import {
  baseStyle,
  fromMapZoom,
  koreanLabels,
  MARKER_COLOR,
  MARKER_DOT_LAYER,
  MARKER_LABEL_LAYER,
  MARKER_SOURCE,
  markerFeatures,
  MAX_ZOOM,
  MIN_ZOOM,
  OPENFREEMAP_STYLE,
  SELECTED_COLOR,
  toMapZoom,
} from "./style";
import type { MapProps } from "./types";

// Metro가 maplibre-gl 워커를 번들하지 못해 public/maplibre/에 복사해 둔 파일을 쓴다 (scripts/copy-maplibre-worker.mjs)
setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

// 마커 배경(둥근 사각형)을 캔버스로 그린다. 앱은 assets/map/box-*.png를 쓴다
const BOX = 48, RADIUS = 16;
function boxImage(color: string) {
  const size = BOX, r = RADIUS;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(0, 0, size, size, r);
  ctx.fill();
  return ctx.getImageData(0, 0, size, size);
}

// 실거래가 지도 (웹). maplibre-gl로 앱과 같은 스타일·마커 레이어를 그린다
export default function MapCanvas(p: MapProps) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibre | null>(null);
  const latest = useRef(p);
  latest.current = p;
  const [freeStyle, setFreeStyle] = useState<StyleSpecification | null>(null);

  // isStyleLoaded()는 타일까지 다 받아야 true라서, style.load 기준으로 직접 표시한다
  const styleReady = useRef(false);
  // 마커 소스·레이어를 현재 props로 맞춘다. 스타일을 바꾸는 중에는 건드리지 않고 style.load 때 다시 부른다
  const syncMarkers = (m: MapLibre) => {
    if (!styleReady.current) return;
    const { markers, property, unit, selected } = latest.current;
    const data = markerFeatures(markers, property, unit, selected);
    const source = m.getSource(MARKER_SOURCE) as GeoJSONSource | undefined;
    if (source) source.setData(data);
    else {
      m.addSource(MARKER_SOURCE, { type: "geojson", data });
      m.addLayer(MARKER_DOT_LAYER as WebLayer);
      m.addLayer(MARKER_LABEL_LAYER as WebLayer);
    }
  };

  useEffect(() => {
    fetch(OPENFREEMAP_STYLE)
      .then((r) => r.json())
      .then((s: StyleSpecification) => setFreeStyle(koreanLabels(s)))
      .catch(() =>
        latest.current.onEvent({ type: "error", message: "지도를 불러올 수 없어요" }),
      );
  }, []);

  useEffect(() => {
    const m = new MapLibre({
      container: el.current!,
      style: baseStyle(p.base, p.cadastral, null) as WebStyle,
      center: [p.initial.lng, p.initial.lat],
      zoom: toMapZoom(p.initial.zoom),
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
      dragRotate: false,
      pitchWithRotate: false,
      attributionControl: { compact: true },
    });
    m.touchZoomRotate.disableRotation();
    map.current = m;
    const emit = () => {
      const c = m.getCenter(), b = m.getBounds();
      latest.current.onEvent({
        type: "camera",
        lat: c.lat,
        lng: c.lng,
        zoom: fromMapZoom(m.getZoom()),
        bbox: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()] as BBox,
      });
    };
    // 스타일이 바뀔 때마다 마커 이미지·소스·레이어를 다시 얹는다
    m.on("style.load", () => {
      styleReady.current = true;
      const colors = { ...MARKER_COLOR, selected: SELECTED_COLOR };
      Object.entries(colors).forEach(([k, c]) => {
        if (!m.hasImage(`box-${k}`)) m.addImage(`box-${k}`, boxImage(c), {
            pixelRatio: 2,
            // 모서리는 그대로 두고 가운데만 늘린다(9-slice)
            stretchX: [[RADIUS, BOX - RADIUS]],
            stretchY: [[RADIUS, BOX - RADIUS]],
          });
      });
      syncMarkers(m);
    });
    m.once("load", () => {
      latest.current.onEvent({ type: "ready" });
      emit();
    });
    m.on("moveend", emit);
    m.on("click", (e) => {
      const hit = m.getLayer(MARKER_DOT_LAYER.id)
        ? m.queryRenderedFeatures(e.point, { layers: [MARKER_LABEL_LAYER.id, MARKER_DOT_LAYER.id] })
        : [];
      const id = hit[0]?.properties?.id;
      latest.current.onEvent(id ? { type: "marker", id: String(id) } : { type: "mapClick" });
    });
    // 처음 지도를 띄우지 못한 경우만 화면에 알린다(타일 하나가 실패한 것은 무시)
    m.on("error", (e) => {
      if (!m.loaded() && !m.isStyleLoaded())
        latest.current.onEvent({ type: "error", message: "지도를 불러올 수 없어요" });
      console.warn("[map]", e.error?.message);
    });
    return () => m.remove();
  }, []);

  useEffect(() => {
    // diff로 바꾸면 마커 레이어가 지워진 채 style.load가 오지 않아서, 항상 새로 만든다
    styleReady.current = false;
    map.current?.setStyle(baseStyle(p.base, p.cadastral, freeStyle) as WebStyle, {
      diff: false,
    });
  }, [p.base, p.cadastral, freeStyle]);

  useEffect(() => {
    if (map.current) syncMarkers(map.current);
  }, [p.markers, p.property, p.unit, p.selected]);

  useEffect(() => {
    const m = map.current, c = p.command;
    if (!m || !c) return;
    if (c.type === "zoom") {
      const next = Math.round(m.getZoom()) + Math.sign(c.delta);
      m.zoomTo(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, next)), { duration: 260 });
    } else if (c.bbox) {
      m.fitBounds(c.bbox, { duration: 360 });
    } else {
      m.easeTo({
        ...(c.lat != null && c.lng != null && { center: [c.lng, c.lat] as [number, number] }),
        ...(c.zoom != null && { zoom: toMapZoom(c.zoom) }),
        duration: 360,
      });
    }
  }, [p.command]);

  return <div ref={el} style={{ width: "100%", height: "100%" }} />;
}
