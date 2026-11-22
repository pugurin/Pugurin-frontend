import { describe, it, expect } from "vitest";
import { ApiClient } from "../src/api/client";
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
  it("로그인했으면 읽기·쓰기 요청에 Bearer 토큰을 붙인다", async () => {
    const seen: (string | null)[] = [];
    const client = new ApiClient(
      "http://x/api/v1",
      "d",
      async (_url, init) => {
        seen.push(new Headers(init?.headers).get("Authorization"));
        return new Response(JSON.stringify({ data: {} }));
      },
      { token: () => "acc-1", refresh: async () => "acc-2" },
    );
    await client.get("/interests");
    await client.send("PUT", "/interests/complexes/c1");
    expect(seen).toEqual(["Bearer acc-1", "Bearer acc-1"]);
  });
  it("로그인하지 않았으면 토큰을 붙이지 않는다", async () => {
    let auth: string | null = "x";
    const client = new ApiClient(
      "http://x/api/v1",
      "d",
      async (_url, init) => {
        auth = new Headers(init?.headers).get("Authorization");
        return new Response(JSON.stringify({ data: {} }));
      },
      { token: () => undefined, refresh: async () => undefined },
    );
    await client.get("/glossary");
    expect(auth).toBeNull();
  });
  it("토큰이 만료돼 401이면 한 번 갱신하고 다시 보낸다", async () => {
    const seen: (string | null)[] = [];
    let token = "old";
    const client = new ApiClient(
      "http://x/api/v1",
      "d",
      async (_url, init) => {
        const a = new Headers(init?.headers).get("Authorization");
        seen.push(a);
        return a === "Bearer old"
          ? unauthorized()
          : new Response(JSON.stringify({ data: { ok: true } }));
      },
      {
        token: () => token,
        refresh: async () => (token = "new"),
      },
    );
    expect((await client.get<{ ok: boolean }>("/interests")).data.ok).toBe(
      true,
    );
    token = "old";
    await client.send("DELETE", "/interests/complexes/c1");
    expect(seen).toEqual([
      "Bearer old",
      "Bearer new",
      "Bearer old",
      "Bearer new",
    ]);
  });
  it("갱신도 안 되면 401을 그대로 올린다", async () => {
    const client = new ApiClient(
      "http://x/api/v1",
      "d",
      async () => unauthorized(),
      {
        token: () => "old",
        refresh: async () => {
          throw new Error("refresh failed");
        },
      },
    );
    await expect(client.get("/interests")).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});
