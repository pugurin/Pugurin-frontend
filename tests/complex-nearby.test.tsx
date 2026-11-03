import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { Linking } from "react-native";
import { ComplexContent, TX_PREVIEW } from "../src/screens/MarketSheets";
import { ApiClient } from "../src/api/client";
import { Repository } from "../src/api/repository";
import {
  COMPLEXES,
  SCHOOLS,
  SCHOOL_META,
  TRANSACTIONS,
} from "../src/api/fixtures";
import { DEFAULT_FILTERS } from "../src/state/market";
import type { Nearby } from "../src/api/types";

vi.mock("../src/components/Chart", () => ({ Chart: () => null }));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const COMPLEX = COMPLEXES[0];
const school = (id: string, distance_m: number) => ({
  ...SCHOOLS.find((x) => x.id === id)!,
  distance_m,
});
const NEARBY: Nearby = {
  schools: {
    radius_m: 3000,
    elementary: [school("s-udong-elem", 274), school("s-centum-elem", 1520)],
    middle: [school("s-haeundae-mid", 900)],
    high: [],
  },
};

function makeRepo(nearby: () => Promise<any>, txCount = 6) {
  const data = Array.from({ length: txCount }, (_, i) => ({
    ...TRANSACTIONS[0],
    id: `tx-${i}`,
    floor: i + 1,
  }));
  return {
    mode: "api",
    complex: async () => ({ data: COMPLEX }),
    transactions: async () => ({
      data,
      meta: { page: 1, total_pages: 1, total: txCount },
    }),
    analysis: async () => ({ data: null }),
    stats: async () => ({ data: { trend: [], transaction_count: 0 } }),
    auctions: async () => ({ data: [] }),
    nearby: vi.fn(nearby),
  } as any;
}

function renderFull(repo: any) {
  return render(
    <ComplexContent
      id={COMPLEX.id}
      repo={repo}
      filters={DEFAULT_FILTERS}
      stage="full"
      onStage={() => {}}
      onHelp={() => {}}
      notify={() => {}}
      unit="평"
    />,
  );
}

const floors = () => screen.queryAllByText(/\d+층/).length;

describe("단지 상세 거래 이력", () => {
  it(`처음에는 ${TX_PREVIEW}건만 보여주고 더보기를 누르면 나머지를 펼친다`, async () => {
    renderFull(makeRepo(async () => ({ data: NEARBY, meta: SCHOOL_META })));
    await screen.findByText("더보기");
    expect(floors()).toBe(TX_PREVIEW);
    fireEvent.click(screen.getByText("더보기"));
    expect(floors()).toBe(6);
    expect(screen.queryByText("더보기")).toBeNull();
  });

  it(`${TX_PREVIEW}건 이하면 더보기를 띄우지 않는다`, async () => {
    renderFull(
      makeRepo(async () => ({ data: NEARBY, meta: SCHOOL_META }), 3),
    );
    await screen.findByText("거래 이력");
    expect(floors()).toBe(3);
    expect(screen.queryByText("더보기")).toBeNull();
  });
});

describe("단지 상세 주변 학교", () => {
  it("거래 이력 아래에 초·중·고를 나눠 보여주고, 없는 학교급은 반경 안에 없다고 쓴다", async () => {
    renderFull(makeRepo(async () => ({ data: NEARBY, meta: SCHOOL_META })));
    await screen.findByText("우동초등학교");
    expect(screen.getByText("센텀초등학교")).toBeTruthy();
    expect(screen.getByText("해운대중학교")).toBeTruthy();
    expect(screen.getByText("3.0km 안에 없어요")).toBeTruthy();
    expect(screen.getByText(/직선 274m/)).toBeTruthy();
    expect(screen.getByText(/직선 1\.5km/)).toBeTruthy();
    expect(
      screen.getByText("배정 학교(학군)가 아니라 직선거리로 가까운 학교입니다"),
    ).toBeTruthy();
    // 주변 학교는 거래 이력보다 뒤에 놓인다
    const html = document.body.innerHTML;
    expect(html.indexOf("거래 이력")).toBeLessThan(html.indexOf("주변 학교"));
  });

  it("학교를 누르면 홈페이지를 열고, 홈페이지가 없는 학교는 누를 수 없다", async () => {
    const open = vi.spyOn(Linking, "openURL").mockResolvedValue(true);
    renderFull(makeRepo(async () => ({ data: NEARBY, meta: SCHOOL_META })));
    fireEvent.click(await screen.findByLabelText("우동초등학교 홈페이지 열기"));
    expect(open).toHaveBeenCalledWith("https://udong.es.kr");
    expect(screen.queryByLabelText("센텀초등학교 홈페이지 열기")).toBeNull();
    expect(screen.getByText("홈페이지 없음")).toBeTruthy();
  });

  it("주변 학교를 못 불러오면 칸째로 숨긴다", async () => {
    const repo = makeRepo(async () => {
      throw new Error("DATA_NOT_READY");
    });
    renderFull(repo);
    await screen.findByText("거래 이력");
    await waitFor(() => expect(repo.nearby).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText("주변 학교")).toBeNull());
  });
});

describe("샘플 모드 nearby", () => {
  it("단지에서 가까운 순으로 학교급별 최대 3곳, 3km 안만 고른다", async () => {
    const repo = new Repository("sample", new ApiClient("", "test-device"));
    const r = await repo.nearby(COMPLEX.id);
    const el = r.data.schools.elementary;
    expect(el.map((x) => x.id)).toEqual(["s-udong-elem", "s-centum-elem"]);
    expect(el[0].distance_m!).toBeLessThan(el[1].distance_m!);
    expect(r.data.schools.middle.map((x) => x.id)).toEqual(["s-haeundae-mid"]);
    // 특수학교는 학교급 목록에 넣지 않는다
    expect(JSON.stringify(r.data)).not.toContain("s-haemaru-special");
  });

  it("API 모드는 /complexes/{id}/nearby를 부른다", async () => {
    const client = new ApiClient("", "test-device");
    const get = vi
      .spyOn(client, "get")
      .mockResolvedValue({ data: NEARBY } as any);
    await new Repository("api", client).nearby("a b");
    expect(get.mock.calls[0][0]).toBe("/complexes/a%20b/nearby");
  });
});
