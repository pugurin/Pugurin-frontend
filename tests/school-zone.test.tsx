import React from "react";
import { it, expect, vi, afterEach, describe } from "vitest";
import { act, render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { MapHome } from "../src/screens/MapHome";
import { DEFAULT_FILTERS } from "../src/state/market";
import { ApiClient, ApiError } from "../src/api/client";
import { Repository } from "../src/api/repository";
import { SCHOOLS, SCHOOL_META, SCHOOL_ZONES, SCHOOL_ZONE_META } from "../src/api/fixtures";
import { containsPoint, geometryBBox } from "../src/map/geometry";
import type { ComplexMarker } from "../src/api/types";
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

const complexAt = (id: string, lng: number, lat: number, count: number): ComplexMarker => ({
  kind: "complex",
  complex_id: id,
  name: `단지 ${id}`,
  lat,
  lng,
  transaction_count: count,
  latest: { deal_type: "sale", price: 9e8, exclusive_area_pyeong: 25.7, supply_area_pyeong: 34, contract_date: "2026-09-14" },
});
// 우동초 구역 안 두 곳과 밖 한 곳
const ZONE_MARKERS = [
  complexAt("in-few", 129.145, 35.16, 3),
  complexAt("out", 129.16, 35.17, 50),
  complexAt("in-many", 129.146, 35.163, 9),
];

function setup(zoneImpl?: (...a: any[]) => Promise<any>, extra: Record<string, unknown> = {}) {
  const schoolZone = vi.fn(
    zoneImpl ?? (async (id: string) => ({ data: SCHOOL_ZONES.find((z) => z.school_id === id), meta: SCHOOL_ZONE_META })),
  );
  const repo = {
    mode: "api",
    // 지도 화면 마커는 비우고, 통학구역 bbox를 단지 줌(16)으로 부르면 단지를 준다
    markers: vi.fn(async (_f: any, _b: any, z: number) => ({ data: { markers: z === 16 ? ZONE_MARKERS : [] }, meta: {} })),
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
      {...extra}
    />,
  );
  const pick = async (id: string) => {
    fireEvent.click(screen.getByText("지도 이동"));
    await act(() => wait(300));
    await waitFor(() => expect(map.props.schools).toEqual(SCHOOLS));
    act(() => map.props.onEvent({ type: "marker", id: `school:${id}` }));
    await act(() => wait(20));
  };
  return { schoolZone, pick, repo };
}

describe("초등학교 통학구역", () => {
  it("초등학교를 누르면 통학구역을 불러와 지도에 칠하고 그 구역으로 옮긴다", async () => {
    const { schoolZone, pick } = setup();
    await pick("s-udong-elem");
    expect(schoolZone).toHaveBeenCalledWith("s-udong-elem", expect.anything());
    await waitFor(() => expect(map.props.schoolZone).toEqual(SCHOOL_ZONES[0].geometry));
    // 구역 bbox 전체가 보이게 맞추고, 휴대폰은 학교 시트(peek 336 = 800-54의 42%)만큼 아래를 비운다
    expect(map.props.command).toMatchObject({
      type: "move",
      bbox: geometryBBox(SCHOOL_ZONES[0].geometry),
      padding: [32, 64, Math.min(360, (800 - 54) * 0.42) + 16, 24],
    });
    const sheet = screen.getByTestId("sheet");
    expect(sheet.textContent).toContain("이 학교 통학구역이에요");
    expect(sheet.textContent).toContain("한국교육시설안전원 학구도");
    // 다른(고등) 학교를 고르면 통학구역을 지운다
    act(() => map.props.onEvent({ type: "marker", id: "school:s-haeundae-girls-high" }));
    await act(() => wait(20));
    expect(map.props.schoolZone).toBeNull();
  });

  it("통학구역 안 단지를 거래 많은 순으로 보여 주고, 누르면 단지 시트를 연다", async () => {
    const { pick, repo } = setup();
    await pick("s-udong-elem");
    expect(await screen.findByText("통학구역 안 아파트 2곳")).toBeTruthy();
    expect(repo.markers).toHaveBeenCalledWith(DEFAULT_FILTERS, geometryBBox(SCHOOL_ZONES[0].geometry), 16, expect.anything());
    const names = screen.getAllByRole("button", { name: /^단지 .+ 보기$/ }).map((b) => b.getAttribute("aria-label"));
    expect(names).toEqual(["단지 in-many 보기", "단지 in-few 보기"]);
    fireEvent.click(screen.getByRole("button", { name: "단지 in-many 보기" }));
    await act(() => wait(20));
    expect(map.props.selected).toBe("in-many");
  });

  it("줌을 줄여 학교 목록이 비어도 고른 학교 마커는 남긴다", async () => {
    const { pick } = setup();
    await pick("s-udong-elem");
    act(() => map.props.onEvent({ type: "camera", lat: 35.16, lng: 129.14, zoom: 12, bbox: [129.0, 35.0, 129.3, 35.3] }));
    await act(() => wait(300));
    expect(map.props.schools.map((x: any) => x.id)).toEqual(["s-udong-elem"]);
    expect(map.props.selected).toBe("school:s-udong-elem");
  });

  it("검색에서 학교를 고르면 학교 레이어를 켜고 그 학교 시트를 연다", async () => {
    const onSchools = vi.fn();
    const school = SCHOOLS.find((x) => x.id === "s-udong-elem")!;
    setup(undefined, {
      onSchools,
      focus: { result: { type: "school", name: school.name, lat: school.lat, lng: school.lng, school }, nonce: 1 },
    });
    await act(() => wait(20));
    expect(onSchools).toHaveBeenCalledWith(true);
    expect(map.props.selected).toBe("school:s-udong-elem");
    expect(screen.getByTestId("sheet").textContent).toContain("우동초등학교");
    // 초등학교라 통학구역도 칠하고 구역에 맞춘다
    await waitFor(() => expect(map.props.schoolZone).toEqual(SCHOOL_ZONES[0].geometry));
    expect(map.props.command).toMatchObject({ type: "move", bbox: geometryBBox(SCHOOL_ZONES[0].geometry) });
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
    expect(await screen.findByText("이 학교 통학구역 정보가 아직 없어요")).toBeTruthy();
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
    expect(geometryBBox({ type: "Polygon", coordinates: [[[1, 2], [3, 0], [2, 5], [1, 2]]] })).toEqual([1, 0, 3, 5]);
    expect(
      geometryBBox({ type: "MultiPolygon", coordinates: [[[[1, 2], [3, 4], [1, 2]]], [[[5, 0], [6, 1], [5, 0]]]] }),
    ).toEqual([1, 0, 6, 4]);
  });

  it("containsPoint는 바깥 고리 안이면서 구멍 밖인 점만 참이다", () => {
    const square = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]];
    const hole = [[4, 4], [6, 4], [6, 6], [4, 6], [4, 4]];
    const g = { type: "Polygon" as const, coordinates: [square, hole] };
    expect(containsPoint(g, 2, 2)).toBe(true);
    expect(containsPoint(g, 5, 5)).toBe(false);
    expect(containsPoint(g, 11, 5)).toBe(false);
    expect(containsPoint({ type: "MultiPolygon", coordinates: [[hole], [square.map(([x, y]) => [x + 20, y])]] }, 25, 5)).toBe(true);
  });

  it("샘플 통학구역은 자기 학교를 품는다", () => {
    for (const z of SCHOOL_ZONES) {
      const school = SCHOOLS.find((x) => x.id === z.school_id)!;
      expect(containsPoint(z.geometry, school.lng!, school.lat!)).toBe(true);
    }
  });

  it("샘플 Repository는 통학구역이 없는 학교에 RESOURCE_NOT_FOUND를 준다", async () => {
    const repo = new Repository("sample", {} as never);
    expect((await repo.schoolZone("s-udong-elem")).data.kind).toBe("elementary");
    await expect(repo.schoolZone("s-haeundae-mid")).rejects.toMatchObject({ code: "RESOURCE_NOT_FOUND" });
  });
});

describe("참고용 통학구역", () => {
  const api = (status: number) =>
    new Repository(
      "api",
      new ApiClient("http://api", "d", async () =>
        new Response(JSON.stringify({ error: { code: status === 404 ? "RESOURCE_NOT_FOUND" : "INTERNAL_ERROR", message: "x" } }), { status }),
      ),
    );

  it("서버가 404면 앱에 넣어 둔 연신초 참고용 경계를 쓰고, 출처를 공식 학구도가 아니라고 적는다", async () => {
    const r = await api(404).schoolZone("7191087");
    expect(r.data.school_id).toBe("7191087");
    expect(String(r.meta?.source_attribution)).toContain("공식 학구도 아님");
    // 연신초와 배정 단지(더샵파크시티·한양타워)는 안, 온천천 북쪽 단지·연일초는 밖
    const g = r.data.geometry;
    expect(containsPoint(g, 129.09316, 35.19248)).toBe(true);
    expect(containsPoint(g, 129.09724, 35.19101)).toBe(true);
    expect(containsPoint(g, 129.09222, 35.19051)).toBe(true);
    expect(containsPoint(g, 129.09106, 35.1943)).toBe(false);
    expect(containsPoint(g, 129.09545, 35.18432)).toBe(false);
  });

  it("참고용 경계가 없는 학교나 404가 아닌 오류는 그대로 던진다", async () => {
    await expect(api(404).schoolZone("other")).rejects.toMatchObject({ code: "RESOURCE_NOT_FOUND" });
    await expect(api(500).schoolZone("7191087")).rejects.toBeTruthy();
  });
});
