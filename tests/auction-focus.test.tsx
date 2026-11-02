import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { MapHome, type AuctionFocus } from "../src/screens/MapHome";
import { DEFAULT_FILTERS } from "../src/state/market";
import type { Repository } from "../src/api/repository";

vi.mock("expo-location", () => ({}));
vi.mock("../src/components/Sheet", () => ({
  Sheet: ({ children }: any) => <aside>{children}</aside>,
}));
vi.mock("../src/screens/MarketSheets", () => ({
  ComplexContent: () => null,
  RegionContent: () => null,
}));
// MapCanvas 목: 받은 props를 기록하고 버튼으로 카메라 이벤트를 낸다
const map = vi.hoisted(() => ({ props: null as any }));
vi.mock("../src/map/MapCanvas", () => ({
  default: (props: any) => {
    map.props = props;
    return (
      <button
        onClick={() =>
          props.onEvent({
            type: "camera",
            lat: 35.16,
            lng: 129.16,
            zoom: 17,
            bbox: [129.15, 35.15, 129.17, 35.17],
          })
        }
      >
        지도 이동
      </button>
    );
  },
}));
afterEach(() => {
  cleanup();
  map.props = null;
});

function setup(first: AuctionFocus | null) {
  // 시트는 상세를 불러오다 멈춘 상태로 둔다. 시트 내용은 auction-sheet 테스트가 본다
  const auction = vi.fn(() => new Promise<never>(() => {}));
  const repo = {
    mode: "api",
    markers: vi.fn(async () => ({ data: { markers: [] }, meta: {} })),
    auctions: vi.fn(async () => ({ data: [], meta: {} })),
    auction,
  } as unknown as Repository;
  const draw = (focusAuction: AuctionFocus | null) => (
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
      focusAuction={focusAuction}
    />
  );
  const { rerender } = render(draw(first));
  return { auction, show: (f: AuctionFocus | null) => rerender(draw(f)) };
}

describe("경매 목록에서 고른 경매로 포커스", () => {
  it("좌표가 있으면 줌 14 이상으로 옮기고 그 경매 시트를 연다", async () => {
    const { auction } = setup({
      id: "court:1",
      lat: 35.1,
      lng: 129.1,
      nonce: 1,
    });
    await act(async () => {});
    expect(map.props.command).toMatchObject({
      type: "move",
      lat: 35.1,
      lng: 129.1,
      zoom: 14,
    });
    expect(map.props.selected).toBe("auction:court:1");
    expect(auction).toHaveBeenCalledWith("court:1", expect.anything());
  });

  it("지금 줌이 14보다 크면 줌을 낮추지 않는다", async () => {
    const { show } = setup(null);
    await act(async () => {
      screen.getByText("지도 이동").click();
    });
    show({ id: "court:2", lat: 35.2, lng: 129.2, nonce: 1 });
    await act(async () => {});
    expect(map.props.command).toMatchObject({
      lat: 35.2,
      lng: 129.2,
      zoom: 17,
    });
    expect(map.props.selected).toBe("auction:court:2");
  });

  it("좌표가 없으면 지도를 옮기지 않고 시트만 연다", async () => {
    setup({ id: "court:3", lat: null, lng: null, nonce: 1 });
    await act(async () => {});
    expect(map.props.command).toBeUndefined();
    expect(map.props.selected).toBe("auction:court:3");
  });

  it("nonce가 바뀔 때만 다시 반응한다", async () => {
    const f = { id: "court:1", lat: 35.1, lng: 129.1, nonce: 1 };
    const { show } = setup(f);
    await act(async () => {});
    const first = map.props.command;
    show(f);
    await act(async () => {});
    expect(map.props.command).toBe(first);
    show({ ...f, id: "court:9", nonce: 2 });
    await act(async () => {});
    expect(map.props.selected).toBe("auction:court:9");
    expect(map.props.command.nonce).toBeGreaterThan(first.nonce);
  });
});
