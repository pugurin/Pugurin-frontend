import React, { useEffect, useMemo, useRef, useState } from "react";
import { mapDocument } from "./document";
import type { MapProps } from "./types";
export default function MapCanvas(p: MapProps) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const latest = useRef(p);
  latest.current = p;
  const html = useMemo(
    () => mapDocument(process.env.EXPO_PUBLIC_KAKAO_JS_KEY ?? "", p.initial),
    [],
  );
  useEffect(() => {
    const listener = (e: MessageEvent) => {
      if (e.source !== ref.current?.contentWindow) return;
      const event = e.data;
      if (event?.type === "ready") setReady(true);
      if (event && typeof event === "object") latest.current.onEvent(event);
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, []);
  useEffect(() => {
    if (ready)
      ref.current?.contentWindow?.postMessage(
        {
          type: "state",
          markers: p.markers,
          property: p.property,
          selected: p.selected,
          unit: p.unit,
          base: p.base,
          cadastral: p.cadastral,
        },
        window.location.origin,
      );
  }, [ready, p.markers, p.property, p.selected, p.unit, p.base, p.cadastral]);
  useEffect(() => {
    if (ready && p.command)
      ref.current?.contentWindow?.postMessage(
        p.command,
        window.location.origin,
      );
  }, [ready, p.command]);
  return (
    <iframe
      title="부산 실거래가 지도"
      ref={ref}
      srcDoc={html}
      style={{ width: "100%", height: "100%", border: 0, display: "block" }}
    />
  );
}
