import React from "react";
import { it, expect } from "vitest";
import { render, fireEvent, screen, waitFor } from "@testing-library/react";
import { GlossaryScreen } from "../src/screens/GlossaryScreen";
import { TermsScreen } from "../src/screens/MoreScreen";
const terms = [
  {
    id: "far",
    term: "용적률",
    category: "building" as const,
    is_popular: true,
    display_order: 1,
    short_definition: "땅 대비 건물 전체 넓이",
    long_definition: "층별 면적을 더한 비율",
    example: "100평 위 250평",
  },
];
it("용어 목록에서 검색 결과가 없으면 안내와 추천 용어를 제공한다", async () => {
  render(
    <GlossaryScreen
      terms={terms}
      loading={false}
      error={null}
      onRetry={() => {}}
      onTerm={() => {}}
    />,
  );
  fireEvent.change(screen.getByPlaceholderText("궁금한 용어를 검색하세요"), {
    target: { value: "없는말" },
  });
  await waitFor(() =>
    expect(screen.getByText("‘없는말’에 맞는 용어가 없어요")).toBeTruthy(),
  );
  expect(screen.getByText("이런 용어는 어떠세요")).toBeTruthy();
});
it("약관 원문이 없으면 임의 약관을 실제 약관처럼 제시하지 않는다", () => {
  render(<TermsScreen kind="서비스 이용약관" onBack={() => {}} />);
  expect(screen.getByText("약관 원문이 아직 등록되지 않았어요")).toBeTruthy();
});
