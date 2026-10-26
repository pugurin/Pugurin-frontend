import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { LandContent } from "../src/screens/LandContent";
import { DEFAULT_FILTERS, HOME } from "../src/state/market";
import type { Repository } from "../src/api/repository";
import type { Parcel } from "../src/api/types";
afterEach(cleanup);
const filters = {
  ...DEFAULT_FILTERS,
  property_type: "land" as const,
  deal_type: "sale" as const,
};
const repo = {
  mode: "api",
  transactions: async () => ({ data: [], meta: {} }),
  stats: async () => ({
    data: {
      transaction_count: 7,
      median_price_per_pyeong: 18400000,
      trend: [
        { month: "2026-09", count: 3, median_price_per_pyeong: 18000000 },
      ],
    },
  }),
} as unknown as Repository;
function show(parcel: Parcel | null, repository = repo, picked = false) {
  return render(
    <LandContent
      repo={repository}
      filters={filters}
      bbox={HOME.bbox}
      region={{ code: "2650010500", name: "수영구 남천동" }}
      parcel={parcel}
      picked={picked}
      onRetry={() => {}}
      onList={() => {}}
      onHelp={() => {}}
      unit="평"
    />,
  );
}
describe("토지 상세", () => {
  it("필지 공급처가 없어도 서버 지역 통계와 월별 추이를 보여 준다", async () => {
    show(null, repo, true);
    expect(screen.getByText("필지 정보는 아직 제공하지 않아요")).toBeTruthy();
    expect(screen.queryByText(/잠시 불러올 수 없어요/)).toBeNull();
    await waitFor(() => expect(screen.getByText("7건")).toBeTruthy());
    expect(screen.getByText("월별 토지 땅값")).toBeTruthy();
    expect(screen.getByText(/지목별 조회는 아직/)).toBeTruthy();
  });
  it("동을 고르면 필지가 아니라서 필지 안내 카드를 빼고 동네 거래만 보여 준다", async () => {
    show(null);
    expect(screen.queryByText("필지 정보는 아직 제공하지 않아요")).toBeNull();
    await waitFor(() => expect(screen.getByText("7건")).toBeTruthy());
  });
  it("필지 기본 정보는 보존하고 없는 규제와 비율을 계산하지 않는다", async () => {
    show({
      pnu: "2650010500101480003",
      jibun_address: "수영구 남천동 148-3",
      land_category: "대",
      land_area_pyeong: 460,
      land_area_m2: 1520.7,
      zonings: [],
      restrictions: [],
    });
    expect(screen.getByText("수영구 남천동 148-3")).toBeTruthy();
    expect(screen.getByText("460평")).toBeTruthy();
    expect(
      screen.getByText("용도지역 · 규제를 불러오지 못했어요"),
    ).toBeTruthy();
    expect(screen.queryByText(/지을 수 있는 최대/)).toBeNull();
    await waitFor(() => expect(screen.getByText("7건")).toBeTruthy());
  });
  it("서버의 0~1 면적 비율을 백분율로 보여 준다", async () => {
    show({
      pnu: "2650010500101480003",
      jibun_address: "남천동 148-3",
      land_category: "대",
      zonings: [
        {
          zone_type: "제2종일반주거지역",
          area_ratio: 0.8,
          inclusion: "포함",
          max_building_coverage_ratio: 60,
          max_floor_area_ratio: 250,
        },
      ],
      restrictions: [],
    });
    expect(screen.getByText("포함 · 면적 비율 80%")).toBeTruthy();
    await waitFor(() => expect(screen.getByText("7건")).toBeTruthy());
  });
  it("통계만 재시도할 때 이미 받은 거래는 그대로 유지한다", async () => {
    let requests = 0;
    show(null, {
      ...repo,
      stats: async () => {
        throw new Error("통계 연결 실패");
      },
      transactions: async () => {
        requests += 1;
        if (requests > 1) return new Promise(() => {});
        return {
          data: [
            {
              id: "land-1",
              address: "받은 토지 거래",
              contract_date: "2026-09-22",
              price: 210000000,
              price_per_pyeong: 10000000,
              is_cancelled: false,
            },
          ],
          meta: {},
        };
      },
    } as unknown as Repository);
    await screen.findByText("받은 토지 거래");
    fireEvent.click(screen.getByText("통계 다시 시도"));
    expect(screen.getByText("받은 토지 거래")).toBeTruthy();
  });
  it("지역 통계 실패에도 받은 거래를 그대로 보여 준다", async () => {
    show(null, {
      ...repo,
      stats: async () => {
        throw new Error("통계 연결 실패");
      },
      transactions: async () => ({
        data: [
          {
            id: "land-1",
            address: "남천동",
            contract_date: "2026-09-22",
            price: 210000000,
            price_per_pyeong: 10000000,
            is_cancelled: false,
          },
        ],
        meta: {},
      }),
    } as unknown as Repository);
    await waitFor(() => expect(screen.getByText("남천동")).toBeTruthy());
    expect(screen.getByText("통계 연결 실패")).toBeTruthy();
  });
});

it("토지 화면은 다른 유형의 입력을 받아도 토지 매매만 요청한다",async()=>{
 const transactions=vi.fn(async()=>({data:[],meta:{}}));const stats=vi.fn(async()=>({data:{transaction_count:0,trend:[]}}));
 const repo:any={mode:"api",transactions,stats};
 render(<LandContent repo={repo} filters={{...DEFAULT_FILTERS,property_type:"apartment",deal_type:"jeonse"}} bbox={[129,35,129.3,35.3]} parcel={null} region={{code:"26350",name:"해운대구"}} unit="평" onRetry={()=>{}} onList={()=>{}} onHelp={()=>{}}/>);
 await waitFor(()=>expect(transactions).toHaveBeenCalled());
 expect((transactions.mock.calls as any)[0][0]).toMatchObject({property_type:"land",deal_type:"sale"});
 expect((stats.mock.calls as any)[0][0]).toMatchObject({property_type:"land",deal_type:"sale"});
});
