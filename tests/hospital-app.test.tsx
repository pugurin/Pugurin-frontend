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
import App from "../App";
import { busanQueryBBox, DEFAULT_FILTERS } from "../src/state/market";
import { ApiClient, ApiError } from "../src/api/client";
import { Repository } from "../src/api/repository";
import { HOSPITALS, HOSPITAL_META } from "../src/api/fixtures";
import { HOSPITAL_LIMIT } from "../src/state/hospital";
import type { Hospital } from "../src/api/types";

vi.mock("expo-font", () => ({ useFonts: () => [true] }));
vi.mock("expo-location", () => ({}));
vi.mock("react-native", async () => ({
  ...(await vi.importActual("react-native")),
  useWindowDimensions: () => ({
    width: 390,
    height: 800,
    scale: 1,
    fontScale: 1,
  }),
}));
// 기기 저장소 목: values에 넣어 둔 값만 돌려주고, 저장 호출을 기록한다
const storage = vi.hoisted(() => ({
  store: null as any,
  values: {} as Record<string, unknown>,
}));
vi.mock("../src/state/storage", async () => {
  const { vi } = await import("vitest");
  storage.store = vi.fn(async () => {});
  return {
    deviceId: async () => "device-1",
    loadStored: async (k: string, fallback: unknown) =>
      k in storage.values ? storage.values[k] : fallback,
    store: storage.store,
    remember: (list: unknown[]) => list,
  };
});
vi.mock("../src/glossary/matching", () => ({
  loadMatchingRecord: async () => null,
  matchingStatus: () => undefined,
}));
// App 테스트용 MapHome 목: 병원 스위치 상태를 보여 주고, 버튼으로 켜고 끈다.
// 지도 테스트는 vi.importActual로 진짜 MapHome을 쓴다
vi.mock("../src/screens/MapHome", () => ({
  MapHome: (props: any) => (
    <div>
      <p data-testid="hospitals">{String(props.hospitals)}</p>
      <button onClick={() => props.onHospitals(true)}>병원 켜기</button>
      <button onClick={() => props.onHospitals(false)}>병원 끄기</button>
    </div>
  ),
}));
vi.mock("../src/components/Sheet", () => ({
  Sheet: ({ children }: any) => <aside data-testid="sheet">{children}</aside>,
}));
vi.mock("../src/screens/MarketSheets", () => ({
  ComplexContent: () => null,
  RegionContent: () => null,
}));
// MapCanvas 목: 받은 props(hospitalAreas 포함)를 기록하고, 버튼으로 지도 이동 이벤트를 낸다
const map = vi.hoisted(() => ({ props: null as any, moves: 0, zoom: 14 }));
const bboxFor = (n: number) =>
  [129.04, 35.14, 129.08 + n * 0.001, 35.17] as [
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
            lat: 35.156,
            lng: 129.06 + map.moves * 0.001,
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
  storage.values = {};
  storage.store?.mockClear();
});

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const LIMIT_TEXT = "병원이 많아 일부만 세었어요. 확대하면 정확해져요";
const NOT_READY_TEXT = "병원 정보를 준비 중이에요";

// 진짜 MapHome을 그린다. 병원은 가짜 fetch를 단 진짜 Repository로 불러 tier까지 확인한다
async function setup({
  hospitals = true,
  hospitalsImpl,
  markersImpl,
}: {
  hospitals?: boolean;
  hospitalsImpl?: (...args: any[]) => Promise<any>;
  markersImpl?: (...args: any[]) => Promise<any>;
} = {}) {
  const { MapHome } = await vi.importActual<
    typeof import("../src/screens/MapHome")
  >("../src/screens/MapHome");
  map.zoom = 14;
  const urls: string[] = [];
  const real = new Repository(
    "api",
    new ApiClient("http://api", "d", async (url) => {
      urls.push(String(url));
      return new Response(
        JSON.stringify({ data: HOSPITALS, meta: HOSPITAL_META }),
      );
    }),
  );
  const hospitalsFn = vi.fn(
    hospitalsImpl ??
      ((bbox: any, signal?: AbortSignal) => real.hospitals(bbox, signal)),
  );
  const onHospitals = vi.fn();
  const repo = {
    mode: "api",
    markers: vi.fn(
      markersImpl ?? (async () => ({ data: { markers: [] }, meta: {} })),
    ),
    auctions: vi.fn(async () => ({ data: [], meta: {} })),
    auction: vi.fn(() => new Promise<never>(() => {})),
    schools: vi.fn(async () => ({ data: [], meta: {} })),
    hospitals: hospitalsFn,
  } as unknown as Repository;
  const draw = (on = hospitals) => (
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
      hospitals={on}
      onHospitals={onHospitals}
    />
  );
  const { rerender } = render(draw());
  // 부모(App)가 병원 스위치 상태를 바꾼 것처럼 다시 그린다
  const switchHospitals = async (on: boolean) => {
    rerender(draw(on));
    await act(() => wait(300));
  };
  const moveTo = async (zoom = 14) => {
    map.zoom = zoom;
    fireEvent.click(screen.getByText("지도 이동"));
    // 요청 디바운스(220ms)가 지나도록 기다린다
    await act(() => wait(300));
  };
  return { hospitals: hospitalsFn, urls, onHospitals, moveTo, switchHospitals };
}

// 좌표가 조금씩 다른 병원 n곳
const many = (n: number): Hospital[] =>
  Array.from({ length: n }, (_, i) => ({
    ...HOSPITALS[2],
    id: `h-many-${i}`,
    lat: 35.15 + (i % 20) * 0.001,
    lng: 129.05 + Math.floor(i / 20) * 0.001,
  }));

describe("App의 병원 레이어 저장", () => {
  it("저장된 값이 없으면 꺼진 채로 그리고, 켜면 store('hospitals', true)", async () => {
    render(<App />);
    expect((await screen.findByTestId("hospitals")).textContent).toBe("false");
    fireEvent.click(screen.getByText("병원 켜기"));
    expect(storage.store).toHaveBeenCalledWith("hospitals", true);
    expect(screen.getByTestId("hospitals").textContent).toBe("true");
  });
  it("저장소에 hospitals=true가 있으면 켜진 채로 그리고, 끄면 store('hospitals', false)", async () => {
    storage.values = { hospitals: true };
    render(<App />);
    await waitFor(() =>
      expect(screen.getByTestId("hospitals").textContent).toBe("true"),
    );
    fireEvent.click(screen.getByText("병원 끄기"));
    expect(storage.store).toHaveBeenCalledWith("hospitals", false);
    expect(screen.getByTestId("hospitals").textContent).toBe("false");
  });
});

describe("병원 레이어와 지도", () => {
  it("레이어 시트에서 '학교' 아래에 '병원' 스위치가 있고 누르면 onHospitals(true)", async () => {
    const { onHospitals } = await setup({ hospitals: false });
    fireEvent.click(screen.getByLabelText("지도 레이어"));
    const school = screen.getByText("학교");
    const hospital = screen.getByText("병원");
    expect(
      school.compareDocumentPosition(hospital) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      screen.getByText("가까이 모인 병원·의원을 원으로 묶어 보여줘요"),
    ).toBeTruthy();
    fireEvent.click(screen.getByLabelText("병원"));
    expect(onHospitals).toHaveBeenCalledWith(true);
  });
  it("켜져 있고 줌 14 이상이면 bbox와 tier를 붙여 부르고 원을 MapCanvas에 넘긴다", async () => {
    const { hospitals, urls, moveTo } = await setup();
    await moveTo(14);
    await waitFor(() => expect(hospitals).toHaveBeenCalled());
    const [bbox, signal] = hospitals.mock.calls.at(-1)!;
    expect(bbox).toEqual(busanQueryBBox(bboxFor(map.moves)));
    expect(signal).toBeInstanceOf(AbortSignal);
    expect(urls.at(-1)).toContain("tier=general%2Chospital%2Cclinic");
    await waitFor(() =>
      expect(map.props.hospitalAreas.length).toBeGreaterThan(0),
    );
    // 서버가 준 치과는 원에 넣지 않는다
    const ids = map.props.hospitalAreas.flatMap((a: any) =>
      a.members.map((h: Hospital) => h.id),
    );
    expect(ids).not.toContain("h-seomyeon-dental");
  });
  it("줌 13이면 부르지 않고 원도 없다", async () => {
    const { hospitals, moveTo } = await setup();
    await moveTo(13);
    expect(hospitals).not.toHaveBeenCalled();
    expect(map.props.hospitalAreas).toEqual([]);
  });
  it("꺼져 있으면 부르지 않고, 지도를 움직여도 빈 원 배열을 새로 만들지 않는다", async () => {
    const { hospitals, moveTo } = await setup({ hospitals: false });
    await moveTo(15);
    const first = map.props.hospitalAreas;
    expect(first).toEqual([]);
    await moveTo(15);
    await moveTo(13);
    expect(hospitals).not.toHaveBeenCalled();
    expect(map.props.hospitalAreas).toBe(first);
  });
  it(`응답이 ${HOSPITAL_LIMIT}곳이면 상한 안내를 띄우고, 그보다 적으면 띄우지 않는다`, async () => {
    const full = await setup({
      hospitalsImpl: async () => ({ data: many(HOSPITAL_LIMIT), meta: {} }),
    });
    await full.moveTo(14);
    expect(await screen.findByText(LIMIT_TEXT)).toBeTruthy();
    const box = screen.getByTestId("hospital-limit-notice");
    expect(box.closest("[data-testid='map-notices']")).toBeTruthy();
    expect(getComputedStyle(box).pointerEvents).toBe("none");
    cleanup();
    const under = await setup({
      hospitalsImpl: async () => ({ data: many(HOSPITAL_LIMIT - 1), meta: {} }),
    });
    await under.moveTo(14);
    await waitFor(() => expect(under.hospitals).toHaveBeenCalled());
    await waitFor(() =>
      expect(map.props.hospitalAreas.length).toBeGreaterThan(0),
    );
    expect(screen.queryByText(LIMIT_TEXT)).toBeNull();
  });
  it("404·503이면 원 없이 '병원 정보를 준비 중이에요'를 띄운다", async () => {
    for (const code of ["RESOURCE_NOT_FOUND", "DATA_NOT_READY"]) {
      const { moveTo } = await setup({
        hospitalsImpl: async () => {
          throw new ApiError("준비 중", code);
        },
      });
      await moveTo(14);
      const notice = await screen.findByText(NOT_READY_TEXT);
      expect(
        notice
          .closest("[data-testid='hospital-notice']")!
          .closest("[data-testid='map-notices']"),
      ).toBeTruthy();
      expect(map.props.hospitalAreas).toEqual([]);
      cleanup();
    }
    // 그 밖의 오류는 조용히 원만 뺀다
    const other = await setup({
      hospitalsImpl: async () => {
        throw new ApiError("오류", "INTERNAL");
      },
    });
    await other.moveTo(14);
    await waitFor(() => expect(other.hospitals).toHaveBeenCalled());
    expect(screen.queryByText(NOT_READY_TEXT)).toBeNull();
    expect(map.props.hospitalAreas).toEqual([]);
  });
  it("오류 카드가 떠 있으면 병원 준비 중·상한 안내를 모두 숨긴다", async () => {
    const broken = async () => {
      throw new ApiError("실거래 정보를 잠시 불러올 수 없어요", "INTERNAL");
    };
    for (const hospitalsImpl of [
      async () => {
        throw new ApiError("준비 중", "DATA_NOT_READY");
      },
      async () => ({ data: many(HOSPITAL_LIMIT), meta: {} }),
    ]) {
      const { hospitals, moveTo } = await setup({
        hospitalsImpl,
        markersImpl: broken,
      });
      await moveTo(14);
      await screen.findByText("다시 시도");
      await waitFor(() => expect(hospitals).toHaveBeenCalled());
      expect(screen.queryByText(NOT_READY_TEXT)).toBeNull();
      expect(screen.queryByText(LIMIT_TEXT)).toBeNull();
      cleanup();
    }
  });
  it("hospital-area: 마커 이벤트로 병원 시트가 열리고, 레이어를 끄면 시트를 닫고 원을 지운다", async () => {
    const { moveTo, switchHospitals } = await setup();
    await moveTo(14);
    await waitFor(() =>
      expect(
        map.props.hospitalAreas.some(
          (a: any) => a.id === "hospital-area:h-seomyeon-general",
        ),
      ).toBe(true),
    );
    act(() =>
      map.props.onEvent({
        type: "marker",
        id: "hospital-area:h-seomyeon-general",
      }),
    );
    // 줌 14에서는 서면 종합병원과 서면연합병원이 한 원이다
    expect(await screen.findByText("병원 2곳")).toBeTruthy();
    expect(screen.getByText("부산서면종합병원")).toBeTruthy();
    expect(screen.getByText(/기준일 2026\.11\.02/)).toBeTruthy();
    await switchHospitals(false);
    expect(screen.queryByText("병원 2곳")).toBeNull();
    expect(map.props.hospitalAreas).toEqual([]);
  });
});
