import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MapHome } from "../src/screens/MapHome";
import { DEFAULT_FILTERS } from "../src/state/market";
import type { Repository } from "../src/api/repository";

vi.mock("expo-location", () => ({}));
vi.mock("../src/components/Sheet", () => ({
  Sheet: ({ children }: any) => <aside>{children}</aside>,
}));
vi.mock("../src/screens/MarketSheets", () => ({
  ComplexContent: () => <p>단지 상세</p>,
  RegionContent: ({ onComplex }: any) => (
    <button onClick={() => onComplex("c1")}>단지 열기</button>
  ),
}));
// 지도는 버튼으로 대신한다: 구 마커 누르기(지역 시트 열림)
vi.mock("../src/map/MapCanvas", () => ({
  default: ({ onEvent }: any) => (
    <button onClick={() => onEvent({ type: "marker", id: "26350" })}>
      해운대구 누르기
    </button>
  ),
}));

function setup() {
  render(
    <MapHome
      repo={
        {
          mode: "api",
          markers: async () => ({
            data: {
              markers: [
                {
                  kind: "region",
                  region_code: "26350",
                  name: "해운대구",
                  lat: 35.16,
                  lng: 129.16,
                  transaction_count: 3,
                  summary: {},
                },
              ],
            },
            meta: {},
          }),
          auctions: async () => ({ data: [], meta: {} }),
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

describe("작은 광고창 자리 (#129)", () => {
  afterEach(cleanup);
  it("지도 하단에 '광고' 표시와 닫기 버튼이 있는 광고창을 띄운다", () => {
    setup();
    const ad = screen.getByTestId("ad-slot-map");
    expect(ad.textContent).toContain("광고");
    expect(screen.getByLabelText("광고 닫기")).toBeTruthy();
  });
  it("닫으면 지도 광고창이 사라진다", () => {
    setup();
    fireEvent.click(screen.getByLabelText("광고 닫기"));
    expect(screen.queryByTestId("ad-slot-map")).toBeNull();
  });
  it("시트가 열리면 지도 광고창은 숨고, 단지 상세 시트 아래쪽에 광고 자리가 붙는다", async () => {
    setup();
    // 마커를 불러온 뒤에야 눌린다
    await waitFor(() => {
      fireEvent.click(screen.getByText("해운대구 누르기"));
      expect(screen.getByText("단지 열기")).toBeTruthy();
    });
    expect(screen.queryByTestId("ad-slot-map")).toBeNull();
    // 지역 시트에는 광고를 붙이지 않는다
    expect(screen.queryByTestId("ad-slot-sheet")).toBeNull();
    fireEvent.click(screen.getByText("단지 열기"));
    await screen.findByText("단지 상세");
    expect(screen.getByTestId("ad-slot-sheet")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("광고 닫기"));
    expect(screen.queryByTestId("ad-slot-sheet")).toBeNull();
  });
});
