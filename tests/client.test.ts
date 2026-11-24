import { describe, it, expect, vi } from "vitest";
import { ApiClient, ApiError, type ClientAuth } from "../src/api/client";
describe("API 응답 처리", () => {
  it("X-Device-Id를 전송하고 성공 응답 data를 보존한다", async () => {
    let headers: Headers | undefined;
    const client = new ApiClient(
      "http://localhost:8000/api/v1",
      "device-uuid",
      async (_url, init) => {
        headers = new Headers(init?.headers);
        return new Response(JSON.stringify({ data: [{ id: "1" }], meta: {} }));
      },
    );
    const r = await client.get("/glossary");
    expect(headers?.get("X-Device-Id")).toBe("device-uuid");
    expect(r.data).toEqual([{ id: "1" }]);
  });
  it("304 응답은 이전 캐시를 사용한다", async () => {
    let call = 0;
    const client = new ApiClient("http://localhost/api/v1", "d", async () =>
      ++call === 1
        ? new Response(JSON.stringify({ data: { level: "dong" }, meta: {} }), {
            headers: { ETag: "abc" },
          })
        : new Response(null, { status: 304 }),
    );
    const first = await client.get("/map/markers");
    const second = await client.get("/map/markers");
    expect(second).toEqual(first);
  });
  it("429 에러는 다시 시도할 시간을 전달한다", async () => {
    const client = new ApiClient(
      "http://localhost/api/v1",
      "d",
      async () =>
        new Response(
          JSON.stringify({
            error: {
              code: "RATE_LIMITED",
              message: "잠시 후 다시 시도해 주세요",
            },
          }),
          { status: 429, headers: { "Retry-After": "30" } },
        ),
    );
    await expect(client.get("/glossary")).rejects.toMatchObject({
      code: "RATE_LIMITED",
      retryAfter: 30,
    });
  });
});

describe("로그인 토큰", () => {
  const unauthorized = () =>
    new Response(
      JSON.stringify({
        error: { code: "UNAUTHORIZED", message: "다시 로그인해 주세요" },
      }),
      { status: 401 },
    );
  const ok = () => new Response(JSON.stringify({ data: { ok: true } }));
  // 지금 로그인 상태(토큰·계정)를 바꿔 가며 쓰는 가짜 인증
  function fakeAuth(over: Partial<ClientAuth> = {}) {
    const state = {
      token: "old" as string | undefined,
      account: "a" as string | undefined,
    };
    const auth: ClientAuth = {
      token: () => state.token,
      account: () => state.account,
      refresh: vi.fn(async () => (state.token = "new")),
      expired: vi.fn(),
      ...over,
    };
    return { state, auth };
  }
  function clientWith(
    auth: ClientAuth,
    respond: (a: string | null) => Response,
  ) {
    const seen: (string | null)[] = [];
    const client = new ApiClient(
      "http://x/api/v1",
      "d",
      async (_url, init) => {
        const a = new Headers(init?.headers).get("Authorization");
        seen.push(a);
        return respond(a);
      },
      auth,
    );
    return { client, seen };
  }
  it("로그인이 필요한 읽기(관심 목록)와 쓰기에만 Bearer 토큰을 붙인다", async () => {
    const { auth } = fakeAuth();
    const { client, seen } = clientWith(auth, () => ok());
    await client.get("/interests", undefined, { auth: true });
    await client.send("PUT", "/interests/complexes/c1");
    // 지도·검색 같은 공개 읽기에는 붙이지 않는다
    await client.get("/map/markers");
    await client.get("/search?q=a");
    expect(seen).toEqual(["Bearer old", "Bearer old", null, null]);
  });
  it("로그인하지 않았으면 토큰을 붙이지 않는다", async () => {
    const { state, auth } = fakeAuth();
    state.token = undefined;
    const { client, seen } = clientWith(auth, () => ok());
    await client.get("/interests", undefined, { auth: true });
    expect(seen).toEqual([null]);
  });
  it("토큰이 만료돼 401이면 한 번 갱신하고 다시 보낸다", async () => {
    const { state, auth } = fakeAuth();
    const { client, seen } = clientWith(auth, (a) =>
      a === "Bearer old" ? unauthorized() : ok(),
    );
    expect(
      (
        await client.get<{ ok: boolean }>("/interests", undefined, {
          auth: true,
        })
      ).data.ok,
    ).toBe(true);
    state.token = "old";
    await client.send("DELETE", "/interests/complexes/c1");
    expect(seen).toEqual([
      "Bearer old",
      "Bearer new",
      "Bearer old",
      "Bearer new",
    ]);
    expect(auth.refresh).toHaveBeenCalledWith("old");
    expect(auth.expired).not.toHaveBeenCalled();
  });
  it("401을 받는 사이 다른 요청이 이미 갱신했으면 갱신하지 않고 새 토큰으로 다시 보낸다", async () => {
    const { state, auth } = fakeAuth();
    const { client, seen } = clientWith(auth, (a) => {
      if (a !== "Bearer old") return ok();
      state.token = "new-by-other";
      return unauthorized();
    });
    await client.send("PUT", "/interests/complexes/c1");
    expect(seen).toEqual(["Bearer old", "Bearer new-by-other"]);
    expect(auth.refresh).not.toHaveBeenCalled();
  });
  it("갱신이 401이어도 그사이 먼저 끝난 갱신이 있으면(유예 안 동시 갱신) 세션을 지우지 않고 그 토큰으로 다시 보낸다", async () => {
    const { state, auth } = fakeAuth({
      refresh: vi.fn(async () => {
        state.token = "new-by-other";
        throw new ApiError(
          "이미 다른 요청이 로그인을 갱신했어요",
          "UNAUTHORIZED",
        );
      }),
    });
    const { client, seen } = clientWith(auth, (a) =>
      a === "Bearer old" ? unauthorized() : ok(),
    );
    await client.send("PUT", "/interests/complexes/c1");
    expect(seen).toEqual(["Bearer old", "Bearer new-by-other"]);
    expect(auth.expired).not.toHaveBeenCalled();
  });
  it("갱신이 401로 끝나면(만료·폐기) 세션이 끝났다고 알리고 401을 올린다", async () => {
    const { auth } = fakeAuth({
      refresh: vi.fn(async () => {
        throw new ApiError("다시 로그인해 주세요", "UNAUTHORIZED");
      }),
    });
    const { client } = clientWith(auth, () => unauthorized());
    await expect(
      client.get("/interests", undefined, { auth: true }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(auth.expired).toHaveBeenCalledTimes(1);
  });
  it("갱신이 네트워크 오류로 실패하면 세션은 그대로 둔다", async () => {
    const { auth } = fakeAuth({
      refresh: vi.fn(async () => {
        throw new ApiError("네트워크에 연결할 수 없어요");
      }),
    });
    const { client } = clientWith(auth, () => unauthorized());
    await expect(
      client.send("PUT", "/interests/complexes/c1"),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(auth.expired).not.toHaveBeenCalled();
  });
  it("갱신하는 사이 다른 계정으로 바뀌면 새 계정 토큰으로 다시 보내지 않는다", async () => {
    const { state, auth } = fakeAuth({
      refresh: vi.fn(async () => {
        state.account = "b";
        return (state.token = "token-of-b");
      }),
    });
    const { client, seen } = clientWith(auth, (a) =>
      a === "Bearer old" ? unauthorized() : ok(),
    );
    await expect(
      client.send("PUT", "/interests/complexes/c1"),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(seen).toEqual(["Bearer old"]);
    expect(auth.expired).not.toHaveBeenCalled();
  });
  it("401을 받는 사이 다른 계정으로 바뀌었으면 그 계정 토큰으로 다시 보내지 않는다", async () => {
    const { state, auth } = fakeAuth();
    const { client, seen } = clientWith(auth, (a) => {
      if (a !== "Bearer old") return ok();
      state.account = "b";
      state.token = "token-of-b";
      return unauthorized();
    });
    await expect(
      client.send("PUT", "/interests/complexes/c1"),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(seen).toEqual(["Bearer old"]);
    expect(auth.refresh).not.toHaveBeenCalled();
  });
});
