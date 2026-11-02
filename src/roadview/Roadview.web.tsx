import React, { useEffect, useRef } from "react";
import {
  KAKAO_KEY,
  ROADVIEW_RADIUS,
  webRuntime,
  type RoadviewStatus,
} from "../map/kakaoRuntime";

// 로드뷰 (웹). 카카오 런타임을 이 div에서 바로 실행한다
export default function Roadview(p: {
  lat: number;
  lng: number;
  onStatus: (s: RoadviewStatus) => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const latest = useRef(p);
  latest.current = p;

  useEffect(() => {
    const receive = webRuntime().roadview(
      el.current!,
      { key: KAKAO_KEY, lat: p.lat, lng: p.lng, radius: ROADVIEW_RADIUS },
      (m) => latest.current.onStatus(m.status),
    );
    const resize = new ResizeObserver(() => receive({ type: "resize" }));
    resize.observe(el.current!);
    return () => {
      resize.disconnect();
      receive({ type: "destroy" });
    };
  }, [p.lat, p.lng]);

  // 카카오가 내부 레이어에 큰 z-index를 써서, 지도 위 버튼을 가리지 않게 쌓임 맥락을 따로 만든다
  return (
    <div
      ref={el}
      style={{ width: "100%", height: "100%", position: "relative", isolation: "isolate" }}
    />
  );
}
