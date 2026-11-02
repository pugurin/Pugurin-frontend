import React, { useMemo } from "react";
import { WebView } from "react-native-webview";
import {
  KAKAO_APP_URL,
  KAKAO_KEY,
  ROADVIEW_RADIUS,
  roadviewDocument,
  type RoadviewStatus,
} from "../map/kakaoRuntime";

// 로드뷰 (iOS/Android). 지도와 같이 WebView 안에서 카카오 런타임을 실행한다
export default function Roadview(p: {
  lat: number;
  lng: number;
  onStatus: (s: RoadviewStatus) => void;
}) {
  const html = useMemo(
    () =>
      roadviewDocument({
        key: KAKAO_KEY,
        lat: p.lat,
        lng: p.lng,
        radius: ROADVIEW_RADIUS,
      }),
    [p.lat, p.lng],
  );
  return (
    <WebView
      style={{ flex: 1 }}
      originWhitelist={["*"]}
      source={{ html, baseUrl: KAKAO_APP_URL }}
      setSupportMultipleWindows={false}
      onMessage={(e) => {
        try {
          const m = JSON.parse(e.nativeEvent.data);
          if (m.type === "roadview") p.onStatus(m.status);
        } catch {}
      }}
      onError={() => p.onStatus("error")}
    />
  );
}
