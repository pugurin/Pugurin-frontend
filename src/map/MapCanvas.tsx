import React, { useEffect, useMemo, useRef } from "react";
import { WebView } from "react-native-webview";
import { KAKAO_APP_URL, KAKAO_KEY, kakaoMapDocument } from "./kakaoRuntime";
import {
  fullState,
  handleRuntimeMessage,
  layerState,
  markerState,
  shapeState,
  type RuntimeMessage,
} from "./bridge";
import type { MapProps } from "./types";

// 실거래가 지도 (iOS/Android). 카카오 지도 SDK는 웹 전용이라 WebView 안에서 같은 런타임을 실행한다
export default function MapCanvas(p: MapProps) {
  const web = useRef<WebView>(null);
  const booted = useRef(false);
  const latest = useRef(p);
  latest.current = p;
  // 처음 위치로만 문서를 만든다. 이후 이동은 명령으로 보낸다
  const html = useMemo(
    () => kakaoMapDocument({ key: KAKAO_KEY, ...p.initial }),
    [],
  );

  const post = (m: object) => {
    if (!booted.current) return;
    web.current?.injectJavaScript(
      `window.pugurinReceive&&window.pugurinReceive(${JSON.stringify(m)});true;`,
    );
  };

  useEffect(() => post(markerState(p)), [p.markers, p.auctions, p.property, p.unit, p.selected]);
  useEffect(() => post(layerState(p)), [p.base, p.cadastral]);
  useEffect(
    () => post(shapeState(p)),
    [p.selectionPoint, p.parcelGeometry, p.userLocation],
  );
  useEffect(() => {
    if (p.command) post(p.command);
  }, [p.command]);

  return (
    <WebView
      ref={web}
      style={{ flex: 1 }}
      originWhitelist={["*"]}
      // 카카오 SDK는 문서 주소로 도메인을 확인한다. 등록한 https 주소를 문서 주소로 쓴다
      source={{ html, baseUrl: KAKAO_APP_URL }}
      scrollEnabled={false}
      bounces={false}
      overScrollMode="never"
      setSupportMultipleWindows={false}
      onMessage={(e) => {
        let m: RuntimeMessage;
        try {
          m = JSON.parse(e.nativeEvent.data);
        } catch {
          return;
        }
        if (m.type === "boot") {
          booted.current = true;
          post(fullState(latest.current));
          return;
        }
        handleRuntimeMessage(m, latest.current);
      }}
      onError={() =>
        latest.current.onEvent({ type: "error", message: "지도를 불러올 수 없어요" })
      }
    />
  );
}
