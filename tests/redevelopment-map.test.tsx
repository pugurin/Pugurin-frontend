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
  useWindowDimensions: () => ({
    width: 390,
    height: 800,
    scale: 1,
    fontScale: 1,
  }),
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
        <button
          onClick={() => props.onEvent({ type: "marker", id: "redevzone:Z1" })}
        >
          이어진 경계 누르기
        </button>
        <button
          onClick={() => props.onEvent({ type: "marker", id: "redevzone:Z2" })}
        >
          안 이어진 경계 누르기
        </button>
      </>
    );
  },
}));
afterEach(cleanup);
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const ring = [
  [129.15, 35.16],
  [129.152, 35.16],
  [129.152, 35.162],
  [129.15, 35.16],
];
const ZONES = [
  {
    zone_id: "Z1",
    layer: "zone",
    name: "우동1재개발정비구역",
    notice: null,
    designated_on: "2016-12-21",
    geometry: { type: "MultiPolygon", coordinates: [[ring]] },
    redevelopment_id: "BARA_SAMPLE_001",
    area_name: "우동1구역 재개발",
    kind: "redevelopment",
    stage: "disposal_approved",
  },
  {
    zone_id: "Z2",
    layer: "planned",
    name: null,
    notice: "부산광역시 고시 제2016-415호",
    designated_on: "2016-12-21",
    geometry: { type: "MultiPolygon", coordinates: [[ring]] },
    redevelopment_id: null,
    area_name: null,
    kind: null,
    stage: null,
  },
];
const ZONE_META = {
  data_as_of: "2026-11-22T21:00:00+09:00",
  source_attribution: "브이월드 용도지역지구정보",
};
function setup(impl?: (...a: any[]) => Promise<any>, on = true, zones = true) {
  const redevelopments = vi.fn(
    impl ??
      (async () => ({
        data: REDEVELOPMENTS.slice(0, 3),
        meta: REDEVELOPMENT_META,
      })),
  );
  const redevelopmentZones = vi.fn(async () => ({
    data: ZONES,
    meta: ZONE_META,
  }));
  const onRedevelopments = vi.fn();
  const repo = {
    mode: "api",
    markers: vi.fn(async () => ({ data: { markers: [] }, meta: {} })),
    auctions: vi.fn(async () => ({ data: [], meta: {} })),
    redevelopments,
    ...(zones ? { redevelopmentZones } : {}),
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
  return {
    redevelopments,
    redevelopmentZones,
    onRedevelopments,
    moveTo,
    rerender: (v: boolean) => rerender(draw(v)),
  };
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

describe("정비구역 경계", () => {
  it("켜면 줌 12 이상에서 경계를 bbox·줌으로 불러 빗금과 함께 지도에 넘긴다", async () => {
    const { redevelopmentZones, moveTo } = setup();
    await moveTo(11);
    expect(redevelopmentZones).not.toHaveBeenCalled();
    await moveTo(15);
    await waitFor(() => expect(redevelopmentZones).toHaveBeenCalled());
    const [bbox, zoom] = redevelopmentZones.mock.calls[0] as any[];
    expect(bbox).toHaveLength(4);
    expect(zoom).toBe(15);
    const shapes = map.props.redevelopmentZones;
    expect(shapes.map((x: any) => x.id)).toEqual([
      "redevzone:Z1",
      "redevzone:Z2",
    ]);
    expect(shapes[0].polygons).toEqual([[ring]]);
    expect(Array.isArray(shapes[0].hatch)).toBe(true);
  });

  it("우리 구역과 이어진 경계를 누르면 그 구역 시트를 연다", async () => {
    const { moveTo } = setup();
    await moveTo(15);
    await waitFor(() => expect(map.props.redevelopmentZones.length).toBe(2));
    await waitFor(() => expect(map.props.redevelopments.length).toBe(3));
    fireEvent.click(screen.getByText("이어진 경계 누르기"));
    const sheet = await screen.findByTestId("sheet");
    expect(sheet.textContent).toContain("우동1구역 재개발");
    expect(sheet.textContent).toContain("지금 단계: 관리처분계획인가");
    expect(map.props.selected).toBe("redev:BARA_SAMPLE_001");
  });

  it("이어지지 않은 경계를 누르면 고시 정보와 출처만 있는 짧은 시트를 연다", async () => {
    const { moveTo } = setup();
    await moveTo(15);
    await waitFor(() => expect(map.props.redevelopmentZones.length).toBe(2));
    fireEvent.click(screen.getByText("안 이어진 경계 누르기"));
    const sheet = await screen.findByTestId("sheet");
    // 정비예정구역은 종류 배지로 알린다(아직 구역 지정 전)
    expect(sheet.textContent).toContain("정비예정구역");
    expect(sheet.textContent).toContain("부산광역시 고시 제2016-415호");
    expect(sheet.textContent).toContain("고시일 2016.12.21");
    expect(sheet.textContent).toContain(
      "출처: 브이월드 용도지역지구정보",
    );
    expect(map.props.selected).toBe("redevzone:Z2");
    expect(map.props.redevelopmentZoneSelected).toBe("redevzone:Z2");
  });

  it("경계 API가 없는 저장소여도 마커는 그대로 보인다", async () => {
    const { moveTo } = setup(undefined, true, false);
    await moveTo(14);
    await waitFor(() => expect(map.props.redevelopments.length).toBe(3));
    expect(map.props.redevelopmentZones ?? []).toEqual([]);
  });
});
