import React, { useEffect, useMemo, useRef, useState } from "react";
import { WebView } from "react-native-webview";
import { mapDocument } from "./document";
import type { MapProps } from "./types";
export default function MapCanvas(p: MapProps) {
  const ref = useRef<WebView<{}>>(null);
  const [ready, setReady] = useState(false);
  const html = useMemo(
    () => mapDocument(process.env.EXPO_PUBLIC_KAKAO_JS_KEY ?? "", p.initial),
    [],
  );
  const send = (message: unknown) =>
    ref.current?.injectJavaScript(
      `window.pugurinReceive(${JSON.stringify(message).replace(/</g, "\\u003c")});true;`,
    );
  useEffect(() => {
    if (ready)
      send({
        type: "state",
        markers: p.markers,
        property: p.property,
        selected: p.selected,
        unit: p.unit,
        base: p.base,
        cadastral: p.cadastral,
      });
  }, [ready, p.markers, p.property, p.selected, p.unit, p.base, p.cadastral]);
  useEffect(() => {
    if (ready && p.command) send(p.command);
  }, [ready, p.command]);
  return (
    <WebView<{}>
      ref={ref}
      originWhitelist={["*"]}
      source={{
        html,
        baseUrl:
          process.env.EXPO_PUBLIC_KAKAO_MAP_ORIGIN || "https://localhost",
      }}
      javaScriptEnabled
      scrollEnabled={false}
      onMessage={(e) => {
        try {
          const m = JSON.parse(e.nativeEvent.data);
          if (m.type === "ready") setReady(true);
          p.onEvent(m);
        } catch {}
      }}
      onError={() =>
        p.onEvent({ type: "error", message: "지도를 불러올 수 없어요" })
      }
      onShouldStartLoadWithRequest={(r) =>
        r.url === "about:blank" ||
        r.url.startsWith(
          process.env.EXPO_PUBLIC_KAKAO_MAP_ORIGIN || "https://localhost",
        )
      }
      style={{ flex: 1 }}
    />
  );
}
