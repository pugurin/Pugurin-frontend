import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MapHome } from "../src/screens/MapHome";
import { DEFAULT_FILTERS } from "../src/state/market";
import type { Repository } from "../src/api/repository";
import { ApiError } from "../src/api/client";
import { SCHOOLS, SCHOOL_META } from "../src/api/fixtures";

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
// 지도는 버튼으로 대신한다: 구 마커 누르기(지역 시트 열림), 줌 14로 지도 이동
vi.mock("../src/map/MapCanvas", () => ({
  default: ({ onEvent }: any) => (
    <>
      <button onClick={() => onEvent({ type: "marker", id: "26350" })}>
        해운대구 누르기
      </button>
      <button
        onClick={() =>
          onEvent({
            type: "camera",
            lat: 35.16,
            lng: 129.16,
            zoom: 14,
            bbox: [129.12, 35.15, 129.18, 35.18],
          })
        }
      >
        지도 이동
      </button>
    </>
  ),
}));

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
// 지도를 옮기고 요청 디바운스(220ms)가 지나도록 기다린다
async function moveMap() {
  fireEvent.click(screen.getByText("지도 이동"));
  await act(() => wait(300));
}

function setup({
  schools = false,
  markersImpl,
}: {
  schools?: boolean;
  markersImpl?: () => Promise<any>;
} = {}) {
  render(
    <MapHome
      repo={
        {
          mode: "api",
          markers:
            markersImpl ??
            (async () => ({
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
            })),
          auctions: async () => ({ data: [], meta: {} }),
          schools: async () => ({ data: SCHOOLS, meta: SCHOOL_META }),
        } as unknown as Repository
      }
      schools={schools}
      onSchools={() => {}}
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
    // 화면 읽기에는 '광고' 묶음으로 알리고, 안의 글·닫기 버튼은 그대로 둔다
    const region = screen.getByRole("region", { name: "광고" });
    expect(region).toBe(ad);
    expect(region.textContent).toContain("광고가 들어갈 자리예요");
    expect(screen.getByRole("button", { name: "광고 닫기" })).toBeTruthy();
  });
  it("오른쪽 버튼 묶음 폭만큼 비워 닫기 버튼이 그 아래 깔리지 않는다", () => {
    setup();
    // 버튼 묶음: 오른쪽 12 + 메뉴 버튼 44 + 테두리 2 = 58
    const box = screen.getByTestId("ad-slot-map").parentElement!.parentElement!;
    expect(parseFloat(getComputedStyle(box).right)).toBeGreaterThan(58);
  });
  it("학교 범례를 광고창 실제 높이만큼 위로 올리고, 닫으면 내린다", async () => {
    setup({ schools: true });
    await moveMap();
    const legend = await screen.findByLabelText("학교 범례");
    // 재기 전에는 기본 높이 58: 62 + 58 + 8
    expect(getComputedStyle(legend).bottom).toBe("128px");
    // 글자를 키워 광고창이 90으로 커진 것처럼 레이아웃을 알린다
    const ad = screen.getByTestId("ad-slot-map") as any;
    act(() => {
      ad.__reactLayoutHandler({
        nativeEvent: { layout: { x: 0, y: 0, width: 340, height: 90 } },
      });
    });
    expect(getComputedStyle(screen.getByLabelText("학교 범례")).bottom).toBe(
      "160px",
    );
    fireEvent.click(screen.getByLabelText("광고 닫기"));
    expect(getComputedStyle(screen.getByLabelText("학교 범례")).bottom).toBe(
      "62px",
    );
  });
  it("오류 카드가 뜨면 지도 광고창을 숨긴다", async () => {
    setup({
      markersImpl: async () => {
        throw new ApiError("실거래 정보를 잠시 불러올 수 없어요", "INTERNAL");
      },
    });
    await moveMap();
    await screen.findByText("다시 시도");
    expect(screen.queryByTestId("ad-slot-map")).toBeNull();
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
