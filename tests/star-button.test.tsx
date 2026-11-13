import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SampleInterests, type InterestsApi } from "../src/api/interests";
import type { Session } from "../src/api/auth";
import { InterestsProvider, useInterestsState } from "../src/state/interests";
import { StarButton } from "../src/components/StarButton";

const storage = vi.hoisted(() => {
  const data = new Map<string, string>();
  return {
    data,
    getItem: vi.fn(async (k: string) => data.get(k) ?? null),
    setItem: vi.fn(async (k: string, v: string) => void data.set(k, v)),
  };
});
vi.mock("@react-native-async-storage/async-storage", () => ({ default: storage }));
vi.mock("expo-crypto", () => ({ randomUUID: () => "uuid" }));
beforeEach(() => storage.data.clear());
afterEach(cleanup);
const flush = () => act(() => new Promise((r) => setTimeout(r, 5)));

const session = (id: string): Session => ({
  user: { id, nickname: "부산사람", provider: "kakao", role: "buyer", marketing_push: false, created_at: "2026-11-13" },
  access_token: "a",
  refresh_token: "r",
});
const complex = { complex_id: "c1", name: "해운대아이파크", property_type: "apartment" as const, address: "부산광역시 해운대구 우동", lat: 35, lng: 129 };
const dong = (i: number) => ({ region_code: `26350${10000 + i}`, name: `동${i}`, lat: 35, lng: 129 });

function Harness({ api, s, notify, onLogin, children }: {
  api: InterestsApi; s: Session | null; notify: (m: string) => void; onLogin: () => void; children: React.ReactNode;
}) {
  const value = useInterestsState(api, s, notify, onLogin);
  return <InterestsProvider value={value}>{children}</InterestsProvider>;
}
function setup(s: Session | null, api: InterestsApi = new SampleInterests(0)) {
  const notify = vi.fn();
  const onLogin = vi.fn();
  const ui = (who: Session | null) => (
    <Harness api={api} s={who} notify={notify} onLogin={onLogin}>
      <StarButton kind="complex" item={complex} />
      <StarButton kind="region" item={dong(99)} />
    </Harness>
  );
  const r = render(ui(s));
  return { notify, onLogin, api, rerender: (who: Session | null) => r.rerender(ui(who)) };
}

describe("관심 ☆ 버튼", () => {
  it("로그인 안 했으면 안내하고 로그인 화면으로 보낸다", async () => {
    const { notify, onLogin } = setup(null);
    fireEvent.click(screen.getByLabelText("관심 단지 등록"));
    await flush();
    expect(notify).toHaveBeenCalledWith("로그인하면 관심 등록할 수 있어요");
    expect(onLogin).toHaveBeenCalled();
  });

  it("누르면 담고 다시 누르면 뺀다", async () => {
    const { notify } = setup(session("u1"));
    await flush();
    // 저장은 비동기라, 전체 테스트가 몰릴 때도 버티도록 고정 대기 대신 결과가 올 때까지 기다린다
    fireEvent.click(await screen.findByLabelText("관심 단지 등록"));
    const remove = await screen.findByLabelText("관심 단지 해제");
    await waitFor(() => expect(notify).toHaveBeenLastCalledWith("관심 단지에 담았어요"));
    fireEvent.click(remove);
    await screen.findByLabelText("관심 단지 등록");
    await waitFor(() => expect(notify).toHaveBeenLastCalledWith("관심 단지에서 뺐어요"));
    fireEvent.click(screen.getByLabelText("관심 지역 등록"));
    await waitFor(() => expect(notify).toHaveBeenLastCalledWith("관심 지역에 담았어요"));
  });

  it("지역이 10개 차 있으면 안내만 하고 담지 않는다", async () => {
    const api = new SampleInterests(0);
    const me = session("u1");
    for (let i = 0; i < 10; i++) await api.addRegion(me, dong(i));
    const { notify } = setup(me, api);
    await flush();
    fireEvent.click(screen.getByLabelText("관심 지역 등록"));
    await waitFor(() => expect(notify).toHaveBeenLastCalledWith("관심 지역은 10개까지예요"));
    expect(screen.getByLabelText("관심 지역 등록")).toBeTruthy();
  });

  it("다른 계정으로 바뀌면 이전 계정의 ☆는 꺼진다", async () => {
    const { rerender } = setup(session("u1"));
    await flush();
    fireEvent.click(screen.getByLabelText("관심 단지 등록"));
    await screen.findByLabelText("관심 단지 해제");
    rerender(session("u2"));
    await flush();
    await screen.findByLabelText("관심 단지 등록");
    rerender(null);
    await flush();
    await screen.findByLabelText("관심 단지 등록");
  });
});
