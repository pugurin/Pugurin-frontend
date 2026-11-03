import React from "react";
import { it, expect, vi, afterEach, describe } from "vitest";
import {
  act,
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
  within,
} from "@testing-library/react";
import { MapHome } from "../src/screens/MapHome";
import { busanQueryBBox, DEFAULT_FILTERS } from "../src/state/market";
import { ApiError } from "../src/api/client";
import { SCHOOLS, SCHOOL_META } from "../src/api/fixtures";
import type { Repository } from "../src/api/repository";
import type { Filters, School } from "../src/api/types";
vi.mock("react-native", async () => ({
  ...(await vi.importActual("react-native")),
  useWindowDimensions: () => ({
    width: 390,
    height: 800,
    scale: 1,
    fontScale: 1,
  }),
}));
vi.mock("expo-location", () => ({}));
// Sheet 목: 받은 peek을 data-peek로 남긴다
vi.mock("../src/components/Sheet", () => ({
  Sheet: ({ children, peek }: any) => (
    <aside data-testid="sheet" data-peek={peek}>
      {children}
    </aside>
  ),
}));
vi.mock("../src/screens/MarketSheets", () => ({
  ComplexContent: () => null,
  RegionContent: () => null,
}));
// MapCanvas 목: 받은 props(schools 포함)를 기록하고, 버튼으로 지도 이동 이벤트를 낸다
const map = vi.hoisted(() => ({ props: null as any, moves: 0, zoom: 14 }));
const bboxFor = (n: number) =>
  [129.12, 35.15, 129.17 + n * 0.001, 35.18] as [
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
            lng: 129.15 + map.moves * 0.001,
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
afterEach(cleanup);
const complex = {
  kind: "complex",
  complex_id: "c1",
  name: "우동 단지",
  lat: 35.16,
  lng: 129.16,
  transaction_count: 3,
  property_type: "apartment",
};
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
function setup({
  filters = DEFAULT_FILTERS,
  auction = false,
  schools = true,
  schoolsImpl,
  auctionsImpl,
  markersImpl,
}: {
  filters?: Filters;
  auction?: boolean;
  schools?: boolean;
  schoolsImpl?: (...args: any[]) => Promise<any>;
  auctionsImpl?: (...args: any[]) => Promise<any>;
  markersImpl?: (...args: any[]) => Promise<any>;
} = {}) {
  map.zoom = 14;
  const markers = vi.fn(
    markersImpl ??
      (async () => ({
        data: { markers: [complex] },
        meta: {},
      })),
  );
  const auctions = vi.fn(
    auctionsImpl ?? (async () => ({ data: [], meta: {} })),
  );
  const schoolsFn = vi.fn(
    schoolsImpl ?? (async () => ({ data: SCHOOLS, meta: SCHOOL_META })),
  );
  const onSchools = vi.fn();
  const onAuction = vi.fn();
  const onMeta = vi.fn();
  const repo = {
    mode: "api",
    markers,
    auctions,
    auction: vi.fn(() => new Promise<never>(() => {})),
    schools: schoolsFn,
  } as unknown as Repository;
  const draw = (on = schools) => (
    <MapHome
      repo={repo}
      filters={filters}
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
      onMeta={onMeta}
      auction={auction}
      onAuction={onAuction}
      onAuctionList={() => {}}
      schools={on}
      onSchools={onSchools}
    />
  );
  const { rerender } = render(draw());
  // 부모(App)가 학교 스위치 상태를 바꾼 것처럼 다시 그린다
  const switchSchools = async (on: boolean) => {
    rerender(draw(on));
    await act(() => wait(300));
  };
  const moveTo = async (zoom = 14) => {
    map.zoom = zoom;
    fireEvent.click(screen.getByText("지도 이동"));
    // 요청 디바운스(220ms)가 지나도록 기다린다
    await act(() => wait(300));
  };
  return {
    markers,
    auctions,
    schools: schoolsFn,
    onSchools,
    onAuction,
    onMeta,
    moveTo,
    switchSchools,
  };
}
// 지도 가운데 안내 묶음(top 24%) 하나 안에서 위에서부터 이 순서로 쌓였는지 본다
function expectStacked(...texts: string[]) {
  const nodes = texts.map((t) => screen.getByText(t));
  const box = nodes[0].closest("[data-testid='map-notices']")!;
  expect(box).toBeTruthy();
  expect(getComputedStyle(box).top).toBe("24%");
  for (const n of nodes) expect(box.contains(n)).toBe(true);
  for (let i = 1; i < nodes.length; i++)
    expect(
      nodes[i - 1].compareDocumentPosition(nodes[i]) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  // 학교 안내는 % 위치를 따로 갖지 않고 묶음 안에서 흐름대로 놓인다
  const school = screen
    .getByText("학교 정보를 준비 중이에요")
    .closest("[data-testid='school-notice']")!;
  expect(getComputedStyle(school).position).not.toBe("absolute");
}
const notFound = async () => {
  throw new ApiError("없음", "RESOURCE_NOT_FOUND");
};
const notReady = async () => {
  throw new ApiError("준비 중", "DATA_NOT_READY");
};
describe("지도 메뉴바", () => {
  it("'실거래'를 끄면 실거래 마커를 부르지 않고 지도에서 지운다", async () => {
    const { markers, moveTo } = setup({ schools: false });
    await moveTo(15);
    await waitFor(() => expect(map.props.markers).toEqual([complex]));
    fireEvent.click(screen.getByLabelText("실거래 보기"));
    await act(() => wait(300));
    expect(map.props.markers).toEqual([]);
    const calls = markers.mock.calls.length;
    await moveTo(15);
    expect(markers.mock.calls.length).toBe(calls);
    // 다시 켜면 부른다
    fireEvent.click(screen.getByLabelText("실거래 보기"));
    await act(() => wait(300));
    await waitFor(() => expect(map.props.markers).toEqual([complex]));
  });
  it("'경매'를 누르면 경매 탭을 켜고, 경매 탭에서 '실거래'를 누르면 끈다", async () => {
    const on = setup({ schools: false });
    fireEvent.click(screen.getByLabelText("경매 보기"));
    expect(on.onAuction).toHaveBeenCalledWith(true);
    cleanup();
    const off = setup({ schools: false, auction: true });
    fireEvent.click(screen.getByLabelText("실거래 보기"));
    expect(off.onAuction).toHaveBeenCalledWith(false);
  });
});
describe("학교 레이어와 지도", () => {
  it("메뉴바의 '학교'를 누르면 onSchools(true)", async () => {
    const { onSchools } = setup({ schools: false });
    fireEvent.click(screen.getByLabelText("학교 보기"));
    expect(onSchools).toHaveBeenCalledWith(true);
  });
  it("학교가 켜져 있고 줌 14 이상이면 bbox로 학교를 부르고 MapCanvas schools에 넘긴다", async () => {
    const { schools, onMeta, moveTo } = setup();
    await moveTo(14);
    await waitFor(() => expect(schools).toHaveBeenCalled());
    const [bbox, signal] = schools.mock.calls.at(-1)!;
    expect(bbox).toEqual(busanQueryBBox(bboxFor(map.moves)));
    expect(signal).toBeInstanceOf(AbortSignal);
    await waitFor(() => expect(map.props.schools).toEqual(SCHOOLS));
    // 학교 응답의 meta는 앱 전체 기준일로 넘기지 않는다
    expect(onMeta).not.toHaveBeenCalledWith(SCHOOL_META);
  });
  it("꺼져 있거나 줌 14 미만이면 부르지 않고 schools는 빈 배열이다", async () => {
    const off = setup({ schools: false });
    await off.moveTo(15);
    expect(off.markers).toHaveBeenCalled();
    expect(off.schools).not.toHaveBeenCalled();
    expect(map.props.schools).toEqual([]);
    cleanup();
    const far = setup();
    await far.moveTo(13);
    expect(far.markers).toHaveBeenCalled();
    expect(far.schools).not.toHaveBeenCalled();
    expect(map.props.schools).toEqual([]);
    // 확대 안내는 띄우지 않는다
    expect(screen.queryByText(/확대하면 학교/)).toBeNull();
  });
  it("경매 탭·토지 탭에서도 학교를 부르며, 실거래·경매 요청 인자는 그대로다", async () => {
    const a = setup({ auction: true });
    await a.moveTo(14);
    await waitFor(() => expect(a.schools).toHaveBeenCalled());
    expect(a.markers).not.toHaveBeenCalled();
    expect(a.auctions.mock.calls.at(-1)![0]).toEqual({
      bbox: busanQueryBBox(bboxFor(map.moves)),
      groups: ["apartment"],
      pageSize: 500,
    });
    cleanup();
    const land: Filters = { ...DEFAULT_FILTERS, property_type: "land" };
    const b = setup({ filters: land });
    await b.moveTo(14);
    await waitFor(() => expect(b.schools).toHaveBeenCalled());
    const [f, bbox, zoom] = b.markers.mock.calls.at(-1)! as any[];
    expect(f).toBe(land);
    expect(bbox).toEqual(busanQueryBBox(bboxFor(map.moves)));
    expect(zoom).toBe(14);
    await waitFor(() => expect(map.props.schools).toEqual(SCHOOLS));
  });
  it("지도를 다시 움직이면 이전 학교 요청을 취소하고, 끄면 진행 중 요청을 취소한다", async () => {
    const { schools, moveTo, switchSchools } = setup({
      schoolsImpl: () => new Promise(() => {}),
    });
    await moveTo(14);
    await waitFor(() => expect(schools).toHaveBeenCalledTimes(1));
    await moveTo(14);
    await waitFor(() => expect(schools).toHaveBeenCalledTimes(2));
    expect((schools.mock.calls[0][1] as AbortSignal).aborted).toBe(true);
    expect((schools.mock.calls[1][1] as AbortSignal).aborted).toBe(false);
    await switchSchools(false);
    expect((schools.mock.calls[1][1] as AbortSignal).aborted).toBe(true);
    expect(schools).toHaveBeenCalledTimes(2);
    expect(map.props.schools).toEqual([]);
  });
  it("404·503이면 마커 없이 '학교 정보를 준비 중이에요'를 띄운다", async () => {
    for (const impl of [notFound, notReady]) {
      const { moveTo } = setup({ schoolsImpl: impl });
      await moveTo(14);
      await screen.findByText("학교 정보를 준비 중이에요");
      expect(map.props.schools).toEqual([]);
      expect(screen.queryByText("다시 시도")).toBeNull();
      // 준비 중이면 범례도 숨긴다
      expect(screen.queryByLabelText("학교 범례")).toBeNull();
      cleanup();
    }
    // 경매 탭 안내가 보이면 같은 묶음 안에서 그 아래에 쌓는다
    const both = setup({
      auction: true,
      schoolsImpl: notReady,
      auctionsImpl: notReady,
    });
    await both.moveTo(14);
    await screen.findByText("경매 정보를 준비 중이에요");
    await screen.findByText("학교 정보를 준비 중이에요");
    expectStacked("경매 정보를 준비 중이에요", "학교 정보를 준비 중이에요");
    cleanup();
    // 혼자면 묶음 맨 위(24%)다
    const alone = setup({ schoolsImpl: notReady });
    await alone.moveTo(14);
    await screen.findByText("학교 정보를 준비 중이에요");
    expectStacked("학교 정보를 준비 중이에요");
  });
  it("빈 지역 카드와 학교 준비 중 안내가 함께 뜨면 겹치지 않게 카드 아래에 쌓는다", async () => {
    const { moveTo } = setup({
      schoolsImpl: notReady,
      markersImpl: async () => ({ data: { markers: [] }, meta: {} }),
    });
    await moveTo(14);
    await screen.findByText("이 조건의 거래가 없어요");
    await screen.findByText("학교 정보를 준비 중이에요");
    expectStacked("이 조건의 거래가 없어요", "학교 정보를 준비 중이에요");
    // 학교 안내는 지도 누르기를 막지 않는다
    expect(
      getComputedStyle(screen.getByTestId("school-notice")).pointerEvents,
    ).toBe("none");
  });
  it("오류 카드가 떠 있으면 학교 준비 중 안내를 숨긴다", async () => {
    const { moveTo } = setup({
      schoolsImpl: notReady,
      markersImpl: async () => {
        throw new ApiError("실거래 정보를 잠시 불러올 수 없어요", "INTERNAL");
      },
    });
    await moveTo(14);
    await screen.findByText("다시 시도");
    expect(screen.queryByText("학교 정보를 준비 중이에요")).toBeNull();
  });
  it("켜져 있고 줌 14 이상이면 범례(초·중·고·특수)를 띄운다", async () => {
    const on = setup();
    await on.moveTo(14);
    await waitFor(() => expect(map.props.schools).toEqual(SCHOOLS));
    const legend = screen.getByLabelText("학교 범례");
    for (const t of ["초", "중", "고", "특수"])
      expect(within(legend).getByText(t)).toBeTruthy();
    // 화면 안에 기타 학교가 없으면 기타는 빼고
    expect(within(legend).queryByText("기타")).toBeNull();
    cleanup();
    const other: School = { ...SCHOOLS[0], id: "s-other", level: "other" };
    const withOther = setup({
      schoolsImpl: async () => ({ data: [...SCHOOLS, other], meta: {} }),
    });
    await withOther.moveTo(14);
    await waitFor(() => expect(map.props.schools).toHaveLength(6));
    expect(
      within(screen.getByLabelText("학교 범례")).getByText("기타"),
    ).toBeTruthy();
    cleanup();
    const far = setup();
    await far.moveTo(13);
    expect(screen.queryByLabelText("학교 범례")).toBeNull();
    cleanup();
    const off = setup({ schools: false });
    await off.moveTo(14);
    expect(screen.queryByLabelText("학교 범례")).toBeNull();
  });
  it("학교 마커를 누르면 학교 시트가 열리고 원래 이름이 보인다", async () => {
    const { moveTo } = setup();
    await moveTo(15);
    await waitFor(() => expect(map.props.schools).toEqual(SCHOOLS));
    act(() =>
      map.props.onEvent({
        type: "marker",
        id: "school:s-haeundae-girls-high",
      }),
    );
    expect(await screen.findByText("해운대여자고등학교")).toBeTruthy();
    expect(map.props.selected).toBe("school:s-haeundae-girls-high");
    // 응답 meta를 시트에 넘긴다(기준일)
    expect(screen.getByText(/기준일 2026\.11\.02/)).toBeTruthy();
  });
  it("학교 시트는 기본(230)보다 큰 peek으로 열어 내용이 peek 하나에 다 보이게 한다", async () => {
    const { moveTo } = setup();
    await moveTo(15);
    await waitFor(() => expect(map.props.schools).toEqual(SCHOOLS));
    act(() =>
      map.props.onEvent({
        type: "marker",
        id: "school:s-haeundae-girls-high",
      }),
    );
    await screen.findByText("해운대여자고등학교");
    expect(
      Number(screen.getByTestId("sheet").dataset.peek),
    ).toBeGreaterThanOrEqual(330);
  });
  it("학교 시트가 열린 채 학교 스위치를 끄면 시트를 닫는다", async () => {
    const { moveTo, switchSchools } = setup();
    await moveTo(15);
    await waitFor(() => expect(map.props.schools).toEqual(SCHOOLS));
    act(() =>
      map.props.onEvent({
        type: "marker",
        id: "school:s-haeundae-girls-high",
      }),
    );
    await screen.findByText("해운대여자고등학교");
    await switchSchools(false);
    expect(screen.queryByText("해운대여자고등학교")).toBeNull();
    expect(map.props.selected).toBeNull();
  });
  it("꺼져 있으면 지도를 움직여도 schools 배열을 새로 만들지 않는다(마커를 다시 그리지 않게)", async () => {
    const { moveTo } = setup({ schools: false });
    await moveTo(15);
    const first = map.props.schools;
    await moveTo(15);
    await moveTo(13);
    expect(map.props.schools).toBe(first);
  });
});
