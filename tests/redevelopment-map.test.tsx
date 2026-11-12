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
import { DEFAULT_FILTERS } from "../src/state/market";
import { ApiError } from "../src/api/client";
import { REDEVELOPMENTS, REDEVELOPMENT_META } from "../src/api/fixtures";
import type { Repository } from "../src/api/repository";
vi.mock("react-native", async () => ({
  ...(await vi.importActual("react-native")),
  useWindowDimensions: () => ({ width: 390, height: 800, scale: 1, fontScale: 1 }),
}));
vi.mock("expo-location", () => ({}));
vi.mock("../src/components/Sheet", () => ({
  Sheet: ({ children }: any) => <aside data-testid="sheet">{children}</aside>,
}));
vi.mock("../src/screens/MarketSheets", () => ({
  ComplexContent: () => null,
  RegionContent: () => null,
}));
// MapCanvas 목: 받은 props를 기록하고, 버튼으로 지도 이동·마커 누름 이벤트를 낸다
const map = vi.hoisted(() => ({ props: null as any, zoom: 14 }));
vi.mock("../src/map/MapCanvas", () => ({
  default: (props: any) => {
    map.props = props;
    return (
      <>
        <button
          onClick={() =>
            props.onEvent({
              type: "camera",
              lat: 35.165,
              lng: 129.15,
              zoom: map.zoom,
              bbox: [129.13, 35.15, 129.17, 35.18],
            })
          }
        >
          지도 이동
        </button>
        <button
          onClick={() =>
            props.onEvent({ type: "marker", id: "redev:BARA_SAMPLE_001" })
          }
        >
          구역 누르기
        </button>
      </>
    );
  },
}));
afterEach(cleanup);
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
function setup(impl?: (...a: any[]) => Promise<any>, on = true) {
  const redevelopments = vi.fn(
    impl ?? (async () => ({ data: REDEVELOPMENTS.slice(0, 3), meta: REDEVELOPMENT_META })),
  );
  const onRedevelopments = vi.fn();
  const repo = {
    mode: "api",
    markers: vi.fn(async () => ({ data: { markers: [] }, meta: {} })),
    auctions: vi.fn(async () => ({ data: [], meta: {} })),
    redevelopments,
  } as unknown as Repository;
  const draw = (v: boolean) => (
    <MapHome
      repo={repo}
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
      redevelopments={v}
      onRedevelopments={onRedevelopments}
    />
  );
  const { rerender } = render(draw(on));
  const moveTo = async (zoom: number) => {
    map.zoom = zoom;
    fireEvent.click(screen.getByText("지도 이동"));
    await act(() => wait(300));
  };
  return { redevelopments, onRedevelopments, moveTo, rerender: (v: boolean) => rerender(draw(v)) };
}

describe("재개발 레이어", () => {
  it("메뉴바 '재개발'을 누르면 켜고 끄기를 부모에 알린다", () => {
    const { onRedevelopments } = setup(undefined, false);
    fireEvent.click(screen.getByLabelText("재개발 보기"));
    expect(onRedevelopments).toHaveBeenCalledWith(true);
  });

  it("켜면 줌 12 이상에서 진행 단계만 bbox로 불러 지도에 넘기고, 줌 11에서는 부르지 않는다", async () => {
    const { redevelopments, moveTo } = setup();
    await moveTo(11);
    expect(redevelopments).not.toHaveBeenCalled();
    await moveTo(13);
    await waitFor(() => expect(redevelopments).toHaveBeenCalled());
    const [bbox, stages] = redevelopments.mock.calls[0];
    expect(bbox).toHaveLength(4);
    expect(stages).not.toContain("cancelled");
    expect(map.props.redevelopments.map((x: any) => x.id)).toEqual(
      REDEVELOPMENTS.slice(0, 3).map((x) => x.id),
    );
  });

  it("구역 마커를 누르면 단계·세대수가 있는 시트를 열고, 레이어를 끄면 닫는다", async () => {
    const { moveTo, rerender } = setup();
    await moveTo(14);
    await waitFor(() => expect(map.props.redevelopments.length).toBe(3));
    fireEvent.click(screen.getByText("구역 누르기"));
    const sheet = await screen.findByTestId("sheet");
    expect(sheet.textContent).toContain("우동1구역 재개발");
    expect(sheet.textContent).toContain("지금 단계: 관리처분계획인가");
    expect(sheet.textContent).toContain("1,234세대");
    expect(sheet.textContent).toContain("13,650평");
    expect(sheet.textContent).toContain("출처: 부산광역시 정비사업 정보");
    expect(map.props.selected).toBe("redev:BARA_SAMPLE_001");
    rerender(false);
    await act(() => wait(50));
    expect(screen.queryByTestId("sheet")).toBeNull();
  });

  it("서버에 아직 없으면(404) 마커 없이 준비 중 안내를 띄운다", async () => {
    const { moveTo } = setup(async () => {
      throw new ApiError("없음", "RESOURCE_NOT_FOUND");
    });
    await moveTo(14);
    expect(await screen.findByText("재개발 정보를 준비 중이에요")).toBeTruthy();
    expect(map.props.redevelopments).toEqual([]);
  });
});
