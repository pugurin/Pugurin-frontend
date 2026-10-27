import { it, expect } from "vitest";
import { apiBase } from "../src/api/base";
it("기존 서버 주소 설정과 API 경로가 포함된 설정 모두 지원한다", () => {
  expect(apiBase("http://host:8000")).toBe("http://host:8000/api/v1");
  expect(apiBase("http://host/api/v1/")).toBe("http://host/api/v1");
});
it("배포 웹은 같은 주소의 /api/v1 프록시를 쓰도록 상대 경로를 그대로 둔다", async () => {
  expect(apiBase("/api/v1")).toBe("/api/v1");
  expect(apiBase("/")).toBe("/api/v1");
  const { ApiClient } = await import("../src/api/client");
  const urls: string[] = [];
  const fetcher = (async (url: string) => {
    urls.push(url);
    return new Response(JSON.stringify({ data: {}, meta: {} }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as unknown as typeof fetch;
  await new ApiClient(apiBase("/api/v1"), "d", fetcher).get("/health");
  expect(urls).toEqual(["/api/v1/health"]);
});
