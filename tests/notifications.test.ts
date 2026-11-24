import { describe, expect, it } from "vitest";
import { ApiClient } from "../src/api/client";
import { SAMPLE_REPORTS } from "../src/api/fixtures";
import { Repository } from "../src/api/repository";

type Call = {
  url: string;
  method: string;
  auth: string | null;
  body: string | null;
};
function fakeServer(respond: (c: Call) => Response) {
  const calls: Call[] = [];
  const fetcher = (async (url: string, init?: RequestInit) => {
    const c = {
      url,
      method: init?.method ?? "GET",
      auth: new Headers(init?.headers).get("Authorization"),
      body: (init?.body as string | undefined) ?? null,
    };
    calls.push(c);
    return respond(c);
  }) as typeof fetch;
  const client = new ApiClient("http://x/api/v1", "dev-1", fetcher, {
    token: () => "tok",
    account: () => "user-1",
    refresh: async () => "tok2",
    expired: () => {},
  });
  return { calls, repo: new Repository("api", client) };
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

describe("알림 API", () => {
  it("notifications는 Bearer와 page를 보내고 unread_count를 돌려준다", async () => {
    const { calls, repo } = fakeServer(() =>
      json({
        data: [],
        meta: {
          total: 3,
          unread_count: 2,
          page: 2,
          page_size: 20,
          total_pages: 1,
        },
      }),
    );
    const r = await repo.notifications(2);
    expect(calls[0].url).toBe(
      "http://x/api/v1/notifications?page=2&page_size=20",
    );
    expect(calls[0].auth).toBe("Bearer tok");
    expect(r.meta?.unread_count).toBe(2);
  });

  it("notification은 id로 상세를 받는다", async () => {
    const { calls, repo } = fakeServer(() => json({ data: { id: "n/1" } }));
    await repo.notification("n/1");
    expect(calls[0].url).toBe("http://x/api/v1/notifications/n%2F1");
    expect(calls[0].auth).toBe("Bearer tok");
  });

  it("markNotificationsRead는 ids 또는 all을 POST 본문으로 보낸다", async () => {
    const { calls, repo } = fakeServer(
      () => new Response(null, { status: 204 }),
    );
    await repo.markNotificationsRead(["a", "b"]);
    await repo.markNotificationsRead("all");
    expect(calls.map((c) => [c.method, c.url, JSON.parse(c.body!)])).toEqual([
      ["POST", "http://x/api/v1/notifications/read", { ids: ["a", "b"] }],
      ["POST", "http://x/api/v1/notifications/read", { all: true }],
    ]);
  });

  it("reportSetting은 GET /notifications/settings를 Bearer로 받는다", async () => {
    const { calls, repo } = fakeServer(() =>
      json({ data: { weekly_report: true } }),
    );
    expect(await repo.reportSetting()).toEqual({ weekly_report: true });
    expect(calls.map((c) => [c.method, c.url, c.auth])).toEqual([
      ["GET", "http://x/api/v1/notifications/settings", "Bearer tok"],
    ]);
  });

  it("setReportSetting(false)는 PUT 본문 {weekly_report:false}를 보내고 서버 값을 돌려준다", async () => {
    const { calls, repo } = fakeServer(() =>
      json({ data: { weekly_report: false } }),
    );
    expect(await repo.setReportSetting(false)).toEqual({
      weekly_report: false,
    });
    expect(
      calls.map((c) => [c.method, c.url, c.auth, JSON.parse(c.body!)]),
    ).toEqual([
      [
        "PUT",
        "http://x/api/v1/notifications/settings",
        "Bearer tok",
        { weekly_report: false },
      ],
    ]);
  });
});

describe("샘플 모드", () => {
  it("GET /interests에 regions가 없다", async () => {
    const repo = new Repository("sample", new ApiClient("http://x", "d"));
    expect(Object.keys((await repo.interestIds()).data).sort()).toEqual([
      "auctions",
      "complexes",
    ]);
  });

  it("리포트 받기는 기본 켜짐이고, 끄면 다시 읽어도 꺼져 있다", async () => {
    const repo = new Repository("sample", new ApiClient("http://x", "d"));
    expect(await repo.reportSetting()).toEqual({ weekly_report: true });
    expect(await repo.setReportSetting(false)).toEqual({
      weekly_report: false,
    });
    expect(await repo.reportSetting()).toEqual({ weekly_report: false });
    await repo.setReportSetting(true);
    expect(await repo.reportSetting()).toEqual({ weekly_report: true });
  });

  it("알림 샘플에 interest_report가 있고 읽음 처리된다", async () => {
    const repo = new Repository("sample", new ApiClient("http://x", "d"));
    const list = await repo.notifications(1);
    expect(list.data.length).toBeGreaterThanOrEqual(2);
    const unread = list.meta!.unread_count!;
    expect(unread).toBeGreaterThan(0);
    expect(list.data.every((n) => n.kind === "interest_report")).toBe(true);
    const detail = await repo.notification(list.data[0].id);
    expect(detail.data.payload.complexes.length).toBeGreaterThan(0);
    await repo.markNotificationsRead([list.data[0].id]);
    expect((await repo.notifications(1)).meta!.unread_count).toBe(unread - 1);
    await repo.markNotificationsRead("all");
    expect((await repo.notifications(1)).meta!.unread_count).toBe(0);
  });
});

describe("샘플 단지 리포트", () => {
  const repo = new Repository("sample", new ApiClient("http://x", "d"));
  const all = async () => {
    const list = await repo.notifications(1);
    return Promise.all(
      list.data.map(async (n) => (await repo.notification(n.id)).data),
    );
  };

  it("두 통이고 처음엔 하나만 안 읽음", async () => {
    const fresh = new Repository("sample", new ApiClient("http://x", "d"));
    const list = await fresh.notifications(1);
    // 앞선 테스트가 읽음 처리했을 수 있어 목록 길이와 제목 형식만 본다
    expect(list.data).toHaveLength(2);
    for (const n of list.data)
      expect(n.title).toMatch(/^관심 단지 주간 리포트 · \d+\/\d+~\d+\/\d+$/);
    // 처음 상태는 픽스처의 read_at으로 본다: 한 통만 안 읽음
    expect(SAMPLE_REPORTS.filter((n) => n.read_at === null)).toHaveLength(1);
  });

  it("한 통은 소식 있는 단지 2곳 + 조용한 단지 2곳, 경매·정비사업 줄이 있는 통이 있다", async () => {
    const reports = await all();
    const twoTwo = reports.find(
      (r) => r.payload.complexes.length === 2 && r.payload.quiet.length === 2,
    );
    expect(twoTwo).toBeTruthy();
    expect(twoTwo!.payload.total).toBe(4);
    expect(twoTwo!.payload.with_news).toBe(2);
    expect(twoTwo!.payload.headline).toBe(
      "관심 단지 4곳 중 2곳에 새 소식이 있어요",
    );
    const lines = reports.flatMap((r) =>
      r.payload.complexes.flatMap((c) => c.lines),
    );
    expect(lines.some((l) => l.startsWith("새 경매"))).toBe(true);
    expect(lines.some((l) => l.includes("단계가 바뀌었어요"))).toBe(true);
    // 경매가 여럿이면 머리 줄 뒤에 건마다 한 줄
    const many = reports
      .flatMap((r) => r.payload.complexes)
      .find((c) => c.auctions.length >= 2);
    expect(many).toBeTruthy();
    const i = many!.lines.indexOf(`새 경매 ${many!.auctions.length}건`);
    expect(i).toBeGreaterThanOrEqual(0);
  });

  it("payload 필드 이름이 서버 형식 그대로다", async () => {
    const [r] = await all();
    expect(Object.keys(r.payload).sort()).toEqual(
      [
        "complexes",
        "headline",
        "lag_notice",
        "period",
        "quiet",
        "sources",
        "total",
        "with_news",
      ].sort(),
    );
    const c = r.payload.complexes[0];
    expect(Object.keys(c).sort()).toEqual(
      [
        "auctions",
        "dong_name",
        "id",
        "lat",
        "lines",
        "lng",
        "name",
        "redevelopments",
        "sales",
        "sigungu_name",
      ].sort(),
    );
    expect(Object.keys(c.sales).sort()).toEqual([
      "areas",
      "count",
      "more_areas",
    ]);
  });
});
