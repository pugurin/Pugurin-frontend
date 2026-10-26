import React from "react";
import { afterEach, describe, it, expect, vi } from "vitest";
import {
  act,
  cleanup,
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import { MapHome, type Focus } from "../src/screens/MapHome";
import { DEFAULT_FILTERS } from "../src/state/market";
import type { Repository } from "../src/api/repository";
import type { UnavailableReason } from "../src/api/types";
vi.mock("expo-location", () => ({}));
vi.mock("../src/screens/MarketSheets", () => ({
  ComplexContent: () => null,
  RegionContent: () => null,
}));
// 지도는 버튼 두 개로 대신한다: 부산 해운대 근처로 이동(줌 지정) / 그 자리 빈 땅 탭
vi.mock("../src/map/MapCanvas", () => ({
  default: ({ onEvent }: any) => (
    <>
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
      <button
        onClick={() =>
          onEvent({
            type: "camera",
            lat: 35.16,
            lng: 129.16,
            zoom: 12,
            bbox: [129.0, 35.1, 129.3, 35.3],
          })
        }
      >
        멀리서 이동
      </button>
      <button
        onClick={() => onEvent({ type: "mapClick", lat: 35.16, lng: 129.16 })}
      >
        땅 누르기
      </button>
    </>
  ),
}));

function setup(reason: UnavailableReason | null, data: unknown = null, options: { property?: "apartment" | "land"; deal?: "sale" | "jeonse"; focus?: Focus } = {}) {
  const notify = vi.fn();
  const parcelLookup = vi.fn(async () => ({
    data,
    meta: { unavailable_reason: reason },
  }));
  const markers = vi.fn(async () => ({
    data: { level: "dong", markers: [] },
    meta: {},
  }));
  const transactions = vi.fn(async () => ({ data: [], meta: {} }));
  const filters = {...DEFAULT_FILTERS, property_type: options.property ?? "land", deal_type: options.deal ?? "sale" };
  const draw = (focus = options.focus) => (
    <MapHome
      repo={
        {
          mode: "api",
          markers,
          parcelLookup,
          transactions,
          stats: async () => ({ data: { transaction_count: 0, trend: [] } }),
          complex: async () => ({ data: { property_type: "apartment" } }),
        } as unknown as Repository
      }
      filters={filters}
      focus={focus}
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
  const { rerender } = render(draw());
  return { notify, parcelLookup, transactions, focus: (next: Focus) => rerender(draw(next)) };
}

describe("토지 모드에서 땅을 누르면", () => {
  afterEach(cleanup);
  it.each([
    ["no_parcel", "이곳은 토지 정보가 없어요"],
    ["out_of_service_area", "부산 지역만 지원해요"],
  ] as const)("%s → %s", async (reason, message) => {
    const { notify, parcelLookup } = setup(reason);
    fireEvent.click(screen.getByText("확대해서 이동"));
    fireEvent.click(screen.getByText("땅 누르기"));
    await waitFor(() => expect(notify).toHaveBeenCalledWith(message));
    expect(parcelLookup).toHaveBeenCalledWith(35.16, 129.16, expect.anything());
  });

  it("공급처가 없어도 토지 A 시트를 열고 지도 목록 버튼을 숨긴다", async () => {
    const { notify, parcelLookup } = setup("source_unavailable");
    fireEvent.click(screen.getByText("확대해서 이동"));
    fireEvent.click(screen.getByText("땅 누르기"));
    await screen.findByText("토지 정보를 잠시 불러올 수 없어요");
    expect(screen.getByText("선택한 지도 영역")).toBeTruthy();
    expect(screen.queryByText("목록 보기")).toBeNull();
    expect(notify).not.toHaveBeenCalled();
    expect(parcelLookup).toHaveBeenCalledWith(35.16, 129.16, expect.anything());
  });

  it("필지를 받으면 실제 기본 정보를 가진 토지 B 시트를 연다", async () => {
    setup(null, {
      pnu: "2650010500101480003",
      jibun_address: "남천동 148-3",
      land_category: "대",
      land_area_pyeong: 460,
    });
    fireEvent.click(screen.getByText("확대해서 이동"));
    fireEvent.click(screen.getByText("땅 누르기"));
    await screen.findByText("남천동 148-3");
    expect(screen.getByText("460평")).toBeTruthy();
    expect(screen.queryByText("토지 상세 화면은 준비 중이에요")).toBeNull();
  });

  it("아파트 전세의 주소 검색은 이동만 하고 토지 조회를 하지 않는다", () => {
    const { parcelLookup } = setup("source_unavailable", null, {property:"apartment",deal:"jeonse",focus:{nonce:1,result:{type:"address",address:"우동 주소",lat:35.16,lng:129.16}}});
    expect(parcelLookup).not.toHaveBeenCalled();
  });

  it("토지 주소 검색은 도착한 지도의 실제 영역으로 조회한다", async () => {
    const { parcelLookup, transactions } = setup("source_unavailable", null, {focus:{nonce:1,result:{type:"address",address:"우동 주소",lat:35.16,lng:129.16}}});
    expect(parcelLookup).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("확대해서 이동"));
    await screen.findByText("토지 정보를 잠시 불러올 수 없어요");
    expect(transactions).toHaveBeenCalledWith(expect.anything(), {region:undefined,bbox:[129.15,35.15,129.17,35.17]},expect.anything());
  });

  it("토지 조회 뒤 다른 단지를 선택하면 늦은 토지 응답을 무시한다", async () => {
    const { parcelLookup, focus } = setup("source_unavailable");
    let complete:(value:any)=>void=()=>{};
    parcelLookup.mockImplementationOnce(()=>new Promise(resolve=>{complete=resolve;}));
    fireEvent.click(screen.getByText("확대해서 이동"));
    fireEvent.click(screen.getByText("땅 누르기"));
    focus({nonce:2,result:{type:"complex",complex_id:"complex-1",name:"다른 단지",lat:35.17,lng:129.17}});
    await act(async()=>{complete({data:{pnu:"2650010500101480003",jibun_address:"이전 토지"},meta:{}});});
    expect(screen.queryByText("이전 토지")).toBeNull();
  });

  it("줌 14 미만이면 조회하지 않고 확대를 안내한다", async () => {
    const { notify, parcelLookup } = setup("source_unavailable");
    fireEvent.click(screen.getByText("멀리서 이동"));
    fireEvent.click(screen.getByText("땅 누르기"));
    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith(
        "조금 더 확대하면 땅을 하나씩 골라 볼 수 있어요",
      ),
    );
    expect(parcelLookup).not.toHaveBeenCalled();
  });
});
