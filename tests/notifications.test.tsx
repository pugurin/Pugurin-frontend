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
import { ApiClient, ApiError } from "../src/api/client";
import { SAMPLE_REPORTS } from "../src/api/fixtures";
import { Repository } from "../src/api/repository";
import { MoreScreen } from "../src/screens/MoreScreen";
import {
  NotificationsScreen,
  ReportScreen,
} from "../src/screens/NotificationsScreen";
import { useUnreadCountState } from "../src/state/notifications";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const sampleRepo = () =>
  new Repository("sample", new ApiClient("", "test-device"));
// 미리보기: 데이터는 실제 서버, 로그인·알림은 앱 안 샘플
const previewRepo = () =>
  new Repository("api", new ApiClient("", "test-device"), "sample");
// 백엔드에 알림 API가 아직 없을 때 서버가 주는 404
const notFound = () =>
  new ApiError("요청한 경로를 찾을 수 없습니다", "RESOURCE_NOT_FOUND");
const noop = () => {};

describe("알림함 목록", () => {
  it("제목·요약을 보이고 안 읽은 것에만 점을 단다(화면 낭독기는 행 이름으로 읽는다)", async () => {
    render(
      <NotificationsScreen
        repo={sampleRepo()}
        loggedIn
        onBack={noop}
        onOpen={noop}
        onLogin={noop}
        notify={noop}
      />,
    );
    await screen.findByText("관심 단지 주간 리포트 · 11/16~11/22");
    expect(screen.getByText("관심 단지 주간 리포트 · 11/9~11/15")).toBeTruthy();
    expect(screen.getByText(SAMPLE_REPORTS[0].summary)).toBeTruthy();
    expect(
      screen.getByRole("button", {
        name: `관심 단지 주간 리포트 · 11/16~11/22, ${SAMPLE_REPORTS[0].summary}, 안 읽음`,
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", {
        name: `관심 단지 주간 리포트 · 11/9~11/15, ${SAMPLE_REPORTS[1].summary}`,
      }),
    ).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /, 안 읽음$/ })).toHaveLength(
      1,
    );
    // 전체 샘플 모드에는 샘플 표시를 따로 달지 않는다
    expect(screen.queryByText("샘플")).toBeNull();
  });

  it("미리보기면 행마다 샘플 표시를 단다", async () => {
    render(
      <NotificationsScreen
        repo={previewRepo()}
        loggedIn
        onBack={noop}
        onOpen={noop}
        onLogin={noop}
        notify={noop}
      />,
    );
    await screen.findByText("관심 단지 주간 리포트 · 11/16~11/22");
    expect(screen.getAllByText("샘플")).toHaveLength(2);
    expect(
      screen.getAllByRole("button", { name: /^샘플, 관심 단지 주간 리포트/ }),
    ).toHaveLength(2);
  });

  it("방금 연 리포트는 목록을 다시 받아도 읽은 것으로 보인다", async () => {
    const repo = sampleRepo();
    vi.spyOn(repo, "notifications").mockResolvedValue({
      data: [{ ...SAMPLE_REPORTS[0], read_at: null }],
      meta: { unread_count: 1 },
    } as never);
    render(
      <NotificationsScreen
        repo={repo}
        loggedIn
        readIds={new Set([SAMPLE_REPORTS[0].id])}
        onBack={noop}
        onOpen={noop}
        onLogin={noop}
        notify={noop}
      />,
    );
    await screen.findByText(SAMPLE_REPORTS[0].title);
    expect(screen.queryAllByRole("button", { name: /안 읽음/ })).toHaveLength(
      0,
    );
  });

  it("백엔드에 알림이 아직 없으면(404) 준비 중이라고만 하고 다시 시도를 두지 않는다", async () => {
    const repo = sampleRepo();
    vi.spyOn(repo, "notifications").mockRejectedValue(notFound());
    vi.spyOn(repo, "reportSetting").mockRejectedValue(notFound());
    render(
      <NotificationsScreen
        repo={repo}
        loggedIn
        onBack={noop}
        onOpen={noop}
        onLogin={noop}
        notify={noop}
      />,
    );
    await screen.findByText("알림함을 준비 중이에요");
    expect(screen.queryByText("요청한 경로를 찾을 수 없습니다")).toBeNull();
    expect(screen.queryByText("다시 시도")).toBeNull();
    expect(
      screen.queryByText("리포트 받기 설정을 불러오지 못했어요"),
    ).toBeNull();
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
        notify={noop}
      />,
    );
    fireEvent.click(
      await screen.findByText("관심 단지 주간 리포트 · 11/9~11/15"),
    );
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
        notify={noop}
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
        notify={noop}
      />,
    );
    expect(screen.getByText("로그인하면 주간 리포트를 받아요")).toBeTruthy();
    fireEvent.click(screen.getByText("로그인"));
    expect(onLogin).toHaveBeenCalled();
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("리포트 상세", () => {
  const renderReport = (
    over: Partial<React.ComponentProps<typeof ReportScreen>> = {},
  ) =>
    render(
      <ReportScreen
        repo={sampleRepo()}
        id="sample-report-2026-11-16"
        onBack={noop}
        onComplex={noop}
        onCompare={noop}
        onRead={noop}
        {...over}
      />,
    );

  it("열면 읽음 처리하고 headline·단지(시군구 동)·lines·조용한 단지·출처를 보인다", async () => {
    const repo = sampleRepo();
    const mark = vi.spyOn(repo, "markNotificationsRead");
    const onRead = vi.fn();
    renderReport({ repo, onRead });
    const p = SAMPLE_REPORTS[0].payload;
    await screen.findByText(p.headline);
    expect(mark).toHaveBeenCalledWith(["sample-report-2026-11-16"]);
    await waitFor(() => expect(onRead).toHaveBeenCalled());
    for (const b of p.complexes) {
      expect(screen.getByText(b.name)).toBeTruthy();
      expect(
        screen.getAllByText(`(${b.sigungu_name} ${b.dong_name})`).length,
      ).toBeGreaterThan(0);
      for (const l of b.lines) expect(screen.getByText(l)).toBeTruthy();
    }
    // 단지는 payload 순서, 한 단지의 lines도 payload 순서 그대로
    const order = [
      p.headline,
      ...p.complexes.flatMap((b) => [b.name, ...b.lines]),
      `${p.quiet.map((q) => q.name).join(" · ")}: 이번 주 새 소식이 없어요`,
      "관심 단지 비교하러 가기",
      "최근 30일 거래는 아직 신고되지 않았을 수 있어요",
    ];
    const text = document.body.textContent ?? "";
    const at = order.map((t) => text.indexOf(t));
    expect(at.every((i) => i >= 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(
      screen.getByText("경동제이드 · 마린시티자이: 이번 주 새 소식이 없어요"),
    ).toBeTruthy();
    // 샘플의 두 단지가 모두 해운대구 우동이다
    expect(screen.getAllByText("(해운대구 우동)")).toHaveLength(2);
    expect(screen.getByText(/국토교통부 실거래가 공개시스템/)).toBeTruthy();
    expect(screen.getByText(/대법원 법원경매정보·온비드/)).toBeTruthy();
    expect(screen.getByText(/부산광역시 정비사업 정보/)).toBeTruthy();
  });

  it("경매가 여럿이면 머리 줄 뒤에 건마다 한 줄, 외 N개 평형도 그대로 보인다", async () => {
    renderReport({ id: "sample-report-2026-11-09" });
    const b = SAMPLE_REPORTS[1].payload.complexes.find(
      (c) => c.name === "엘시티더샵",
    )!;
    await screen.findByText(b.name);
    for (const l of b.lines) expect(screen.getByText(l)).toBeTruthy();
    expect(screen.getByText("새 경매 2건")).toBeTruthy();
    expect(screen.getByText("외 1개 평형")).toBeTruthy();
  });

  it("시군구·동을 모르면 이름만 보인다", async () => {
    const repo = sampleRepo();
    const r = structuredClone(SAMPLE_REPORTS[0]);
    r.payload.complexes[0].sigungu_name = null;
    r.payload.complexes[0].dong_name = null;
    r.payload.complexes[1].sigungu_name = null;
    vi.spyOn(repo, "notification").mockResolvedValue({ data: r } as never);
    renderReport({ repo });
    await screen.findByText(r.payload.complexes[0].name);
    expect(screen.queryByText(/\(해운대구/)).toBeNull();
    expect(screen.queryByText("()")).toBeNull();
    expect(screen.getByText("(우동)")).toBeTruthy();
  });

  it("단지 이름을 누르면 그 단지 id로 onComplex", async () => {
    const onComplex = vi.fn();
    renderReport({ onComplex });
    const b = SAMPLE_REPORTS[0].payload.complexes[1];
    fireEvent.click(await screen.findByText(b.name));
    expect(onComplex).toHaveBeenCalledWith(b.id);
  });

  it("관심 단지 비교하러 가기를 누르면 onCompare", async () => {
    const onCompare = vi.fn();
    renderReport({ onCompare });
    fireEvent.click(await screen.findByText("관심 단지 비교하러 가기"));
    expect(onCompare).toHaveBeenCalled();
  });

  it("알림이 없으면(404) 오류만 보이고 다시 시도를 두지 않는다", async () => {
    renderReport({ id: "nope" });
    await screen.findByText("알림을 찾을 수 없어요");
    expect(screen.queryByText("다시 시도")).toBeNull();
  });

  it("다른 오류면 다시 시도를 둔다", async () => {
    const repo = sampleRepo();
    vi.spyOn(repo, "notification").mockRejectedValue(
      new ApiError("네트워크 오류", "NETWORK_ERROR"),
    );
    renderReport({ repo });
    await screen.findByText("네트워크 오류");
    expect(screen.getByText("다시 시도")).toBeTruthy();
  });

  it("미리보기면 샘플 표시를 달고 단지 이름은 누를 수 없다", async () => {
    const onComplex = vi.fn();
    renderReport({ repo: previewRepo(), onComplex });
    const b = SAMPLE_REPORTS[0].payload.complexes[1];
    fireEvent.click(await screen.findByText(b.name));
    expect(onComplex).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("button", { name: new RegExp(b.name) }),
    ).toBeNull();
    expect(screen.getByText("샘플")).toBeTruthy();
  });
});

describe("주간 리포트 받기 스위치", () => {
  const renderList = (repo: Repository, loggedIn = true, notify = noop) =>
    render(
      <NotificationsScreen
        repo={repo}
        loggedIn={loggedIn}
        onBack={noop}
        onOpen={noop}
        onLogin={noop}
        notify={notify}
      />,
    );
  const sw = () => screen.findByRole("switch", { name: "주간 리포트 받기" });

  it("서버 값을 보이고 끄면 setReportSetting(false)", async () => {
    const repo = sampleRepo();
    vi.spyOn(repo, "reportSetting").mockResolvedValue({ weekly_report: true });
    const set = vi
      .spyOn(repo, "setReportSetting")
      .mockResolvedValue({ weekly_report: false });
    renderList(repo);
    await waitFor(async () =>
      expect((await sw()) as HTMLInputElement).toHaveProperty("checked", true),
    );
    fireEvent.click(await sw());
    expect(set).toHaveBeenCalledWith(false);
    await waitFor(async () =>
      expect((await sw()) as HTMLInputElement).toHaveProperty("checked", false),
    );
  });

  it("바꾸지 못하면 되돌리고 토스트를 띄운다", async () => {
    const repo = sampleRepo();
    vi.spyOn(repo, "reportSetting").mockResolvedValue({ weekly_report: true });
    vi.spyOn(repo, "setReportSetting").mockRejectedValue(new Error("x"));
    const notify = vi.fn();
    renderList(repo, true, notify);
    await waitFor(async () =>
      expect((await sw()) as HTMLInputElement).toHaveProperty("checked", true),
    );
    fireEvent.click(await sw());
    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith("설정을 바꾸지 못했어요"),
    );
    expect((await sw()) as HTMLInputElement).toHaveProperty("checked", true);
  });

  it("설정을 못 받으면 스위치 대신 안내를 보이고, 다시 시도하면 스위치가 나온다", async () => {
    const repo = sampleRepo();
    const get = vi
      .spyOn(repo, "reportSetting")
      .mockRejectedValueOnce(new Error("x"))
      .mockResolvedValue({ weekly_report: true });
    renderList(repo);
    await screen.findByText("리포트 받기 설정을 불러오지 못했어요");
    expect(
      screen.queryByRole("switch", { name: "주간 리포트 받기" }),
    ).toBeNull();
    // 목록은 그대로 보인다
    await screen.findByText("관심 단지 주간 리포트 · 11/16~11/22");
    fireEvent.click(screen.getByLabelText("리포트 받기 설정 다시 불러오기"));
    expect((await sw()) as HTMLInputElement).toHaveProperty("checked", true);
    expect(get).toHaveBeenCalledTimes(2);
    expect(
      screen.queryByText("리포트 받기 설정을 불러오지 못했어요"),
    ).toBeNull();
  });

  it("로그인 안 했으면 스위치가 없고 설정을 묻지 않는다", () => {
    const repo = sampleRepo();
    const get = vi.spyOn(repo, "reportSetting");
    renderList(repo, false);
    expect(
      screen.queryByRole("switch", { name: "주간 리포트 받기" }),
    ).toBeNull();
    expect(get).not.toHaveBeenCalled();
  });
});

describe("안 읽은 개수", () => {
  const Probe = ({
    repo,
    account,
  }: {
    repo: Repository;
    account: string | null;
  }) => <span data-testid="n">{useUnreadCountState(repo, account).count}</span>;
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

  it("배지는 1개짜리 페이지로 개수만 받는다", async () => {
    const { repo, spy } = repoWith(2);
    render(<Probe repo={repo} account="u1" />);
    await waitFor(() => expect(screen.getByTestId("n").textContent).toBe("2"));
    expect(spy).toHaveBeenCalledWith(1, expect.any(AbortSignal), 1);
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
