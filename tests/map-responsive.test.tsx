import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MapHome } from "../src/screens/MapHome";
import { DEFAULT_FILTERS } from "../src/state/market";
import type { Repository } from "../src/api/repository";
const viewport = vi.hoisted(() => ({ width: 1440 }));
vi.mock("react-native", async () => ({
  ...(await vi.importActual("react-native")),
  useWindowDimensions: () => ({
    width: viewport.width,
    height: 900,
    scale: 1,
    fontScale: 1,
  }),
}));
vi.mock("expo-location", () => ({}));
vi.mock("../src/components/Sheet", () => ({
  Sheet: ({ children, docked, panelWidth, stage }: any) => (
    <aside
      data-testid="details"
      data-docked={docked}
      data-width={panelWidth}
      data-stage={stage}
    >
      {children}
    </aside>
  ),
}));
vi.mock("../src/screens/MarketSheets", () => ({
  RegionContent: ({ marker }: any) => <div>{marker.name} 상세</div>,
  ComplexContent: ({ stage }: any) => <div>단지 {stage} 상세</div>,
}));
vi.mock("../src/map/MapCanvas", () => ({
  default: ({ command, onEvent }: any) => (
    <div data-testid="map" data-command={JSON.stringify(command)}>
      <button onClick={() => onEvent({ type: "marker", id: "26350" })}>
        지역 선택
      </button>
    </div>
  ),
}));
afterEach(cleanup);
function setup(width: number) {
  viewport.width = width;
  const markers = [
    {
      kind: "region",
      region_code: "26350",
      name: "해운대구",
      lat: 35.16,
      lng: 129.16,
      transaction_count: 12,
      summary: {},
    },
    {
      kind: "region",
      region_code: "26500",
      name: "수영구",
      lat: 35.14,
      lng: 129.11,
      transaction_count: 24,
      summary: {},
    },
  ];
  render(
    <MapHome
      repo={
        {
          mode: "api",
          markers: async () => ({ data: { markers }, meta: {} }),
        } as unknown as Repository
      }
      filters={DEFAULT_FILTERS}
      onFilters={() => {}}
      onSearch={() => {}}
      onFilter={() => {}}
      onList={() => {}}
      onDate={() => {}}
      unit="평"
      onUnit={() => {}}
      base="normal"
      onBase={() => {}}
      cadastral={false}
      onCadastral={() => {}}
      onHelp={() => {}}
      notify={() => {}}
      onMeta={() => {}}
    />,
  );
}
describe("지도 반응형 패널", () => {
  it.each([
    [1440, 400],
    [1100, 360],
  ])(
    "폭 %i에서는 실제 지역 요약을 %i 패널에 자동으로 표시하고 카메라는 유지한다",
    async (width, panelWidth) => {
      setup(width);
      await screen.findByText("수영구 상세");
      expect(screen.getByTestId("details").dataset.docked).toBe("true");
      expect(screen.getByTestId("details").dataset.width).toBe(
        String(panelWidth),
      );
      expect(screen.getByTestId("details").dataset.stage).toBe("full");
      expect(screen.getByTestId("map").dataset.command).toBeUndefined();
      expect(screen.getByTestId("map-viewport").style.marginLeft).toBe(
        `${panelWidth}px`,
      );
    },
  );
  it("900 폭에서는 지역을 탭한 뒤 모바일 아래 시트를 연다", async () => {
    setup(900);
    await new Promise((resolve) => setTimeout(resolve, 260));
    expect(screen.queryByTestId("details")).toBeNull();
    fireEvent.click(screen.getByText("지역 선택"));
    await screen.findByText("해운대구 상세");
    expect(screen.getByTestId("details").dataset.docked).toBe("false");
    expect(screen.getByTestId("details").dataset.stage).toBe("half");
  });
});
