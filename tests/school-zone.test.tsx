import React from "react";
import { it, expect, vi, afterEach, describe } from "vitest";
import { act, render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { MapHome } from "../src/screens/MapHome";
import { DEFAULT_FILTERS } from "../src/state/market";
import { ApiError } from "../src/api/client";
import { Repository } from "../src/api/repository";
import { SCHOOLS, SCHOOL_META, SCHOOL_ZONES, SCHOOL_ZONE_META } from "../src/api/fixtures";
import { fitZoom, geometryBBox } from "../src/map/geometry";
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
const map = vi.hoisted(() => ({ props: null as any }));
vi.mock("../src/map/MapCanvas", () => ({
  default: (props: any) => {
    map.props = props;
    return (
      <button
        onClick={() =>
          props.onEvent({ type: "camera", lat: 35.165, lng: 129.14, zoom: 15, bbox: [129.12, 35.15, 129.17, 35.18] })
        }
      >
        지도 이동
      </button>
    );
  },
}));
afterEach(cleanup);
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function setup(zoneImpl?: (...a: any[]) => Promise<any>) {
  const schoolZone = vi.fn(
    zoneImpl ?? (async (id: string) => ({ data: SCHOOL_ZONES.find((z) => z.school_id === id), meta: SCHOOL_ZONE_META })),
  );
  const repo = {
    mode: "api",
    markers: vi.fn(async () => ({ data: { markers: [] }, meta: {} })),
    auctions: vi.fn(async () => ({ data: [], meta: {} })),
    schools: vi.fn(async () => ({ data: SCHOOLS, meta: SCHOOL_META })),
    schoolZone,
  } as unknown as Repository;
  render(
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
      schools
      onSchools={() => {}}
    />,
  );
  const pick = async (id: string) => {
    fireEvent.click(screen.getByText("지도 이동"));
    await act(() => wait(300));
    await waitFor(() => expect(map.props.schools).toEqual(SCHOOLS));
    act(() => map.props.onEvent({ type: "marker", id: `school:${id}` }));
    await act(() => wait(20));
  };
  return { schoolZone, pick };
}

describe("초등학교 통학구역", () => {
  it("초등학교를 누르면 통학구역을 불러와 지도에 칠하고 그 구역으로 옮긴다", async () => {
    const { schoolZone, pick } = setup();
    await pick("s-udong-elem");
    expect(schoolZone).toHaveBeenCalledWith("s-udong-elem", expect.anything());
    await waitFor(() => expect(map.props.schoolZone).toEqual(SCHOOL_ZONES[0].geometry));
    // 구역 가운데로, 학교 마커가 보이는 줌(14 이상)으로 옮긴다
    const [w, s, e, n] = geometryBBox(SCHOOL_ZONES[0].geometry)!;
    expect(map.props.command).toMatchObject({ type: "move", lat: (s + n) / 2, lng: (w + e) / 2, zoom: 14 });
    const sheet = screen.getByTestId("sheet");
    expect(sheet.textContent).toContain("이 학교 통학구역이에요");
    expect(sheet.textContent).toContain("한국교육시설안전원 학구도");
    // 다른(고등) 학교를 고르면 통학구역을 지운다
    act(() => map.props.onEvent({ type: "marker", id: "school:s-haeundae-girls-high" }));
    await act(() => wait(20));
    expect(map.props.schoolZone).toBeNull();
  });

  it("중·고등학교는 통학구역을 부르지 않는다", async () => {
    const { schoolZone, pick } = setup();
    await pick("s-haeundae-girls-high");
    expect(schoolZone).not.toHaveBeenCalled();
    expect(map.props.schoolZone).toBeNull();
  });

  it("통학구역이 없으면(404) 칠하지 않고 시트에 안내한다", async () => {
    const { pick } = setup(async () => {
      throw new ApiError("없음", "RESOURCE_NOT_FOUND");
    });
    await pick("s-udong-elem");
    expect(await screen.findByText("학구도에서 이 학교 통학구역을 찾지 못했어요")).toBeTruthy();
    expect(map.props.schoolZone).toBeNull();
  });

  it("서버 준비 전(503)이면 준비 중으로 안내한다", async () => {
    const { pick } = setup(async () => {
      throw new ApiError("준비 중", "DATA_NOT_READY");
    });
    await pick("s-udong-elem");
    expect(await screen.findByText("통학구역 정보를 준비 중이에요")).toBeTruthy();
  });
});

describe("통학구역 데이터", () => {
  it("geometryBBox는 Polygon·MultiPolygon의 꼭짓점 범위다", () => {
    expect(geometryBBox(SCHOOL_ZONES[0].geometry)).toEqual([129.137, 35.1555, 129.15, 35.169]);
    expect(
      geometryBBox({ type: "MultiPolygon", coordinates: [[[[1, 2], [3, 4], [1, 2]]], [[[5, 0], [6, 1], [5, 0]]]] }),
    ).toEqual([1, 0, 6, 4]);
  });

  it("fitZoom은 구역이 640px 안에 드는 가장 큰 줌이고 14~16 사이다", () => {
    // 약 1.5km 구역: 줌 15(1px=1m)에서는 넘치고 14(2m)에서 들어온다
    expect(fitZoom(geometryBBox(SCHOOL_ZONES[0].geometry)!)).toBe(14);
    // 약 200m 구역은 16
    expect(fitZoom([129.14, 35.16, 129.142, 35.161])).toBe(16);
    // 아주 큰 구역도 14 아래로 내리지 않는다
    expect(fitZoom([129.0, 35.0, 129.3, 35.3])).toBe(14);
  });

  it("샘플 Repository는 통학구역이 없는 학교에 RESOURCE_NOT_FOUND를 준다", async () => {
    const repo = new Repository("sample", {} as never);
    expect((await repo.schoolZone("s-udong-elem")).data.kind).toBe("elementary");
    await expect(repo.schoolZone("s-haeundae-mid")).rejects.toMatchObject({ code: "RESOURCE_NOT_FOUND" });
  });
});
