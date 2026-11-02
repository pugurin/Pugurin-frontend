import { describe, it, expect } from "vitest";
import { Repository } from "../src/api/repository";
import { ApiClient } from "../src/api/client";

describe("학교 Repository", () => {
  it("학교는 bbox만 실어 /schools로 부른다", async () => {
    const urls: string[] = [];
    const repo = new Repository(
      "api",
      new ApiClient("http://api", "d", async (url) => {
        urls.push(String(url));
        return new Response(JSON.stringify({ data: [] }));
      }),
    );
    await repo.schools([129.1, 35.1, 129.2, 35.2]);
    const url = urls[0];
    expect(url).toContain("/schools?bbox=129.1%2C35.1%2C129.2%2C35.2");
    expect(url).not.toContain("level=");
  });
  it("샘플 모드는 bbox 안 학교와 안내 문구를 돌려준다", async () => {
    const sample = new Repository("sample", new ApiClient("http://x", "d"));
    const r = await sample.schools([129.0, 35.0, 129.3, 35.3]);
    expect(r.data.map((s) => s.level).sort()).toEqual([
      "elementary",
      "elementary",
      "high",
      "middle",
      "special",
    ]);
    expect(r.meta?.school_notice).toBe(
      "배정 학교(학군)가 아니라 직선거리로 가까운 학교입니다",
    );
    expect((await sample.schools([0, 0, 1, 1])).data).toEqual([]);
  });
});
