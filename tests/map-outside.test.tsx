import React from "react";
import { it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MapHome } from "../src/screens/MapHome";
import { DEFAULT_FILTERS } from "../src/state/market";
import type { Repository } from "../src/api/repository";
vi.mock("expo-location", () => ({}));
vi.mock("../src/screens/MarketSheets", () => ({
  ComplexContent: () => null,
  RegionContent: () => null,
}));
vi.mock("../src/map/MapCanvas", () => ({
  default: ({ onEvent }: any) => (
    <button
      onClick={() =>
        onEvent({
          type: "camera",
          lat: 37.56,
          lng: 126.97,
          zoom: 12,
          bbox: [126.8, 37.4, 127.2, 37.7],
        })
      }
    >
      서울로 이동
    </button>
  ),
}));
it("부산 밖으로 이동해도 지도를 가리는 부산 지원 팝업이 남지 않는다", async () => {
  const markers = vi.fn(async () => ({ data: { markers: [] }, meta: {} }));
  render(
    <MapHome
      repo={{ mode: "api", markers } as unknown as Repository}
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
  fireEvent.click(screen.getByText("서울로 이동"));
  await waitFor(() =>
    expect(screen.queryByText("부산 지역만 지원해요")).toBeNull(),
  );
  expect(screen.queryByText("이 조건의 거래가 없어요")).toBeNull();
});
