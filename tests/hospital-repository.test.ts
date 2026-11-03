import { describe, it, expect } from "vitest";
import { Repository } from "../src/api/repository";
import { ApiClient } from "../src/api/client";

describe("병원 Repository", () => {
  it("병원은 bbox와 일반 진료 tier를 실어 /hospitals로 부른다", async () => {
    const urls: string[] = [];
    const repo = new Repository(
      "api",
      new ApiClient("http://api", "d", async (url) => {
        urls.push(String(url));
        return new Response(JSON.stringify({ data: [] }));
      }),
    );
    await repo.hospitals([129.1, 35.1, 129.2, 35.2]);
    expect(urls[0]).toContain(
      "/hospitals?bbox=129.1%2C35.1%2C129.2%2C35.2&tier=general%2Chospital%2Cclinic",
    );
  });
  it("샘플 모드는 bbox 안의 종합병원·병원·의원만 돌려준다(치과 제외)", async () => {
    const sample = new Repository("sample", new ApiClient("http://x", "d"));
    const r = await sample.hospitals([129.0, 35.0, 129.3, 35.3]);
    expect(r.data.length).toBeGreaterThanOrEqual(6);
    expect(
      r.data.every((h) => ["general", "hospital", "clinic"].includes(h.tier)),
    ).toBe(true);
    expect(r.data.some((h) => h.class_name === "치과의원")).toBe(false);
    expect(r.meta?.data_as_of).toBe("2026-11-02T19:33:03Z");
    expect(r.meta?.source_attribution).toEqual(["건강보험심사평가원"]);
    expect((await sample.hospitals([0, 0, 1, 1])).data).toEqual([]);
    // 서면 영역만 잡으면 해운대 병원은 빠진다
    const seomyeon = await sample.hospitals([129.04, 35.14, 129.08, 35.17]);
    expect(seomyeon.data.length).toBeGreaterThanOrEqual(3);
    expect(seomyeon.data.every((h) => h.lng! < 129.1)).toBe(true);
  });
});
