import React, { useEffect, useRef } from "react";
import { KAKAO_KEY, webRuntime } from "./kakaoRuntime";
import {
  fullState,
  handleRuntimeMessage,
  layerState,
  markerState,
  shapeState,
} from "./bridge";
import type { MapProps } from "./types";

// 실거래가 지도 (웹). 카카오 지도 런타임을 이 div에서 바로 실행한다
export default function MapCanvas(p: MapProps) {
  const el = useRef<HTMLDivElement>(null);
  const receive = useRef<((m: unknown) => void) | null>(null);
  const latest = useRef(p);
  latest.current = p;

  useEffect(() => {
    const start = webRuntime().map;
    const r = start(
      el.current!,
      { key: KAKAO_KEY, ...latest.current.initial },
      (m) => handleRuntimeMessage(m, latest.current),
    );
    receive.current = r;
    r(fullState(latest.current));
    const resize = new ResizeObserver(() => r({ type: "resize" }));
    resize.observe(el.current!);
    return () => {
      resize.disconnect();
      r({ type: "destroy" });
      receive.current = null;
    };
  }, []);

  useEffect(() => {
    receive.current?.(markerState(p));
    p.onMarkerHover?.(null);
  }, [p.markers, p.auctions, p.schools, p.property, p.unit, p.selected]);

  useEffect(() => {
    receive.current?.(layerState(p));
  }, [p.base, p.cadastral, p.roadview]);

  useEffect(() => {
    receive.current?.(shapeState(p));
  }, [p.selectionPoint, p.parcelGeometry, p.userLocation, p.hospitalAreas, p.schoolZone]);

  useEffect(() => {
    if (p.command) receive.current?.(p.command);
  }, [p.command]);

  // 카카오가 내부 레이어에 큰 z-index를 써서, 지도 위 버튼을 가리지 않게 쌓임 맥락을 따로 만든다
  return (
    <div
      ref={el}
      style={{ width: "100%", height: "100%", position: "relative", isolation: "isolate" }}
    />
  );
}
