import { describe, expect, it } from "vitest";
import { Repository } from "../src/api/repository";
import { ApiClient } from "../src/api/client";
import {
  sampleTransit,
  transitQuery,
  type TransitResult,
} from "../src/api/transit";

const HOME = { lat: 35.163102, lng: 129.163598 }; // 해운대
const WORK = { lat: 35.154612, lng: 129.059887 }; // 서면

describe("대중교통 길찾기", () => {
  it("백엔드 /transit/routes로 소수 3자리(약 100m) 좌표를 보낸다", async () => {
    let url = "";
    const data: TransitResult = { routes: [], unavailable_reason: "no_route" };
    const repo = new Repository(
      "api",
      new ApiClient("http://api/api/v1", "d", async (value) => {
        url = String(value);
        return new Response(JSON.stringify({ data }));
      }),
    );
    const result = await repo.transitRoute(HOME, WORK);
    expect(url).toBe(
      "http://api/api/v1/transit/routes?from_lat=35.163&from_lng=129.164&to_lat=35.155&to_lng=129.060&limit=3",
    );
    expect(result.data).toEqual(data);
  });

  it("좌표 형식 오류는 서버가 준 오류 코드로 알린다", async () => {
    const repo = new Repository(
      "api",
      new ApiClient(
        "http://api",
        "d",
        async () =>
          new Response(
            JSON.stringify({
              error: {
                code: "VALIDATION_ERROR",
                message: "좌표가 올바르지 않아요",
              },
            }),
            { status: 400 },
          ),
      ),
    );
    await expect(repo.transitRoute(HOME, WORK)).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      message: "좌표가 올바르지 않아요",
    });
  });

  const failing = (status: number, code?: string) =>
    new Repository(
      "api",
      new ApiClient(
        "http://api",
        "d",
        async () =>
          new Response(
            JSON.stringify(code ? { error: { code, message: "x" } } : {}),
            { status },
          ),
      ),
    );
  it("백엔드에 길찾기가 아직 없으면(404) 준비 중으로 알린다", async () => {
    expect((await failing(404).transitRoute(HOME, WORK)).data).toEqual({
      routes: [],
      unavailable_reason: "not_ready",
    });
  });
  it("공급처 장애(503 SOURCE_UNAVAILABLE)는 다시 시도할 수 있는 이유로 바꾼다", async () => {
    expect(
      (await failing(503, "SOURCE_UNAVAILABLE").transitRoute(HOME, WORK)).data,
    ).toEqual({
      routes: [],
      unavailable_reason: "source_unavailable",
    });
  });

  it("샘플 모드는 빠른 순으로 경로를 주고 구간 합계가 맞는다", async () => {
    const { data } = await new Repository(
      "sample",
      new ApiClient("x", "d"),
    ).transitRoute(HOME, WORK);
    expect(data.unavailable_reason).toBeNull();
    expect(data.routes.length).toBe(2);
    expect(data.routes[0].total_minutes).toBeLessThanOrEqual(
      data.routes[1].total_minutes,
    );
    for (const r of data.routes) {
      expect(r.legs.reduce((s, l) => s + l.minutes, 0)).toBe(r.total_minutes);
      expect(r.transfer_count).toBe(0);
      expect(r.legs[0].mode).toBe("walk");
    }
  });

  it("700m 이내면 경로 대신 too_close", () => {
    const near = { lat: HOME.lat + 0.003, lng: HOME.lng };
    expect(sampleTransit(HOME, near).data).toEqual({
      routes: [],
      unavailable_reason: "too_close",
    });
  });

  it("limit을 바꿀 수 있다", () => {
    expect(new URLSearchParams(transitQuery(HOME, WORK, 5)).get("limit")).toBe(
      "5",
    );
  });
});
