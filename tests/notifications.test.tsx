import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { AppState } from "react-native";
import { ApiClient } from "../src/api/client";
import { SAMPLE_REPORTS } from "../src/api/fixtures";
import { Repository } from "../src/api/repository";
import { MoreScreen } from "../src/screens/MoreScreen";
import {
  NotificationsScreen,
  ReportScreen,
} from "../src/screens/NotificationsScreen";
import { useUnreadCount } from "../src/state/notifications";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const sampleRepo = () =>
  new Repository("sample", new ApiClient("", "test-device"));
const noop = () => {};

describe("알림함 목록", () => {
  it("제목·요약을 보이고 안 읽은 것에만 점을 단다", async () => {
    render(
      <NotificationsScreen
        repo={sampleRepo()}
        loggedIn
        onBack={noop}
        onOpen={noop}
        onLogin={noop}
      />,
    );
    await screen.findByText("관심 지역 주간 리포트 · 11/16~11/22");
    expect(screen.getByText("관심 지역 주간 리포트 · 11/09~11/15")).toBeTruthy();
    expect(screen.getByText(SAMPLE_REPORTS[0].summary)).toBeTruthy();
    expect(screen.getAllByLabelText("안 읽음")).toHaveLength(1);
  });

  it("누르면 그 알림 id로 연다", async () => {
    const onOpen = vi.fn();
    render(
      <NotificationsScreen
        repo={sampleRepo()}
        loggedIn
        onBack={noop}
        onOpen={onOpen}
        onLogin={noop}
      />,
    );
    fireEvent.click(await screen.findByText("관심 지역 주간 리포트 · 11/09~11/15"));
    expect(onOpen).toHaveBeenCalledWith("sample-report-2026-11-09");
  });

  it("받은 리포트가 없으면 빈 상태를 보인다", async () => {
    const repo = sampleRepo();
    vi.spyOn(repo, "notifications").mockResolvedValue({
      data: [],
      meta: { unread_count: 0 },
    } as never);
    render(
      <NotificationsScreen
        repo={repo}
        loggedIn
        onBack={noop}
        onOpen={noop}
        onLogin={noop}
      />,
    );
    await screen.findByText("아직 받은 리포트가 없어요");
  });

  it("로그아웃이면 서버에 묻지 않고 로그인 안내를 보인다", () => {
    const repo = sampleRepo();
    const spy = vi.spyOn(repo, "notifications");
    const onLogin = vi.fn();
    render(
      <NotificationsScreen
        repo={repo}
        loggedIn={false}
        onBack={noop}
        onOpen={noop}
        onLogin={onLogin}
      />,
    );
    expect(screen.getByText("로그인하면 주간 리포트를 받아요")).toBeTruthy();
    fireEvent.click(screen.getByText("로그인"));
    expect(onLogin).toHaveBeenCalled();
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("리포트 상세", () => {
  it("열면 읽음 처리하고 동네마다 머리와 줄을 그대로 보인다", async () => {
    const repo = sampleRepo();
    const mark = vi.spyOn(repo, "markNotificationsRead");
    const onRead = vi.fn();
    render(
      <ReportScreen
        repo={repo}
        id="sample-report-2026-11-16"
        onBack={noop}
        onRegion={noop}
        onRead={onRead}
      />,
    );
    await screen.findByText(/📍 우동/);
    expect(mark).toHaveBeenCalledWith(["sample-report-2026-11-16"]);
    await waitFor(() => expect(onRead).toHaveBeenCalled());
    const r = SAMPLE_REPORTS[0].payload.regions;
    for (const b of r) {
      expect(screen.getByText(`📍 ${b.name}`)).toBeTruthy();
      for (const l of b.lines) expect(screen.getByText(l)).toBeTruthy();
    }
    // 소식 없는 동네는 한 줄만
    expect(screen.getByText("이번 주 새 소식이 없어요")).toBeTruthy();
    expect(screen.getByText(/국토교통부 실거래가 공개시스템/)).toBeTruthy();
    expect(
      screen.getByText("최근 30일 거래는 아직 신고되지 않았을 수 있어요"),
    ).toBeTruthy();
  });

  it("지도에서 동네 보기는 좌표를 넘긴다", async () => {
    const onRegion = vi.fn();
    render(
      <ReportScreen
        repo={sampleRepo()}
        id="sample-report-2026-11-16"
        onBack={noop}
        onRegion={onRegion}
        onRead={noop}
      />,
    );
    const b = SAMPLE_REPORTS[0].payload.regions[0];
    fireEvent.click(await screen.findByLabelText(`지도에서 ${b.name} 보기`));
    expect(onRegion).toHaveBeenCalledWith({ lat: b.lat, lng: b.lng });
  });

  it("알림이 없으면 오류와 다시 시도를 보인다", async () => {
    render(
      <ReportScreen
        repo={sampleRepo()}
        id="nope"
        onBack={noop}
        onRegion={noop}
        onRead={noop}
      />,
    );
    await screen.findByText("알림을 찾을 수 없어요");
  });
});

describe("안 읽은 개수", () => {
  const Probe = ({
    repo,
    account,
  }: {
    repo: Repository;
    account: string | null;
  }) => <span data-testid="n">{useUnreadCount(repo, account)}</span>;
  const repoWith = (n: number) => {
    const repo = sampleRepo();
    const spy = vi
      .spyOn(repo, "notifications")
      .mockResolvedValue({ data: [], meta: { unread_count: n } } as never);
    return { repo, spy };
  };

  it("로그아웃이면 0이고 묻지 않는다", () => {
    const { repo, spy } = repoWith(3);
    render(<Probe repo={repo} account={null} />);
    expect(screen.getByTestId("n").textContent).toBe("0");
    expect(spy).not.toHaveBeenCalled();
  });

  it("로그인하면 meta.unread_count를 받고 계정이 바뀌면 다시 받는다", async () => {
    const { repo, spy } = repoWith(3);
    const { rerender } = render(<Probe repo={repo} account="u1" />);
    await waitFor(() => expect(screen.getByTestId("n").textContent).toBe("3"));
    rerender(<Probe repo={repo} account="u2" />);
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(2));
    rerender(<Probe repo={repo} account={null} />);
    expect(screen.getByTestId("n").textContent).toBe("0");
  });

  it("앱이 다시 활성화되면 다시 받는다", async () => {
    let fire: (s: string) => void = () => {};
    vi.spyOn(AppState, "addEventListener").mockImplementation(
      (_e, listener) => {
        fire = listener as (s: string) => void;
        return { remove: () => {} } as never;
      },
    );
    const { repo, spy } = repoWith(1);
    render(<Probe repo={repo} account="u1" />);
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
    await act(async () => fire("active"));
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(2));
  });
});

describe("더보기 알림 줄", () => {
  const base = {
    mode: "sample" as const,
    onMode: noop,
    onDate: noop,
    onTerms: noop,
    notify: noop,
    todayEnabled: true,
    onTodayEnabled: noop,
  };
  it("안 읽은 개수를 배지로 보이고 누르면 연다", () => {
    const onNotifications = vi.fn();
    render(
      <MoreScreen
        {...base}
        onNotifications={onNotifications}
        unreadCount={2}
      />,
    );
    expect(screen.getByLabelText("안 읽은 알림 2개")).toBeTruthy();
    fireEvent.click(screen.getByText("알림"));
    expect(onNotifications).toHaveBeenCalled();
  });
  it("0이면 배지가 없다", () => {
    render(<MoreScreen {...base} onNotifications={noop} unreadCount={0} />);
    expect(screen.queryByLabelText(/안 읽은 알림/)).toBeNull();
  });
});
