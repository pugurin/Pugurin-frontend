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
import { ApiClient, ApiError } from "../src/api/client";
import { Repository } from "../src/api/repository";
import { AUCTIONS, AUCTION_META, COMPLEXES } from "../src/api/fixtures";
import { StarButton } from "../src/components/StarButton";
import { InterestsScreen } from "../src/screens/InterestsScreen";
import {
  InterestsContext,
  InterestsProvider,
  useInterests,
} from "../src/state/interests";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

type Call = { url: string; method: string; device: string | null };
function fakeServer(
  respond: (c: Call) => Response = () => new Response(null, { status: 204 }),
) {
  const calls: Call[] = [];
  const fetcher = (async (url: string, init?: RequestInit) => {
    const c = {
      url,
      method: init?.method ?? "GET",
      device: new Headers(init?.headers).get("X-Device-Id"),
    };
    calls.push(c);
    return respond(c);
  }) as typeof fetch;
  return {
    calls,
    repo: new Repository(
      "api",
      new ApiClient("http://x/api/v1", "dev-1", fetcher),
    ),
  };
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

describe("관심 등록 API", () => {
  it("PUT·DELETE를 기기 id와 함께 보내고 경매 id는 인코딩한다", async () => {
    const { calls, repo } = fakeServer((c) =>
      c.method === "PUT"
        ? json({ data: { target_id: "x", added_at: "2026-11-16T00:00:00Z" } })
        : new Response(null, { status: 204 }),
    );
    await repo.setInterest("complex", "c1", true);
    await repo.setInterest("auction", "CA-41-2024-112075-1", false);
    expect(calls).toEqual([
      {
        url: "http://x/api/v1/interests/complexes/c1",
        method: "PUT",
        device: "dev-1",
      },
      {
        url: "http://x/api/v1/interests/auctions/CA-41-2024-112075-1",
        method: "DELETE",
        device: "dev-1",
      },
    ]);
  });

  it("409는 서버 메시지와 코드를 그대로 올린다", async () => {
    const { repo } = fakeServer(() =>
      json(
        { error: { code: "CONFLICT", message: "관심 단지는 200개까지예요" } },
        409,
      ),
    );
    await expect(repo.setInterest("complex", "c1", true)).rejects.toMatchObject(
      {
        code: "CONFLICT",
        message: "관심 단지는 200개까지예요",
      },
    );
  });

  it("샘플 모드는 담은 순서의 역순으로 목록을 주고, 없는 대상은 404", async () => {
    const repo = new Repository("sample", new ApiClient("http://x", "d"));
    const [a, b] = COMPLEXES;
    await repo.setInterest("complex", a.id, true);
    await new Promise((r) => setTimeout(r, 2));
    await repo.setInterest("complex", b.id, true);
    expect((await repo.interestIds()).data.complexes.slice(0, 2)).toEqual([
      b.id,
      a.id,
    ]);
    const list = await repo.complexInterests();
    expect(list.data[0].complex.id).toBe(b.id);
    await expect(
      repo.setInterest("auction", "없는-물건", true),
    ).rejects.toBeInstanceOf(ApiError);
    await repo.setInterest("complex", a.id, false);
    await repo.setInterest("complex", b.id, false);
    expect((await repo.interestIds()).data.complexes).toEqual([]);
  });
});

function Harness({
  repo,
  notify,
  account = "user-1",
  needLogin = () => {},
  children,
}: {
  repo: Repository;
  notify: (m: string) => void;
  account?: string | null;
  needLogin?: (kind: "complex" | "auction") => void;
  children: React.ReactNode;
}) {
  const value = useInterests(repo, notify, account, needLogin);
  return <InterestsProvider value={value}>{children}</InterestsProvider>;
}

describe("관심 목록 토큰", () => {
  it("관심 목록 요청에만 로그인 토큰을 붙이고 지도·단지 같은 공개 요청에는 붙이지 않는다", async () => {
    const seen: Record<string, string | null> = {};
    const fetcher = (async (url: string, init?: RequestInit) => {
      seen[`${init?.method ?? "GET"} ${url.replace("http://x/api/v1", "")}`] =
        new Headers(init?.headers).get("Authorization");
      return url.includes("/interests/complexes/")
        ? new Response(null, { status: 204 })
        : json({
            data: url.endsWith("/interests")
              ? { complexes: [], auctions: [] }
              : [],
          });
    }) as typeof fetch;
    const repo = new Repository(
      "api",
      new ApiClient("http://x/api/v1", "dev-1", fetcher, {
        token: () => "acc",
        account: () => "u1",
        refresh: async () => "acc2",
        expired: () => {},
      }),
    );
    await repo.interestIds();
    await repo.complexInterests();
    await repo.auctionInterests();
    await repo.setInterest("complex", "c1", true);
    await repo.complex("c1").catch(() => {});
    await repo.glossary();
    expect(seen).toEqual({
      "GET /interests": "Bearer acc",
      "GET /interests/complexes": "Bearer acc",
      "GET /interests/auctions": "Bearer acc",
      "PUT /interests/complexes/c1": "Bearer acc",
      "GET /complexes/c1": null,
      "GET /glossary": null,
    });
  });
});

describe("샘플 로그인 + 실제 데이터(미리보기)", () => {
  it("관심 목록은 서버에 보내지 않고 앱 안에 두며, 실제 단지·경매는 공개 API로 채운다", async () => {
    const urls: string[] = [];
    const real = { ...COMPLEXES[0], id: "real-complex-1" };
    const realAuction = { ...AUCTIONS[0], id: "real-auction-1" };
    const fetcher = (async (url: string) => {
      urls.push(url.replace("http://x/api/v1", ""));
      if (url.endsWith("/complexes/real-complex-1"))
        return json({ data: real });
      if (url.endsWith("/auctions/real-auction-1"))
        return json({
          data: { ...realAuction, schedule: [], results: [] },
          meta: AUCTION_META,
        });
      return json({ error: { code: "UNAUTHORIZED", message: "x" } }, 401);
    }) as typeof fetch;
    const repo = new Repository(
      "api",
      new ApiClient("http://x/api/v1", "dev-1", fetcher),
      "sample",
    );
    await repo.setInterest("complex", "real-complex-1", true);
    await repo.setInterest("auction", "real-auction-1", true);
    expect((await repo.interestIds()).data).toEqual({
      complexes: ["real-complex-1"],
      auctions: ["real-auction-1"],
    });
    const complexes = await repo.complexInterests();
    expect(complexes.data.map((c) => c.complex.id)).toEqual(["real-complex-1"]);
    const auctions = await repo.auctionInterests();
    expect(auctions.data.map((a) => a.auction.id)).toEqual(["real-auction-1"]);
    // /interests로는 한 번도 보내지 않는다
    expect(urls.some((u) => u.startsWith("/interests"))).toBe(false);
    await repo.setInterest("complex", "real-complex-1", false);
    await repo.setInterest("auction", "real-auction-1", false);
  });
});

describe("로그인", () => {
  it("로그인하지 않았으면 서버에 묻지 않고, 별을 누르면 로그인 안내만 띄운다", async () => {
    const needLogin = vi.fn();
    const { calls, repo } = fakeServer();
    render(
      <Harness
        repo={repo}
        notify={() => {}}
        account={null}
        needLogin={needLogin}
      >
        <StarButton kind="complex" id="c1" />
      </Harness>,
    );
    fireEvent.click(screen.getByRole("button", { name: "관심 단지 등록" }));
    // 어떤 별(단지·경매)인지 알려 안내 제목을 맞춘다
    expect(needLogin).toHaveBeenCalledWith("complex");
    expect(needLogin).toHaveBeenCalledTimes(1);
    // 별은 켜지지 않는다
    expect(screen.getByRole("button", { name: "관심 단지 등록" })).toBeTruthy();
    await act(async () => {});
    expect(calls).toEqual([]);
  });

  it("다른 계정으로 바뀌면 별을 비우고 그 계정의 목록을 다시 받는다", async () => {
    let owner = "a";
    const { calls, repo } = fakeServer(() =>
      json({
        data: { complexes: owner === "a" ? ["c1"] : [], auctions: [] },
      }),
    );
    const view = (account: string | null) => (
      <Harness repo={repo} notify={() => {}} account={account}>
        <StarButton kind="complex" id="c1" />
      </Harness>
    );
    const { rerender } = render(view("a"));
    await screen.findByRole("button", { name: "관심 단지 해제" });
    // 로그아웃하면 바로 꺼진다
    rerender(view(null));
    expect(screen.getByRole("button", { name: "관심 단지 등록" })).toBeTruthy();
    owner = "b";
    rerender(view("b"));
    await waitFor(() =>
      expect(calls.filter((c) => c.url.endsWith("/interests"))).toHaveLength(
        2,
      ),
    );
    expect(screen.getByRole("button", { name: "관심 단지 등록" })).toBeTruthy();
  });
});

describe("별 버튼", () => {
  it("앱을 켤 때 받은 id로 켜지고, 누르면 먼저 꺼진 뒤 DELETE를 보낸다", async () => {
    const { calls, repo } = fakeServer((c) =>
      c.method === "GET"
        ? json({ data: { complexes: ["c1"], auctions: [] } })
        : new Response(null, { status: 204 }),
    );
    render(
      <Harness repo={repo} notify={() => {}}>
        <StarButton kind="complex" id="c1" />
      </Harness>,
    );
    const star = await screen.findByRole("button", { name: "관심 단지 해제" });
    fireEvent.click(star);
    expect(screen.getByRole("button", { name: "관심 단지 등록" })).toBeTruthy();
    await waitFor(() => expect(calls.at(-1)?.method).toBe("DELETE"));
  });

  it("실패하면 별을 되돌리고 서버 메시지를 토스트로 띄운다", async () => {
    const notify = vi.fn();
    const { repo } = fakeServer((c) =>
      c.method === "GET"
        ? json({ data: { complexes: [], auctions: [] } })
        : json(
            {
              error: { code: "CONFLICT", message: "관심 경매는 200개까지예요" },
            },
            409,
          ),
    );
    render(
      <Harness repo={repo} notify={notify}>
        <StarButton kind="auction" id="CA-1" />
      </Harness>,
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "관심 경매 등록" }),
    );
    expect(screen.getByRole("button", { name: "관심 경매 해제" })).toBeTruthy();
    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith("관심 경매는 200개까지예요"),
    );
    expect(screen.getByRole("button", { name: "관심 경매 등록" })).toBeTruthy();
  });
});

describe("세션 만료", () => {
  it("401(세션이 끝남)이면 별을 되돌리되 서버 메시지 토스트는 띄우지 않는다(로그인 안내가 대신 뜬다)", async () => {
    const notify = vi.fn();
    const { repo } = fakeServer((c) =>
      c.method === "GET"
        ? json({ data: { complexes: [], auctions: [] } })
        : json(
            { error: { code: "UNAUTHORIZED", message: "인증이 필요합니다" } },
            401,
          ),
    );
    render(
      <Harness repo={repo} notify={notify}>
        <StarButton kind="complex" id="c1" />
      </Harness>,
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "관심 단지 등록" }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "관심 단지 등록" }),
      ).toBeTruthy(),
    );
    await act(async () => {});
    expect(notify).not.toHaveBeenCalled();
  });
});

describe("관심 목록 화면", () => {
  it("경매 탭은 끝난 경매와 출처를 보여 주고, 별을 끄면 그 줄을 바로 뺀다", async () => {
    const closed = {
      ...AUCTIONS[0],
      id: "CA-9",
      is_closed: true,
      title: "끝난 물건",
    };
    const { repo } = fakeServer((c) =>
      c.url.endsWith("/interests")
        ? json({ data: { complexes: [], auctions: ["CA-9"] } })
        : c.url.endsWith("/interests/auctions")
          ? json({
              data: [{ auction: closed, added_at: "2026-11-16T00:00:00Z" }],
              meta: { source_attribution: AUCTION_META.source_attribution },
            })
          : new Response(null, { status: 204 }),
    );
    render(
      <Harness repo={repo} notify={() => {}}>
        <InterestsScreen
          repo={repo}
          initialTab="auction"
          unit="평"
          onBack={() => {}}
          onComplex={() => {}}
          onAuction={() => {}}
        />
      </Harness>,
    );
    expect(await screen.findByText("끝난 경매")).toBeTruthy();
    expect(screen.getByText(/출처:/)).toBeTruthy();
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "끝난 물건 관심 경매 해제" }),
      );
    });
    expect(screen.queryByText("끝난 경매")).toBeNull();
  });
});

// 응답을 테스트가 직접 풀어 주는 fetcher
function controlledServer() {
  const pending: { call: Call; resolve: (r: Response) => void }[] = [];
  const fetcher = ((url: string, init?: RequestInit) =>
    new Promise<Response>((resolve) => {
      pending.push({
        call: { url, method: init?.method ?? "GET", device: null },
        resolve,
      });
    })) as typeof fetch;
  const repo = new Repository(
    "api",
    new ApiClient("http://x/api/v1", "d", fetcher),
  );
  const next = async (method: string) => {
    await waitFor(() =>
      expect(pending.some((p) => p.call.method === method)).toBe(true),
    );
    const i = pending.findIndex((p) => p.call.method === method);
    return pending.splice(i, 1)[0];
  };
  return { repo, pending, next };
}
const ok204 = () => new Response(null, { status: 204 });
const offline = () => {
  throw new TypeError("offline");
};

describe("별 연타", () => {
  it("켜고 바로 끄면 PUT이 끝난 뒤에 DELETE를 보낸다", async () => {
    const { repo, pending, next } = controlledServer();
    render(
      <Harness repo={repo} notify={() => {}}>
        <StarButton kind="complex" id="c1" />
      </Harness>,
    );
    (await next("GET")).resolve(
      json({ data: { complexes: [], auctions: [] } }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "관심 단지 등록" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "관심 단지 해제" }));
    const put = await next("PUT");
    // PUT이 끝나기 전에는 DELETE를 보내지 않는다
    expect(pending.some((p) => p.call.method === "DELETE")).toBe(false);
    await act(async () => put.resolve(json({ data: {} })));
    (await next("DELETE")).resolve(ok204());
    expect(screen.getByRole("button", { name: "관심 단지 등록" })).toBeTruthy();
  });

  it("켬→끔 사이에 요청이 실패하면 서버가 확인한 값(꺼짐)으로 둔다", async () => {
    const notify = vi.fn();
    const { repo, pending, next } = controlledServer();
    render(
      <Harness repo={repo} notify={notify}>
        <StarButton kind="complex" id="c1" />
      </Harness>,
    );
    (await next("GET")).resolve(
      json({ data: { complexes: [], auctions: [] } }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "관심 단지 등록" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "관심 단지 해제" }));
    fireEvent.click(screen.getByRole("button", { name: "관심 단지 등록" }));
    const put = await next("PUT");
    await act(async () =>
      put.resolve(
        json(
          {
            error: {
              code: "SERVER_ERROR",
              message: "잠시 후 다시 시도해 주세요",
            },
          },
          500,
        ),
      ),
    );
    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith("잠시 후 다시 시도해 주세요"),
    );
    expect(screen.getByRole("button", { name: "관심 단지 등록" })).toBeTruthy();
    expect(pending).toHaveLength(0);
  });

  it("목록을 받는 사이에 누른 별은 누른 대로 둔다", async () => {
    const { repo, next } = controlledServer();
    render(
      <Harness repo={repo} notify={() => {}}>
        <StarButton kind="complex" id="c1" />
      </Harness>,
    );
    const get = await next("GET");
    fireEvent.click(screen.getByRole("button", { name: "관심 단지 등록" }));
    await act(async () =>
      get.resolve(json({ data: { complexes: [], auctions: [] } })),
    );
    expect(screen.getByRole("button", { name: "관심 단지 해제" })).toBeTruthy();
    (await next("PUT")).resolve(json({ data: {} }));
  });

  it("시작할 때 목록을 못 받으면 별을 누를 때 다시 받는다", async () => {
    let gets = 0;
    const fetcher = (async (_url: string, init?: RequestInit) => {
      if ((init?.method ?? "GET") === "GET") {
        gets += 1;
        if (gets === 1) offline();
        return json({ data: { complexes: ["c2"], auctions: [] } });
      }
      return json({ data: {} });
    }) as typeof fetch;
    const repo = new Repository(
      "api",
      new ApiClient("http://x/api/v1", "d", fetcher),
    );
    render(
      <Harness repo={repo} notify={() => {}}>
        <StarButton kind="complex" id="c1" />
        <StarButton kind="complex" id="c2" name="두번째" />
      </Harness>,
    );
    await waitFor(() => expect(gets).toBe(1));
    expect(
      screen.getByRole("button", { name: "두번째 관심 단지 등록" }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "관심 단지 등록" }));
    expect(
      await screen.findByRole("button", { name: "두번째 관심 단지 해제" }),
    ).toBeTruthy();
    expect(gets).toBe(2);
  });
});

describe("관심 지역 별", () => {
  it("GET /interests의 regions로 켜지고 count.region을 센다", async () => {
    let seen = -1;
    function Probe() {
      const v = React.useContext(InterestsContext);
      seen = v.count.region;
      return <StarButton kind="region" id="2644010100" name="대연동" />;
    }
    const { calls, repo } = fakeServer((c) =>
      c.method === "GET"
        ? json({
            data: { complexes: [], auctions: [], regions: ["2644010100", "2644010200"] },
          })
        : new Response(null, { status: 204 }),
    );
    render(
      <Harness repo={repo} notify={() => {}}>
        <Probe />
      </Harness>,
    );
    const star = await screen.findByRole("button", {
      name: "대연동 관심 지역 해제",
    });
    expect(seen).toBe(2);
    fireEvent.click(star);
    await waitFor(() => expect(calls.at(-1)?.method).toBe("DELETE"));
    expect(calls.at(-1)?.url).toBe(
      "http://x/api/v1/interests/regions/2644010100",
    );
    expect(seen).toBe(1);
  });

  it("옛 서버처럼 regions가 없어도 빈 목록으로 본다", async () => {
    const { repo } = fakeServer(() =>
      json({ data: { complexes: [], auctions: [] } }),
    );
    render(
      <Harness repo={repo} notify={() => {}}>
        <StarButton kind="region" id="2644010100" />
      </Harness>,
    );
    await act(async () => {});
    expect(screen.getByRole("button", { name: "관심 지역 등록" })).toBeTruthy();
  });
});

describe("관심 지역 탭", () => {
  const region = (lat: number | null, lng: number | null) => ({
    code: "2644010100",
    name: "대연동",
    sigungu_name: "남구",
    lat,
    lng,
    added_at: "2026-11-16T00:00:00Z",
  });
  const setup = (lat: number | null, lng: number | null) => {
    const onRegion = vi.fn();
    const { repo } = fakeServer((c) =>
      c.url.endsWith("/interests")
        ? json({
            data: { complexes: [], auctions: [], regions: ["2644010100"] },
          })
        : c.url.endsWith("/interests/regions")
          ? json({ data: [region(lat, lng)], meta: {} })
          : new Response(null, { status: 204 }),
    );
    render(
      <Harness repo={repo} notify={() => {}}>
        <InterestsScreen
          repo={repo}
          initialTab="region"
          unit="평"
          onBack={() => {}}
          onComplex={() => {}}
          onAuction={() => {}}
          onRegion={onRegion}
        />
      </Harness>,
    );
    return onRegion;
  };

  it("지역 탭에 담은 동네가 뜨고, 줄을 누르면 좌표로 onRegion을 부른다", async () => {
    const onRegion = setup(35.1356, 129.0859);
    expect(await screen.findByText("대연동")).toBeTruthy();
    expect(screen.getByText(/남구/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /관심 지역 1/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "대연동 지도에서 보기" }));
    expect(onRegion).toHaveBeenCalledWith({ lat: 35.1356, lng: 129.0859 });
  });

  it("좌표가 없으면 줄을 눌러도 이동하지 않는다", async () => {
    const onRegion = setup(null, null);
    await screen.findByText("대연동");
    expect(screen.queryByRole("button", { name: "대연동 지도에서 보기" })).toBeNull();
    expect(onRegion).not.toHaveBeenCalled();
  });

  it("로그인하지 않았으면 지역 별을 눌러 로그인 안내를 띄운다", () => {
    const needLogin = vi.fn();
    const { repo } = fakeServer();
    render(
      <Harness repo={repo} notify={() => {}} account={null} needLogin={needLogin}>
        <StarButton kind="region" id="2644010100" name="대연동" />
      </Harness>,
    );
    fireEvent.click(screen.getByRole("button", { name: "대연동 관심 지역 등록" }));
    expect(needLogin).toHaveBeenCalledTimes(1);
  });
});

