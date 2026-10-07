import { it, expect } from "vitest";
import { apiBase } from "../src/api/base";
it("기존 서버 주소 설정과 API 경로가 포함된 설정 모두 지원한다", () => {
  expect(apiBase("http://host:8000")).toBe("http://host:8000/api/v1");
  expect(apiBase("http://host/api/v1/")).toBe("http://host/api/v1");
});
