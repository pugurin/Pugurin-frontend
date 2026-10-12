import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { TermPopup } from "../src/screens/GlossaryScreen";
import type { Term } from "../src/api/types";
afterEach(cleanup);
const term: Term = {
  id: "term1",
  term: "건폐율",
  category: "building",
  is_popular: true,
  display_order: 1,
  short_definition: "땅 대비 1층 넓이",
  long_definition: "건물이 차지한 넓이",
  example: "땅 100평 위 건물 60평",
};
it("웹 도움말을 클릭 위치에 맞추고 화면 오른쪽을 넘지 않게 한다", () => {
  render(
    <TermPopup
      term={term}
      onClose={() => {}}
      onDetail={() => {}}
      anchor={{ x: 1000, y: 100 }}
    />,
  );
  const popup = screen.getByLabelText("용어 도움말");
  expect(popup.style.position).toBe("absolute");
  expect(Number.parseFloat(popup.style.left)).toBeLessThanOrEqual(
    window.innerWidth - 400,
  );
  expect(popup.style.width).toBe("400px");
});
it("웹 도움말 내부를 누르면 유지하고 Escape로 닫는다", () => {
  const onClose = vi.fn();
  render(
    <TermPopup
      term={term}
      onClose={onClose}
      onDetail={() => {}}
      anchor={{ x: 100, y: 100 }}
    />,
  );
  fireEvent.click(screen.getByText("땅 대비 1층 넓이"));
  expect(onClose).not.toHaveBeenCalled();
  fireEvent.keyDown(document, { key: "Escape" });
  expect(onClose).toHaveBeenCalled();
});
