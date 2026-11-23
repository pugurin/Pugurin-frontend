import { describe, expect, it } from "vitest";
import { ApiClient } from "../src/api/client";
import { SAMPLE_REGIONS } from "../src/api/fixtures";
import { INTEREST_REGION_LIMIT, Repository } from "../src/api/repository";

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
    refresh: async () => undefined,
  });
  return { calls, repo: new Repository("api", client) };
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

describe("관심 지역 API", () => {
  it("setInterest('region')은 /interests/regions/{code}로 PUT·DELETE한다", async () => {
    const { calls, repo } = fakeServer(
      () => new Response(null, { status: 204 }),
    );
    await repo.setInterest("region", "2644010100", true);
    await repo.setInterest("region", "2644010100", false);
    expect(calls.map((c) => [c.method, c.url])).toEqual([
      ["PUT", "http://x/api/v1/interests/regions/2644010100"],
      ["DELETE", "http://x/api/v1/interests/regions/2644010100"],
    ]);
  });

  it("regionInterests는 /interests/regions를 Bearer로 받는다", async () => {
    const { calls, repo } = fakeServer(() => json({ data: [] }));
    await repo.regionInterests();
    expect(calls[0].url).toBe("http://x/api/v1/interests/regions");
    expect(calls[0].auth).toBe("Bearer tok");
  });
});

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
});

describe("샘플 모드", () => {
  it("관심 지역은 10개까지, 넘으면 CONFLICT", async () => {
    const repo = new Repository("sample", new ApiClient("http://x", "d"));
    const pool = SAMPLE_REGIONS.map((r) => r.code).slice(
      0,
      INTEREST_REGION_LIMIT + 1,
    );
    expect(pool.length).toBe(INTEREST_REGION_LIMIT + 1);
    for (const c of pool.slice(0, INTEREST_REGION_LIMIT))
      await repo.setInterest("region", c, true);
    await expect(
      repo.setInterest("region", pool[INTEREST_REGION_LIMIT], true),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: "관심 지역은 10개까지 등록할 수 있어요",
    });
    for (const c of pool) await repo.setInterest("region", c, false);
  });

  it("알림 샘플에 region_report가 있고 읽음 처리된다", async () => {
    const repo = new Repository("sample", new ApiClient("http://x", "d"));
    const list = await repo.notifications(1);
    expect(list.data.length).toBeGreaterThanOrEqual(2);
    const unread = list.meta!.unread_count!;
    expect(unread).toBeGreaterThan(0);
    const detail = await repo.notification(list.data[0].id);
    expect(detail.data.payload.regions.length).toBeGreaterThan(0);
    await repo.markNotificationsRead([list.data[0].id]);
    expect((await repo.notifications(1)).meta!.unread_count).toBe(unread - 1);
    await repo.markNotificationsRead("all");
    expect((await repo.notifications(1)).meta!.unread_count).toBe(0);
  });
});
