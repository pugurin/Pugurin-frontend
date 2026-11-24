import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Linking } from "react-native";
import { TermsScreen, privacyUrl } from "../src/screens/MoreScreen";

afterEach(() => vi.restoreAllMocks());

it("개인정보 처리방침 주소를 따로 넣지 않으면 배포한 공개 페이지(/privacy.html)를 연다", () => {
  // 웹은 같은 주소의 정적 페이지, 앱은 운영 웹 주소
  expect(privacyUrl(undefined, "web")).toBe("/privacy.html");
  expect(privacyUrl("", "ios")).toBe("https://pugurin.vercel.app/privacy.html");
  expect(privacyUrl("", "android")).toBe(
    "https://pugurin.vercel.app/privacy.html",
  );
  // 환경 변수로 넣은 주소가 있으면 그 주소가 먼저다
  expect(privacyUrl("https://example.com/p", "web")).toBe(
    "https://example.com/p",
  );
});

it("더보기의 개인정보 처리방침은 원문 보기 버튼으로 공개 페이지를 연다", () => {
  const open = vi.spyOn(Linking, "openURL").mockResolvedValue(true);
  render(<TermsScreen kind="개인정보 처리방침" onBack={() => {}} />);
  expect(screen.queryByText("약관 원문이 아직 등록되지 않았어요")).toBeNull();
  fireEvent.click(screen.getByText("약관 원문 보기"));
  expect(open).toHaveBeenCalledWith("/privacy.html");
});
