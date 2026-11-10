import { describe, expect, it } from "vitest";
import { Repository } from "../src/api/repository";
import { REDEVELOPMENTS } from "../src/api/fixtures";
import type { Redevelopment } from "../src/api/types";
import { redevelopmentItems } from "../src/map/markers";
import {
  REDEVELOPMENT_COLOR,
  REDEVELOPMENT_DONE_COLOR,
  REDEVELOPMENT_MAP_STAGES,
  REDEVELOPMENT_STEPS,
  isDone,
  shortAreaName,
  stageShort,
  stepIndex,
} from "../src/state/redevelopment";

const make = (over: Partial<Redevelopment>): Redevelopment => ({
  ...REDEVELOPMENTS[0],
  ...over,
});

describe("재개발 단계", () => {
  it("단계 이름은 짧은 이름, 표 밖 단계는 원문을 쓴다", () => {
    expect(stageShort(make({ stage: "disposal_approved" }))).toBe("관리처분");
    expect(stageShort(make({ stage: "cancelled" }))).toBe("해제");
    expect(stageShort(make({ stage: "unknown", step_raw: "시공자 선정" }))).toBe(
      "시공자 선정",
    );
    expect(stageShort(make({ stage: "unknown", step_raw: null }))).toBe(
      "단계 미상",
    );
  });

  it("진행 위치: 조합설립은 4번째, 이전고시·해산은 마지막, 해제는 -1", () => {
    expect(stepIndex(make({ stage: "association" }))).toBe(3);
    expect(stepIndex(make({ stage: "transferred" }))).toBe(
      REDEVELOPMENT_STEPS.length - 1,
    );
    expect(stepIndex(make({ stage: "cancelled" }))).toBe(-1);
  });

  it("끝난 구역은 해제·준공·이전고시·해산이다", () => {
    expect(isDone(make({ stage: "cancelled" }))).toBe(true);
    expect(isDone(make({ stage: "completed" }))).toBe(true);
    expect(isDone(make({ stage: "construction" }))).toBe(false);
  });

  it("지도에는 해제·준공을 빼고 진행 중인 단계와 미상만 띄운다", () => {
    expect(REDEVELOPMENT_MAP_STAGES).not.toContain("cancelled");
    expect(REDEVELOPMENT_MAP_STAGES).not.toContain("completed");
    expect(REDEVELOPMENT_MAP_STAGES).toContain("planned");
    expect(REDEVELOPMENT_MAP_STAGES).toContain("unknown");
  });

  it("짧은 구역명은 사업 이름 꼬리를 떼고 12자까지", () => {
    expect(shortAreaName("우동1구역 재개발")).toBe("우동1구역");
    expect(shortAreaName("중동2구역 주택재건축정비사업조합")).toBe("중동2구역");
    expect(shortAreaName("아주아주긴이름의정비예정구역입니다")).toBe(
      "아주아주긴이름의정비예…",
    );
  });
});

describe("redevelopmentItems", () => {
  it("좌표 없는 구역은 빼고, 유형·단계·구역명을 마커에 싣는다", () => {
    const items = redevelopmentItems(REDEVELOPMENTS, null);
    expect(items.map((x) => x.id)).not.toContain("redev:BARA_SAMPLE_004");
    const first = items.find((x) => x.id === "redev:BARA_SAMPLE_001")!;
    expect(first).toMatchObject({
      title: "재개발",
      amount: "관리처분",
      sub: "우동1구역",
      color: REDEVELOPMENT_COLOR,
      redev: true,
    });
  });

  it("끝난 구역은 회색, 고른 구역은 rank 0, 많이 진행된 구역이 먼저 자리를 잡는다", () => {
    const items = redevelopmentItems(REDEVELOPMENTS, "redev:BARA_SAMPLE_002");
    const by = (id: string) => items.find((x) => x.id === `redev:${id}`)!;
    expect(by("BARA_SAMPLE_005").color).toBe(REDEVELOPMENT_DONE_COLOR);
    expect(by("BARA_SAMPLE_002").rank).toBe(0);
    expect(by("BARA_SAMPLE_001").rank).toBeLessThan(by("BARA_SAMPLE_003").rank);
  });
});

describe("Repository.redevelopments 샘플", () => {
  it("화면 안·고른 단계만 돌려준다", async () => {
    const repo = new Repository("sample", {} as never);
    const r = await repo.redevelopments(
      [129.13, 35.15, 129.17, 35.18],
      REDEVELOPMENT_MAP_STAGES,
    );
    const ids = r.data.map((x) => x.id);
    expect(ids).toContain("BARA_SAMPLE_001");
    expect(ids).not.toContain("BARA_SAMPLE_005"); // 해제
    expect(ids).not.toContain("BARA_SAMPLE_004"); // 좌표 없음
    expect(r.meta?.source_attribution).toContain("정비사업");
  });
});
