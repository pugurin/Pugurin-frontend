import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// 구글 OAuth 동의 화면에 넣을 공개 개인정보처리방침(https://pugurin.vercel.app/privacy.html).
// 앱 번들과 상관없는 정적 파일이라 public/에 둔다
// 줄바꿈(포매터가 문장 중간에서 줄을 바꾼다)은 띄어쓰기 하나로 본다
const html = readFileSync("public/privacy.html", "utf8").replace(/\s+/g, " ");

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

  it("소셜 로그인으로 받는 정보를 2절과 5절에서 똑같이 적는다", () => {
    // 가입 토큰에 제공자 프로필 이름(별명)을 10분 둔다(백엔드 docs/AUTH.md). "식별번호만"이라고 쓰면 앞뒤가 다르다
    expect(html).not.toContain("회원 식별번호만");
    expect(html).toMatch(/회원 식별번호와 프로필 이름/);
  });

  it("관심 목록은 로그인한 회원 계정에만 저장한다고 적는다(백엔드 #67 이후)", () => {
    expect(html).toMatch(/로그인하지 않으면[^<]*관심[^<]*서버에 저장하지 않/);
    // 앱 설정(용어 팁 등)은 서버에 올리지 않고 기기에만 둔다
    expect(html).toMatch(/앱 설정[^<]*기기에만 저장/);
  });

  it("서비스 서버가 아닌 곳으로 가는 요청도 알린다", () => {
    // 길찾기 경로 계산
    expect(html).toContain("ODsay");
    // 웹 길찾기 좌표는 Vercel 프록시의 요청 주소에 들어간다
    expect(html).toMatch(/좌표[^<]*Vercel/);
    // 지도·로드뷰는 브라우저(앱은 WebView)가 카카오에 직접 요청한다
    expect(html).toMatch(/카카오맵[^<]*직접/);
    expect(html).toContain("로드뷰");
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

  it("확장자 없는 /privacy 주소도 앱(SPA)이 아니라 이 페이지로 연다", () => {
    const vercel = JSON.parse(readFileSync("vercel.json", "utf8")) as {
      rewrites: { source: string; destination: string }[];
    };
    const sources = vercel.rewrites.map((r) => r.source);
    const privacy = sources.indexOf("/privacy");
    expect(vercel.rewrites[privacy]?.destination).toBe("/privacy.html");
    // 모든 주소를 index.html로 보내는 규칙보다 앞에 있어야 한다
    expect(privacy).toBeLessThan(sources.indexOf("/(.*)"));
  });
});
