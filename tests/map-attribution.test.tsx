import React from "react";
import { it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import MapCanvas from "../src/map/MapCanvas";

const captured = vi.hoisted(() => ({ map: null as any }));
vi.mock("@maplibre/maplibre-react-native", async () => {
  const React = await import("react");
  const Pass = ({ children }: any) => <>{children}</>;
  return {
    Map: React.forwardRef((props: any, _ref) => {
      captured.map = props;
      return null;
    }),
    Camera: React.forwardRef(() => null),
    GeoJSONSource: Pass,
    Images: () => null,
    Layer: () => null,
  };
});

it("앱 지도의 출처 표시(ⓘ)는 목록 보기·내 위치 버튼이 있는 아래쪽이 아니라 비어 있는 왼쪽 위에 둔다", () => {
  vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
  render(
    <MapCanvas
      markers={[]}
      property="apartment"
      selected={null}
      unit="평"
      base="normal"
      cadastral={false}
      initial={{ lat: 35.16, lng: 129.06, zoom: 11, bbox: [128.8, 35, 129.3, 35.4] }}
      onEvent={() => {}}
    />,
  );
  expect(captured.map.attributionPosition).toEqual({ top: 8, left: 8 });
  vi.unstubAllGlobals();
});
