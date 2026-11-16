import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { LoanCalculator } from "../src/components/LoanCalculator";
import { latestSale, parsePrice } from "../src/state/loan";
import type { Transaction } from "../src/api/types";

afterEach(cleanup);

const SALE = { price: 5e8, exclusive_area_m2: 84.9, sameArea: true };

describe("LoanCalculator", () => {
  it("매매가 5억 · 기본 자산 30% → 필요 대출 3.5억, 비규제 무주택 70%면 가능", () => {
    render(<LoanCalculator sale={SALE} />);
    expect(screen.getByText("1억 5,000만")).toBeTruthy();
    expect(screen.getByText("LTV 기준 대출 가능")).toBeTruthy();
    expect(screen.getByText(/70% · 한도 3억 5,000만/)).toBeTruthy();
    expect(screen.getByText(/예시 금리/)).toBeTruthy();
  });

  it("규제지역을 체크하면 LTV 40%로 내려가 한도 초과", () => {
    render(<LoanCalculator sale={SALE} />);
    fireEvent.click(screen.getByRole("checkbox", { name: /규제지역/ }));
    expect(screen.getByText(/40% · 한도 2억/)).toBeTruthy();
    expect(screen.getByText("LTV 한도 초과")).toBeTruthy();
    expect(screen.getByText("자산이 1억 5,000만 더 필요해요")).toBeTruthy();
  });

  it("생애최초는 무주택일 때만 고를 수 있다", () => {
    render(<LoanCalculator sale={SALE} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "생애최초 주택 구입" }));
    expect(screen.getByText(/80% · 한도 4억/)).toBeTruthy();
    fireEvent.click(screen.getByText("다주택"));
    expect(screen.getByText(/60% · 한도 3억/)).toBeTruthy();
  });

  it("자산 + 버튼과 기간 선택이 월납입금에 반영된다", () => {
    render(<LoanCalculator sale={SALE} />);
    fireEvent.click(screen.getByLabelText("내 자산 1천만 원 늘리기"));
    expect(screen.getByText("1억 6,000만")).toBeTruthy();
    const m30 = screen.getByText(/^월 /).textContent;
    fireEvent.click(screen.getByText("50년"));
    expect(screen.getByText(/^월 /).textContent).not.toBe(m30);
  });

  it("백엔드가 규제지역·금리를 주면 그 값을 쓴다", () => {
    render(
      <LoanCalculator
        sale={SALE}
        regulated
        rates={{ 30: 3.5, 40: 3.6, 50: 3.7 }}
      />,
    );
    expect(screen.queryByText(/규제지역 정보는 준비 중/)).toBeNull();
    expect(screen.getByText("연 3.5%")).toBeTruthy();
    expect(screen.getByText(/40% · 한도 2억/)).toBeTruthy();
  });

  it("매매가가 없으면 입력을 안내하고 결과는 숨긴다", () => {
    render(<LoanCalculator sale={null} />);
    expect(screen.getByText(/매매가를 입력해 주세요/)).toBeTruthy();
    expect(screen.queryByText(/^월 /)).toBeNull();
  });
});

describe("매매가 안내", () => {
  it("다른 평형 가격을 넣었으면 평형을 알려 준다", () => {
    render(<LoanCalculator sale={{ price: 4e8, exclusive_area_m2: 59.9, sameArea: false }} />);
    expect(screen.getByText(/이 평형은 매매 거래가 없어 전용 59.9㎡ 최근 매매가 4억/)).toBeTruthy();
  });
  it("'5억'처럼 써도 읽고, 너무 작으면 단위를 안내한다", () => {
    render(<LoanCalculator sale={SALE} />);
    const input = screen.getByLabelText("매매가 (만 원)");
    fireEvent.change(input, { target: { value: "3억 5,000" } });
    fireEvent.blur(input);
    expect((input as HTMLInputElement).value).toBe("35000");
    fireEvent.change(input, { target: { value: "500" } });
    fireEvent.blur(input);
    expect(screen.getByText(/매매가가 500만원이에요/)).toBeTruthy();
  });
  it("자산으로 다 살 수 있으면 '내 자산으로 살 수 있어요'", () => {
    render(<LoanCalculator sale={{ ...SALE, price: 1e7 }} />);
    for (let i = 0; i < 3; i++)
      fireEvent.click(screen.getByLabelText("내 자산 1천만 원 늘리기"));
    expect(screen.getByText("내 자산으로 살 수 있어요")).toBeTruthy();
  });
});

describe("parsePrice", () => {
  it("만 원 숫자, 억, 억+만, 소수 억을 읽는다", () => {
    expect(parsePrice("53000")).toBe(5.3e8);
    expect(parsePrice("53,000")).toBe(5.3e8);
    expect(parsePrice("5억")).toBe(5e8);
    expect(parsePrice("5억 3,000")).toBe(5.3e8);
    expect(parsePrice("5억3000만")).toBe(5.3e8);
    expect(parsePrice("5.3억")).toBe(5.3e8);
    expect(parsePrice("abc")).toBe(0);
  });
});

describe("latestSale", () => {
  const tx = (p: Partial<Transaction>) =>
    ({
      deal_type: "sale",
      price: 1e8,
      is_cancelled: false,
      exclusive_area_m2: 84,
      contract_date: "2026-01-01",
      ...p,
    }) as Transaction;
  it("고른 평형의 최근 매매, 해제·전세는 뺀다", () => {
    expect(
      latestSale(
        [
          tx({ price: 3e8, contract_date: "2026-03-01", is_cancelled: true }),
          tx({ price: 2e8, contract_date: "2026-02-01", exclusive_area_m2: 84.3 }),
          tx({ price: 9e8, contract_date: "2026-04-01", exclusive_area_m2: 59 }),
          tx({ price: null, deal_type: "jeonse", contract_date: "2026-05-01" }),
        ],
        84,
      ),
    ).toEqual({ price: 2e8, exclusive_area_m2: 84.3, sameArea: true });
  });
  it("그 평형 매매가 없으면 단지의 최근 매매를 쓰고 sameArea=false", () => {
    expect(latestSale([tx({ exclusive_area_m2: 59, price: 4e8 })], 84)).toEqual({
      price: 4e8,
      exclusive_area_m2: 59,
      sameArea: false,
    });
    expect(latestSale([], 84)).toBeNull();
  });
});
