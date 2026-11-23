import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// 구글 OAuth 동의 화면에 넣을 공개 개인정보처리방침(https://pugurin.vercel.app/privacy.html).
// 앱 번들과 상관없는 정적 파일이라 public/에 둔다
const html = readFileSync("public/privacy.html", "utf8");

describe("개인정보처리방침 페이지", () => {
  it("개인정보보호법이 정한 항목을 모두 담는다", () => {
    for (const heading of [
      "처리 목적",
      "처리하는 개인정보 항목",
      "보유 기간",
      "제3자 제공",
      "처리 위탁",
      "파기",
      "정보주체의 권리",
      "만 14세 미만",
      "안전성 확보",
      "쿠키",
      "개인정보 보호책임자",
      "시행일",
    ])
      expect(html).toContain(heading);
  });

  it("실제로 모으지 않는 정보는 모은다고 적지 않는다", () => {
    expect(html).toContain("이메일");
    expect(html).toMatch(/이메일[^<]*수집하지 않/);
    expect(html).toMatch(/위치[^<]*서버에 (보내지|저장하지) 않/);
  });

  it("알림(주간 관심 단지 리포트)·받기 설정과 보유 기간 90일을 명시하고, 관심 지역은 없다", () => {
    expect(html).toContain("주간 관심 단지 리포트");
    expect(html).toContain("주간 리포트 받기 설정");
    expect(html).toContain("90일");
    expect(html).not.toContain("관심 지역");
  });

  it("2절의 프로필 이름과 5절의 소셜 로그인 설명이 서로 맞는다", () => {
    expect(html).not.toContain("회원 식별번호만 받습니다");
    expect(html).toMatch(/회원 식별번호와[^<]*프로필 이름/);
  });

  it("Vercel 요청 로그에 남을 수 있는 길찾기 좌표와 카카오 지도 직접 요청을 적는다", () => {
    expect(html).toMatch(/이전 항목<\/th>\s*<td>[^<]*대중교통 길찾기/);
    expect(html).toMatch(/카카오[^<]*지도[^<]*직접/);
  });

  it("앱과 같은 출처에서 열리는 독립 페이지다(스크립트 없음)", () => {
    expect(html).toMatch(/^<!doctype html>/i);
    expect(html).toContain('<meta charset="utf-8"');
    expect(html).not.toContain("<script");
  });
});
