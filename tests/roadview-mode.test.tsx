import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MapHome } from "../src/screens/MapHome";
import { DEFAULT_FILTERS } from "../src/state/market";
import type { Repository } from "../src/api/repository";
vi.mock("expo-location", () => ({}));
vi.mock("../src/screens/MarketSheets", () => ({
  ComplexContent: () => null,
  RegionContent: () => null,
}));
vi.mock("../src/map/kakaoRuntime", async (load) => ({
  ...(await load<typeof import("../src/map/kakaoRuntime")>()),
  HAS_KAKAO: true,
}));
vi.mock("../src/roadview/RoadviewModal", () => ({
  RoadviewModal: (p: { title: string; lat: number; lng: number }) => (
    <p>
      {p.title} 로드뷰 {p.lat},{p.lng}
    </p>
  ),
}));
// 지도는 로드뷰 레이어 상태 표시와 확대·탭 버튼으로 대신한다
vi.mock("../src/map/MapCanvas", () => ({
  default: ({ onEvent, roadview }: any) => (
    <>
      <span>{roadview ? "로드뷰 길 표시 중" : "일반 지도"}</span>
      <button
        onClick={() =>
          onEvent({
            type: "camera",
            lat: 35.16,
            lng: 129.16,
            zoom: 15,
            bbox: [129.15, 35.15, 129.17, 35.17],
          })
        }
      >
        확대해서 이동
      </button>
      <button onClick={() => onEvent({ type: "mapClick", lat: 35.16, lng: 129.16 })}>
        지도 누르기
      </button>
    </>
  ),
}));

afterEach(cleanup);

function setup() {
  const notify = vi.fn();
  const parcelLookup = vi.fn(async () => ({ data: null, meta: { unavailable_reason: "no_parcel" } }));
  render(
    <MapHome
      repo={
        {
          mode: "api",
          markers: async () => ({ data: { level: "dong", markers: [] }, meta: {} }),
          parcelLookup,
          transactions: async () => ({ data: [], meta: {} }),
          stats: async () => ({ data: { transaction_count: 0, trend: [] } }),
        } as unknown as Repository
      }
      filters={{ ...DEFAULT_FILTERS, property_type: "land" }}
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
      notify={notify}
      onMeta={() => {}}
    />,
  );
  return { notify, parcelLookup };
}

it("로드뷰 모드를 켜면 길을 표시하고, 지도를 누른 자리의 로드뷰를 연다", () => {
  const { notify, parcelLookup } = setup();
  fireEvent.click(screen.getByText("확대해서 이동"));
  fireEvent.click(screen.getByLabelText("로드뷰 모드"));
  expect(screen.getByText("로드뷰 길 표시 중")).toBeTruthy();
  expect(notify).toHaveBeenCalledWith("파란 길을 누르면 그 자리 로드뷰를 볼 수 있어요");

  fireEvent.click(screen.getByText("지도 누르기"));
  expect(screen.getByText("선택한 위치 로드뷰 35.16,129.16")).toBeTruthy();
  // 로드뷰 모드에서는 토지 조회 대신 로드뷰를 연다
  expect(parcelLookup).not.toHaveBeenCalled();
});

it("로드뷰 모드를 끄면 지도 누르기가 원래 동작(토지 조회)으로 돌아간다", () => {
  const { parcelLookup } = setup();
  fireEvent.click(screen.getByText("확대해서 이동"));
  fireEvent.click(screen.getByLabelText("로드뷰 모드"));
  fireEvent.click(screen.getByLabelText("로드뷰 모드"));
  expect(screen.getByText("일반 지도")).toBeTruthy();
  fireEvent.click(screen.getByText("지도 누르기"));
  expect(screen.queryByText(/선택한 위치 로드뷰/)).toBeNull();
  expect(parcelLookup).toHaveBeenCalled();
});
