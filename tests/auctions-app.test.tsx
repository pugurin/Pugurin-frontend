import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import App from "../App";

vi.mock("expo-font", () => ({ useFonts: () => [true] }));
// 기기 저장소(AsyncStorage·expo-crypto)는 쓰지 않는다
vi.mock("../src/state/storage", () => ({
  deviceId: async () => "device-1",
  loadStored: async (_k: string, fallback: unknown) => fallback,
  store: async () => {},
  remember: (list: unknown[]) => list,
}));
vi.mock("../src/glossary/matching", () => ({
  loadMatchingRecord: async () => null,
  matchingStatus: () => undefined,
}));
// MapHome 목: 받은 props를 보여 주고, 버튼으로 경매 목록을 연다
vi.mock("../src/screens/MapHome", () => ({
  MapHome: (props: any) => (
    <div>
      <p data-testid="focus">{JSON.stringify(props.focusAuction ?? null)}</p>
      <button
        onClick={() =>
          props.onAuctionList({
            bbox: [129, 35, 129.2, 35.2],
            complexId: "cx",
            name: "해운대단지",
          })
        }
      >
        목록 열기
      </button>
    </div>
  ),
}));
// 목록 화면 목: 받은 props를 보여 주고, 버튼으로 줄을 고른다
const picked = vi.hoisted(() => ({
  row: { id: "court:1", lat: 35.1, lng: 129.1 } as any,
}));
vi.mock("../src/screens/AuctionsScreen", () => ({
  AuctionsScreen: (props: any) => (
    <div>
      <p data-testid="auctions-props">
        {JSON.stringify({
          bbox: props.bbox,
          property: props.property,
          complexId: props.complexId,
          name: props.name,
          unit: props.unit,
        })}
      </p>
      <button onClick={() => props.onAuction(picked.row)}>줄 선택</button>
    </div>
  ),
}));

afterEach(cleanup);

describe("App의 경매 목록 연결", () => {
  it("지도에서 경매 목록을 열면 지도 범위·유형·단지 정보를 넘긴다", async () => {
    render(<App />);
    fireEvent.click(await screen.findByText("목록 열기"));
    const props = JSON.parse(
      (await screen.findByTestId("auctions-props")).textContent!,
    );
    expect(props).toEqual({
      bbox: [129, 35, 129.2, 35.2],
      property: "apartment",
      complexId: "cx",
      name: "해운대단지",
      unit: "평",
    });
  });

  it("줄을 누르면 목록을 닫고 지도에 그 경매 포커스를 넘긴다", async () => {
    render(<App />);
    expect(
      JSON.parse((await screen.findByTestId("focus")).textContent!),
    ).toBeNull();
    fireEvent.click(await screen.findByText("목록 열기"));
    fireEvent.click(await screen.findByText("줄 선택"));
    expect(screen.queryByTestId("auctions-props")).toBeNull();
    const f = JSON.parse(screen.getByTestId("focus").textContent!);
    expect(f).toMatchObject({ id: "court:1", lat: 35.1, lng: 129.1 });
    expect(typeof f.nonce).toBe("number");
    const first = f.nonce;
    // 같은 줄을 다시 골라도 새 nonce로 다시 반응한다
    await new Promise((r) => setTimeout(r, 2));
    fireEvent.click(screen.getByText("목록 열기"));
    fireEvent.click(await screen.findByText("줄 선택"));
    const second = JSON.parse(screen.getByTestId("focus").textContent!).nonce;
    expect(second).toBeGreaterThan(first);
  });

  it("좌표가 없는 줄도 포커스로 넘긴다", async () => {
    picked.row = { id: "public:9", lat: null, lng: null };
    render(<App />);
    fireEvent.click(await screen.findByText("목록 열기"));
    fireEvent.click(await screen.findByText("줄 선택"));
    expect(JSON.parse(screen.getByTestId("focus").textContent!)).toMatchObject({
      id: "public:9",
      lat: null,
      lng: null,
    });
  });
});
