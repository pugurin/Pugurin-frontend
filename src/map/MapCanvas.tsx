import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  GeoJSONSource,
  Images,
  Layer,
  Map,
  type CameraRef,
  type MapRef,
  type StyleSpecification,
} from "@maplibre/maplibre-react-native";
import type { BBox } from "../api/types";
import {
  baseStyle,
  fromMapZoom,
  koreanLabels,
  MARKER_DOT_LAYER,
  MARKER_LABEL_LAYER,
  MARKER_SOURCE,
  markerFeatures,
  MAX_ZOOM,
  MIN_ZOOM,
  OPENFREEMAP_STYLE,
  toMapZoom,
} from "./style";
import type { MapProps } from "./types";

// 마커 배경(둥근 사각형). 웹은 MapCanvas.web.tsx에서 캔버스로 그린다
const MARKER_IMAGES = {
  "box-apartment": require("../../assets/map/box-apartment.png"),
  "box-officetel": require("../../assets/map/box-officetel.png"),
  "box-villa": require("../../assets/map/box-villa.png"),
  "box-land": require("../../assets/map/box-land.png"),
  "box-selected": require("../../assets/map/box-selected.png"),
} as const;


// 실거래가 지도 (iOS/Android). MapLibre RN으로 VWorld 또는 OpenFreeMap 배경 위에 마커를 그린다
export default function MapCanvas(p: MapProps) {
  const map = useRef<MapRef>(null);
  const camera = useRef<CameraRef>(null);
  const zoom = useRef(toMapZoom(p.initial.zoom));
  const loaded = useRef(false);
  const [freeStyle, setFreeStyle] = useState<StyleSpecification | null>(null);

  useEffect(() => {
    fetch(OPENFREEMAP_STYLE)
      .then((r) => r.json())
      .then((s: StyleSpecification) => setFreeStyle(koreanLabels(s)))
      .catch(() =>
        p.onEvent({ type: "error", message: "지도를 불러올 수 없어요" }),
      );
  }, []);

  const style = useMemo(
    () => baseStyle(p.base, p.cadastral, freeStyle),
    [p.base, p.cadastral, freeStyle],
  );
  const data = useMemo(
    () => markerFeatures(p.markers, p.property, p.unit, p.selected),
    [p.markers, p.property, p.unit, p.selected],
  );

  useEffect(() => {
    const c = p.command;
    if (!c || !camera.current) return;
    if (c.type === "zoom") {
      const next = Math.round(zoom.current) + Math.sign(c.delta);
      camera.current.zoomTo(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, next)), {
        duration: 260,
      });
    } else if (c.bbox) {
      camera.current.fitBounds(c.bbox, { duration: 360 });
    } else if (c.lat != null && c.lng != null) {
      camera.current.easeTo({
        center: [c.lng, c.lat],
        ...(c.zoom != null && { zoom: toMapZoom(c.zoom) }),
        duration: 360,
      });
    } else if (c.zoom != null) {
      camera.current.zoomTo(toMapZoom(c.zoom), { duration: 360 });
    }
  }, [p.command]);

  return (
    <Map
      ref={map}
      style={{ flex: 1 }}
      mapStyle={style}
      touchRotate={false}
      touchPitch={false}
      logo={false}
      attributionPosition={{ bottom: 6, left: 6 }}
      onDidFinishLoadingStyle={() => {
        if (loaded.current) return;
        loaded.current = true;
        p.onEvent({ type: "ready" });
      }}
      onDidFailLoadingMap={() =>
        p.onEvent({ type: "error", message: "지도를 불러올 수 없어요" })
      }
      onRegionDidChange={(e) => {
        const { center, zoom: z, bounds } = e.nativeEvent;
        zoom.current = z;
        p.onEvent({
          type: "camera",
          lng: center[0],
          lat: center[1],
          zoom: fromMapZoom(z),
          bbox: bounds as BBox,
        });
      }}
      onPress={async (e) => {
        // 글자 박스를 먼저, 없으면 점을 찾는다(겹친 마커 중 실제로 누른 것을 고르기 위해)
        const point = e.nativeEvent.point;
        let hit = await map.current?.queryRenderedFeatures(point, {
          layers: [MARKER_LABEL_LAYER.id],
        });
        if (!hit?.length)
          hit = await map.current?.queryRenderedFeatures(point, {
            layers: [MARKER_DOT_LAYER.id],
          });
        const id = hit?.[0]?.properties?.id;
        p.onEvent(id ? { type: "marker", id: String(id) } : { type: "mapClick" });
      }}
    >
      <Camera
        ref={camera}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        initialViewState={{
          center: [p.initial.lng, p.initial.lat],
          zoom: toMapZoom(p.initial.zoom),
        }}
      />
      <Images images={MARKER_IMAGES} />
      <GeoJSONSource id={MARKER_SOURCE} data={data}>
        <Layer {...MARKER_DOT_LAYER} />
        <Layer {...MARKER_LABEL_LAYER} />
      </GeoJSONSource>
    </Map>
  );
}
