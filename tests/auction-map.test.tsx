import React from "react";
import { it, expect, vi, afterEach, describe } from "vitest";
import {
  act,
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { MapHome } from "../src/screens/MapHome";
import { busanQueryBBox, DEFAULT_FILTERS } from "../src/state/market";
import { ApiError } from "../src/api/client";
import type { Repository } from "../src/api/repository";
import type { Filters } from "../src/api/types";
const viewport = vi.hoisted(() => ({ width: 390 }));
vi.mock("react-native", async () => ({
  ...(await vi.importActual("react-native")),
  useWindowDimensions: () => ({
    width: viewport.width,
    height: 800,
    scale: 1,
    fontScale: 1,
  }),
}));
vi.mock("expo-location", () => ({}));
vi.mock("../src/components/Sheet", () => ({
  Sheet: ({ children }: any) => <aside>{children}</aside>,
}));
vi.mock("../src/screens/MarketSheets", () => ({
  ComplexContent: () => null,
  RegionContent: () => null,
}));
// MapCanvas 목: 받은 props를 기록하고, 버튼으로 지도 이동 이벤트를 낸다
const map = vi.hoisted(() => ({ props: null as any, moves: 0, zoom: 14 }));
const bboxFor = (n: number) =>
  [129.15, 35.15, 129.17 + n * 0.001, 35.17] as [
    number,
    number,
    number,
    number,
  ];
vi.mock("../src/map/MapCanvas", () => ({
  default: (props: any) => {
    map.props = props;
    return (
      <button
        onClick={() => {
          map.moves += 1;
          props.onEvent({
            type: "camera",
            lat: 35.16,
            lng: 129.16 + map.moves * 0.001,
            zoom: map.zoom,
            bbox: bboxFor(map.moves),
          });
        }}
      >
        지도 이동
      </button>
    );
  },
}));
afterEach(() => {
  cleanup();
  viewport.width = 390;
});
const complex = {
  kind: "complex",
  complex_id: "c1",
  name: "우동 단지",
  lat: 35.16,
  lng: 129.16,
  transaction_count: 3,
  property_type: "apartment",
};
const sample = {
  id: "A1",
  source: "court",
  case_no: "2025타경1",
  property_group: "apartment",
  address: "부산 해운대구 우동",
  lat: 35.16,
  lng: 129.16,
  complex_id: "c1",
  min_price: 360000000,
};
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
function setup({
  filters = DEFAULT_FILTERS,
  auction,
  auctionsImpl,
  list = [complex],
}: {
  filters?: Filters;
  auction?: boolean;
  auctionsImpl?: (...args: any[]) => Promise<any>;
  list?: any[];
} = {}) {
  map.zoom = 14;
  const markers = vi.fn(async () => ({ data: { markers: list }, meta: {} }));
  const auctions = vi.fn(
    auctionsImpl ?? (async () => ({ data: [sample], meta: {} })),
  );
  const onAuction = vi.fn();
  const onAuctionList = vi.fn();
  const onFilters = vi.fn();
  // 시트는 상세를 불러오다 멈춘 상태로 둔다. 시트 내용은 auction-sheet 테스트가 본다
  const auctionDetail = vi.fn(() => new Promise<never>(() => {}));
  const repo = {
    mode: "api",
    markers,
    auctions,
    auction: auctionDetail,
  } as unknown as Repository;
  const draw = (on = auction) => (
    <MapHome
      repo={repo}
      filters={filters}
      onFilters={onFilters}
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
      auction={on}
      onAuction={onAuction}
      onAuctionList={onAuctionList}
    />
  );
  const { rerender } = render(draw());
  // 부모(App)가 경매 탭 상태를 바꾼 것처럼 다시 그린다
  const switchAuction = async (on: boolean) => {
    rerender(draw(on));
    await act(() => wait(300));
  };
  const moveTo = async (zoom = 14) => {
    map.zoom = zoom;
    fireEvent.click(screen.getByText("지도 이동"));
    // 실거래·경매 요청 디바운스(220ms)가 지나도록 기다린다
    await act(() => wait(300));
  };
  return {
    markers,
    auctions,
    auctionDetail,
    onAuction,
    onAuctionList,
    onFilters,
    moveTo,
    switchAuction,
  };
}
describe("경매 탭과 지도", () => {
  it("매매·줌 14 이상이면 같은 물건 탭의 경매를 함께 부르고 마커로 넘긴다", async () => {
    const { auctions, moveTo } = setup();
    await moveTo(14);
    await waitFor(() => expect(auctions).toHaveBeenCalled());
    const [q, signal] = auctions.mock.calls.at(-1)!;
    expect(q).toEqual({
      bbox: busanQueryBBox(bboxFor(map.moves)),
      groups: ["apartment"],
      pageSize: 500,
    });
    expect(signal).toBeInstanceOf(AbortSignal);
    await waitFor(() => expect(map.props.auctions).toEqual([sample]));
  });
  it("전세·월세나 줌 14 미만에서는 경매를 부르지 않는다", async () => {
    const jeonse = setup({
      filters: { ...DEFAULT_FILTERS, deal_type: "jeonse" },
    });
    await jeonse.moveTo(15);
    expect(jeonse.markers).toHaveBeenCalled();
    expect(jeonse.auctions).not.toHaveBeenCalled();
    cleanup();
    const far = setup();
    await far.moveTo(13);
    expect(far.markers).toHaveBeenCalled();
    expect(far.auctions).not.toHaveBeenCalled();
    expect(map.props.auctions ?? []).toEqual([]);
  });
  it("매매에 가격 필터가 걸려 있으면 경매를 부르지 않는다", async () => {
    const { markers, auctions, moveTo } = setup({
      filters: { ...DEFAULT_FILTERS, price_min: 30000 },
    });
    await moveTo(15);
    expect(markers).toHaveBeenCalled();
    expect(auctions).not.toHaveBeenCalled();
  });
  it("경매 탭이면 실거래 마커를 부르지 않고 기간 칩을 숨긴다", async () => {
    const { markers, auctions, moveTo } = setup({ auction: true, list: [] });
    await moveTo(14);
    expect(markers).not.toHaveBeenCalled();
    expect(auctions).toHaveBeenCalled();
    expect(screen.queryByText(/최근 12개월/)).toBeNull();
    expect(screen.queryByText("이 조건의 거래가 없어요")).toBeNull();
    expect(map.props.markers).toEqual([]);
  });
  it("경매 탭에서 줌 14 미만이면 '확대하면 경매 물건이 보여요'를 띄운다", async () => {
    const { auctions, moveTo } = setup({ auction: true });
    await moveTo(13);
    expect(auctions).not.toHaveBeenCalled();
    expect(screen.getByText("확대하면 경매 물건이 보여요")).toBeTruthy();
    expect(screen.queryByText("이 조건의 거래가 없어요")).toBeNull();
  });
  it("경매 탭에서 API가 404·503이면 '경매 정보를 준비 중이에요', 매매에서는 아무것도 안 띄운다", async () => {
    const notFound = async () => {
      throw new ApiError("없음", "RESOURCE_NOT_FOUND");
    };
    const notReady = async () => {
      throw new ApiError("준비 중", "DATA_NOT_READY");
    };
    const a = setup({ auction: true, auctionsImpl: notFound });
    await a.moveTo(14);
    await screen.findByText("경매 정보를 준비 중이에요");
    // 오류 카드가 아닌 일반 안내라 다시 시도 버튼이 없다
    expect(screen.queryByText("다시 시도")).toBeNull();
    cleanup();
    const b = setup({ auction: true, auctionsImpl: notReady });
    await b.moveTo(14);
    await screen.findByText("경매 정보를 준비 중이에요");
    expect(screen.queryByText("다시 시도")).toBeNull();
    cleanup();
    const c = setup({ auctionsImpl: notFound });
    await c.moveTo(14);
    expect(c.auctions).toHaveBeenCalled();
    expect(screen.queryByText("경매 정보를 준비 중이에요")).toBeNull();
    expect(screen.queryByText("다시 시도")).toBeNull();
  });
  it("경매 탭에서 그 밖의 오류는 오류 메시지를 띄운다", async () => {
    const { moveTo } = setup({
      auction: true,
      auctionsImpl: async () => {
        throw new ApiError("서버에 연결할 수 없어요");
      },
    });
    await moveTo(14);
    await screen.findByText("서버에 연결할 수 없어요");
    expect(screen.getByText("다시 시도")).toBeTruthy();
  });
  it("경매 탭에서 경매가 0건이면 '이 화면 안에 진행 중인 경매가 없어요'를 띄운다", async () => {
    const { auctions, moveTo } = setup({
      auction: true,
      auctionsImpl: async () => ({ data: [], meta: {} }),
    });
    await moveTo(14);
    expect(auctions).toHaveBeenCalled();
    await screen.findByText("이 화면 안에 진행 중인 경매가 없어요");
    expect(screen.queryByText("이 조건의 거래가 없어요")).toBeNull();
  });
  it("매매에서 경매가 0건이어도 경매 0건 안내는 띄우지 않는다", async () => {
    const { auctions, moveTo } = setup({
      auctionsImpl: async () => ({ data: [], meta: {} }),
    });
    await moveTo(14);
    expect(auctions).toHaveBeenCalled();
    expect(
      screen.queryByText("이 화면 안에 진행 중인 경매가 없어요"),
    ).toBeNull();
  });
  it("매매에서 경매 탭으로 바꾸면 경매를 다시 불러 지도에 남긴다", async () => {
    const { auctions, markers, moveTo, switchAuction } = setup();
    await moveTo(14);
    await waitFor(() => expect(map.props.auctions).toEqual([sample]));
    const before = auctions.mock.calls.length;
    await switchAuction(true);
    expect(auctions.mock.calls.length).toBeGreaterThan(before);
    await waitFor(() => expect(map.props.auctions).toEqual([sample]));
    expect(map.props.markers).toEqual([]);
    expect(
      screen.queryByText("이 화면 안에 진행 중인 경매가 없어요"),
    ).toBeNull();
    // 경매 → 매매로 돌아오면 실거래와 경매를 다시 함께 그린다
    const trades = markers.mock.calls.length;
    const again = auctions.mock.calls.length;
    await switchAuction(false);
    await waitFor(() =>
      expect(markers.mock.calls.length).toBeGreaterThan(trades),
    );
    expect(auctions.mock.calls.length).toBeGreaterThan(again);
    await waitFor(() => expect(map.props.markers).toEqual([complex]));
    await waitFor(() => expect(map.props.auctions).toEqual([sample]));
  });
  it("넓은 화면에서 거래유형 칩이 숨는 폭이어도 경매 칩은 보인다", () => {
    viewport.width = 1100;
    const { onAuction } = setup();
    expect(screen.queryByRole("button", { name: "전세" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "경매" }));
    expect(onAuction).toHaveBeenCalledWith(true);
  });
  it("토지 탭에서도 경매 칩을 고를 수 있다", async () => {
    const { auctions, onAuction, moveTo } = setup({
      filters: { ...DEFAULT_FILTERS, property_type: "land" },
    });
    const chip = screen.getByRole("button", { name: "경매" });
    expect(chip.getAttribute("aria-disabled")).not.toBe("true");
    fireEvent.click(chip);
    expect(onAuction).toHaveBeenCalledWith(true);
    await moveTo(15);
    expect(auctions.mock.calls.at(-1)![0].groups).toEqual(["land"]);
  });
  it("매매·전세·월세 칩을 누르면 경매 탭을 끈다", () => {
    const { onAuction, onFilters } = setup({ auction: true });
    fireEvent.click(screen.getByRole("button", { name: "전세" }));
    expect(onAuction).toHaveBeenCalledWith(false);
    expect(onFilters).toHaveBeenCalled();
  });
  it("경매 탭에서 필터 칩과 목록 보기는 경매 목록을 연다", async () => {
    const { onAuctionList, moveTo } = setup({ auction: true });
    await moveTo(14);
    const bbox = bboxFor(map.moves);
    fireEvent.click(screen.getByText("☷ 필터"));
    expect(onAuctionList).toHaveBeenLastCalledWith({ bbox });
    fireEvent.click(screen.getByText("목록 보기"));
    expect(onAuctionList).toHaveBeenCalledTimes(2);
    expect(onAuctionList).toHaveBeenLastCalledWith({ bbox });
  });
  it("지도를 다시 움직이면 이전 경매 요청을 취소한다", async () => {
    let first = true;
    const { auctions, moveTo } = setup({
      auctionsImpl: () => {
        if (first) {
          first = false;
          return new Promise(() => {});
        }
        return Promise.resolve({ data: [], meta: {} });
      },
    });
    await moveTo(14);
    await waitFor(() => expect(auctions).toHaveBeenCalledTimes(1));
    await moveTo(14);
    await waitFor(() => expect(auctions).toHaveBeenCalledTimes(2));
    expect((auctions.mock.calls[0][1] as AbortSignal).aborted).toBe(true);
  });
  it("경매 탭(실거래 마커 없음)에서 같은 단지 2건은 묶음 마커로 넘기고, 누르면 그 단지 경매 목록을 연다", async () => {
    const { onAuctionList, moveTo } = setup({
      auction: true,
      list: [],
      auctionsImpl: async () => ({
        data: [sample, { ...sample, id: "A2", lat: 35.161, lng: 129.161 }],
        meta: {},
      }),
    });
    await moveTo(15);
    await waitFor(() => expect(map.props.auctions).toHaveLength(2));
    expect(map.props.markers).toEqual([]);
    // 지도에 실제로 그리는 묶음 항목은 map-markers 테스트가 본다. 여기서는 누른 뒤 흐름만 본다
    act(() => map.props.onEvent({ type: "marker", id: "auction-group:c1" }));
    expect(onAuctionList).toHaveBeenLastCalledWith({
      bbox: bboxFor(map.moves),
      complexId: "c1",
      name: undefined,
    });
  });
  it("경매 마커를 누르면 경매 시트, 묶음 마커를 누르면 단지 경매 목록을 연다", async () => {
    const { onAuctionList, moveTo, auctionDetail } = setup();
    await moveTo(15);
    await waitFor(() => expect(map.props.markers).toEqual([complex]));
    act(() => map.props.onEvent({ type: "marker", id: "auction:A1" }));
    await waitFor(() => expect(auctionDetail).toHaveBeenCalled());
    expect(auctionDetail.mock.calls[0][0]).toBe("A1");
    expect(map.props.selected).toBe("auction:A1");
    act(() => map.props.onEvent({ type: "marker", id: "auction-group:c1" }));
    expect(onAuctionList).toHaveBeenCalledWith({
      bbox: bboxFor(map.moves),
      complexId: "c1",
      name: "우동 단지",
    });
    act(() => map.props.onEvent({ type: "marker", id: "auction-group:zz" }));
    expect(onAuctionList).toHaveBeenLastCalledWith({
      bbox: bboxFor(map.moves),
      complexId: "zz",
      name: undefined,
    });
  });
});
