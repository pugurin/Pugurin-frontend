import React from "react";
import { afterEach, describe, it, expect, vi } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MapHome } from "../src/screens/MapHome";
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
          onEvent({ type: "camera", lat: 35.16, lng: 129.16, zoom: 15, bbox: [129.15, 35.15, 129.17, 35.17] })
        }
      >
        확대해서 이동
      </button>
      <button
        onClick={() =>
          onEvent({ type: "camera", lat: 35.16, lng: 129.16, zoom: 12, bbox: [129.0, 35.1, 129.3, 35.3] })
        }
      >
        멀리서 이동
      </button>
      <button onClick={() => onEvent({ type: "mapClick", lat: 35.16, lng: 129.16 })}>땅 누르기</button>
    </>
  ),
}));

function setup(reason: UnavailableReason | null, data: unknown = null) {
  const notify = vi.fn();
  const parcelLookup = vi.fn(async () => ({ data, meta: { unavailable_reason: reason } }));
  const markers = vi.fn(async () => ({ data: { level: "dong", markers: [] }, meta: {} }));
  render(
    <MapHome
      repo={{ mode: "api", markers, parcelLookup } as unknown as Repository}
      filters={{ ...DEFAULT_FILTERS, property_type: "land", deal_type: "sale" }}
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
  return { notify, parcelLookup };
}

describe("토지 모드에서 땅을 누르면", () => {
  afterEach(cleanup);
  it.each([
    ["source_unavailable", "토지 정보를 잠시 불러올 수 없어요"],
    ["no_parcel", "이곳은 토지 정보가 없어요"],
    ["out_of_service_area", "부산 지역만 지원해요"],
  ] as const)("%s → %s", async (reason, message) => {
    const { notify, parcelLookup } = setup(reason);
    fireEvent.click(screen.getByText("확대해서 이동"));
    fireEvent.click(screen.getByText("땅 누르기"));
    await waitFor(() => expect(notify).toHaveBeenCalledWith(message));
    expect(parcelLookup).toHaveBeenCalledWith(35.16, 129.16, expect.anything());
  });

  it("줌 14 미만이면 조회하지 않고 확대를 안내한다", async () => {
    const { notify, parcelLookup } = setup("source_unavailable");
    fireEvent.click(screen.getByText("멀리서 이동"));
    fireEvent.click(screen.getByText("땅 누르기"));
    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith("조금 더 확대하면 땅을 하나씩 골라 볼 수 있어요"),
    );
    expect(parcelLookup).not.toHaveBeenCalled();
  });
});
