import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { LoginAsk } from "../src/components/LoginAsk";

afterEach(cleanup);

describe("로그인 안내 창", () => {
  it("로그인해야 관심 등록을 할 수 있다고 알리고, 아래에 취소·로그인 버튼을 둔다", () => {
    const onCancel = vi.fn();
    const onLogin = vi.fn();
    render(<LoginAsk visible onCancel={onCancel} onLogin={onLogin} />);
    expect(screen.getByText("로그인이 필요해요")).toBeTruthy();
    expect(screen.getByText(/로그인하면 관심 단지·경매를/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "로그인" }));
    expect(onLogin).toHaveBeenCalledTimes(1);
  });

  it("닫혀 있으면 아무것도 보이지 않는다", () => {
    render(<LoginAsk visible={false} onCancel={() => {}} onLogin={() => {}} />);
    expect(screen.queryByText("로그인이 필요해요")).toBeNull();
  });
});
