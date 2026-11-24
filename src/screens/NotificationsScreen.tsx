import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, Switch, View } from "react-native";
import { ApiError } from "../api/client";
import type { Repository } from "../api/repository";
import type {
  AppNotification,
  InterestReport,
  InterestReportComplex,
} from "../api/types";
import { Btn, Header, StateCard, T, s } from "../components/ui";
import { C } from "../theme/tokens";

// 서버에 그 경로·알림이 없다(404). 다시 시도해도 같으니 버튼을 두지 않는다
const notFound = (e: unknown) =>
  e instanceof ApiError && e.code === "RESOURCE_NOT_FOUND";

// 미리보기에서 리포트가 샘플임을 알리는 작은 표시
function SampleTag() {
  return (
    <View
      style={{
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 4,
        backgroundColor: C.rule,
        alignSelf: "flex-start",
      }}
    >
      <T size={12} bold color={C.muted}>
        샘플
      </T>
    </View>
  );
}

// 더보기 → 알림함. 주간 관심 단지 리포트를 최근 것부터 보여 준다.
// 로그인했으면 맨 위에 "주간 리포트 받기" 스위치를 둔다
export function NotificationsScreen({
  repo,
  loggedIn,
  readIds,
  onBack,
  onOpen,
  onLogin,
  notify,
}: {
  repo: Repository;
  loggedIn: boolean;
  // 이번에 열어 본 알림 id. 읽음 POST가 끝나기 전에 목록을 다시 받아도 읽은 것으로 보인다
  readIds?: ReadonlySet<string>;
  onBack: () => void;
  onOpen: (id: string) => void;
  onLogin: () => void;
  // 앱 공용 토스트
  notify: (message: string) => void;
}) {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(loggedIn);
  const [error, setError] = useState<string | null>(null);
  // 백엔드에 알림 API가 아직 없다(목록 404). 준비 중 안내만 두고 다시 시도는 두지 않는다
  const [notReady, setNotReady] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!loggedIn) return;
    const a = new AbortController();
    setLoading(true);
    setError(null);
    setNotReady(false);
    repo
      .notifications(1, a.signal)
      .then((r) => {
        if (!a.signal.aborted) setItems(r.data);
      })
      .catch((e: Error) => {
        if (a.signal.aborted) return;
        if (notFound(e)) setNotReady(true);
        else setError(e.message);
      })
      .finally(() => {
        if (!a.signal.aborted) setLoading(false);
      });
    return () => a.abort();
  }, [repo, loggedIn, retry]);
  // 주간 리포트 받기. 받아 오기 전·못 받았으면 null이라 스위치를 그리지 않는다
  const [weekly, setWeekly] = useState<boolean | null>(null);
  const [weeklyFailed, setWeeklyFailed] = useState(false);
  const [weeklyRetry, setWeeklyRetry] = useState(0);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setWeeklyFailed(false);
    if (!loggedIn) {
      setWeekly(null);
      return;
    }
    const a = new AbortController();
    repo
      .reportSetting(a.signal)
      .then((r) => {
        if (!a.signal.aborted) setWeekly(r.weekly_report);
      })
      // 설정을 못 받으면 스위치 대신 짧은 안내와 다시 시도를 두고, 목록은 그대로 보여 준다
      .catch(() => {
        if (!a.signal.aborted) setWeeklyFailed(true);
      });
    return () => a.abort();
  }, [repo, loggedIn, weeklyRetry]);
  const changeWeekly = (on: boolean) => {
    const before = weekly;
    setWeekly(on);
    setSaving(true);
    repo
      .setReportSetting(on)
      .then((r) => setWeekly(r.weekly_report))
      .catch(() => {
        setWeekly(before);
        notify("설정을 바꾸지 못했어요");
      })
      .finally(() => setSaving(false));
  };
  return (
    <View style={s.screen}>
      <Header title="알림" onBack={onBack} />
      {!loggedIn ? (
        <View style={{ padding: 24, gap: 12, alignItems: "center" }}>
          <T size={18} bold>
            로그인하면 주간 리포트를 받아요
          </T>
          <T size={14} color={C.muted} style={{ textAlign: "center" }}>
            관심 단지의 한 주 소식을 매주 월요일에 모아 드려요
          </T>
          <Btn onPress={onLogin}>로그인</Btn>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
        >
          {weekly !== null && (
            <View
              style={{
                paddingVertical: 12,
                gap: 4,
                borderBottomWidth: 1,
                borderColor: C.rule,
              }}
            >
              <View style={[s.between, { minHeight: 48 }]}>
                <T>주간 리포트 받기</T>
                <Switch
                  value={weekly}
                  disabled={saving}
                  onValueChange={changeWeekly}
                  accessibilityLabel="주간 리포트 받기"
                  trackColor={{ true: C.primary, false: C.rule }}
                  thumbColor={C.surface}
                />
              </View>
              <T size={14} color={C.muted}>
                매주 월요일에 관심 단지의 한 주 소식을 알림함으로 보내 드려요
              </T>
            </View>
          )}
          {weekly === null && weeklyFailed && !notReady && (
            <View
              style={[
                s.between,
                {
                  minHeight: 48,
                  paddingVertical: 8,
                  borderBottomWidth: 1,
                  borderColor: C.rule,
                },
              ]}
            >
              <T size={14} color={C.muted} style={{ flex: 1 }}>
                리포트 받기 설정을 불러오지 못했어요
              </T>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="리포트 받기 설정 다시 불러오기"
                onPress={() => setWeeklyRetry((x) => x + 1)}
                style={{
                  minHeight: 44,
                  justifyContent: "center",
                  paddingHorizontal: 8,
                }}
              >
                <T size={14} bold color={C.primary}>
                  다시 시도
                </T>
              </Pressable>
            </View>
          )}
          {loading || error ? (
            <StateCard
              loading={loading}
              error={error}
              onRetry={() => setRetry((x) => x + 1)}
            />
          ) : notReady ? (
            <StateCard empty="알림함을 준비 중이에요" />
          ) : items.length === 0 ? (
            <StateCard empty="아직 받은 리포트가 없어요" />
          ) : (
            items.map((n) => {
              const unread = !n.read_at && !readIds?.has(n.id);
              return (
                <Pressable
                  key={n.id}
                  accessibilityRole="button"
                  // 안 읽음 점은 그림이라 낭독기가 읽지 못한다. 행 이름에 붙인다
                  accessibilityLabel={[
                    ...(repo.reportPreview ? ["샘플"] : []),
                    n.title,
                    n.summary,
                    ...(unread ? ["안 읽음"] : []),
                  ].join(", ")}
                  onPress={() => onOpen(n.id)}
                  style={[
                    s.row,
                    {
                      gap: 10,
                      paddingVertical: 14,
                      borderBottomWidth: 1,
                      borderColor: C.rule,
                    },
                  ]}
                >
                  <View style={{ flex: 1, gap: 4 }}>
                    {repo.reportPreview && <SampleTag />}
                    <T bold={unread} size={17}>
                      {n.title}
                    </T>
                    <T size={14} color={C.muted}>
                      {n.summary}
                    </T>
                  </View>
                  {unread && (
                    <View
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 5,
                        backgroundColor: C.primary,
                      }}
                    />
                  )}
                </Pressable>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
}

// 리포트 한 건(명세 §3). 열면 읽음 처리한다. 문장은 서버가 준 lines를 그대로 보여 준다
export function ReportScreen({
  repo,
  id,
  onBack,
  onComplex,
  onCompare,
  onRead,
}: {
  repo: Repository;
  id: string;
  onBack: () => void;
  // 단지 이름을 누르면 지도에서 그 단지 시트를 연다
  onComplex: (id: string) => void;
  // 비교 화면이 생기기 전까지는 관심 목록(단지 탭)으로 간다
  onCompare: () => void;
  // 읽음 처리가 끝났을 때(배지를 다시 받는다)
  onRead: () => void;
}) {
  const [report, setReport] = useState<InterestReport>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // 없는 알림(404)이면 다시 시도해도 같다
  const [missing, setMissing] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const a = new AbortController();
    setLoading(true);
    setError(null);
    repo
      .notification(id, a.signal)
      .then((r) => {
        if (a.signal.aborted) return;
        setReport(r.data);
        if (!r.data.read_at)
          repo
            .markNotificationsRead([id])
            .then(onRead)
            // 읽음 표시를 못 해도 리포트는 그대로 보여 준다
            .catch(() => {});
      })
      .catch((e: Error) => {
        if (a.signal.aborted) return;
        setError(e.message);
        setMissing(notFound(e));
      })
      .finally(() => {
        if (!a.signal.aborted) setLoading(false);
      });
    return () => a.abort();
    // onRead는 호출 시점의 최신 값이면 충분하다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo, id, retry]);
  const p = report?.payload;
  return (
    <View style={s.screen}>
      <Header title="주간 리포트" onBack={onBack} />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
      >
        {loading || error || !report || !p ? (
          <StateCard
            loading={loading}
            error={error}
            onRetry={missing ? undefined : () => setRetry((x) => x + 1)}
          />
        ) : (
          <>
            <View style={{ paddingVertical: 16, gap: 6 }}>
              {repo.reportPreview && <SampleTag />}
              <T size={14} color={C.muted}>
                {report.title}
              </T>
              <T size={22} bold>
                {p.headline}
              </T>
            </View>
            {p.complexes.map((b) => (
              <ComplexBlock
                key={b.id}
                b={b}
                // 미리보기의 샘플 단지 id는 실제 서버에 없어 열 수 없다
                onComplex={repo.reportPreview ? undefined : onComplex}
              />
            ))}
            {p.quiet.length > 0 && (
              <T size={15} color={C.muted} style={{ paddingVertical: 14 }}>
                {`${p.quiet.map((q) => q.name).join(" · ")}: 이번 주 새 소식이 없어요`}
              </T>
            )}
            <Btn secondary onPress={onCompare} style={{ marginTop: 8 }}>
              관심 단지 비교하러 가기
            </Btn>
            <View style={{ paddingTop: 20, gap: 6 }}>
              {p.sources.length > 0 && (
                <T size={13} color={C.muted}>
                  {`출처: ${p.sources.join(" · ")}`}
                </T>
              )}
              {p.lag_notice !== "" && (
                <T size={13} color={C.light}>
                  {p.lag_notice}
                </T>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

// lines 하나하나가 머리 줄(•)인지 딸린 줄(–)인지. 문장은 고치지 않고 들여쓰기만 정한다.
// 서버 순서: 새 실거래 N건 → 평형 줄들 → 외 N개 평형 → 경매(2건 이상이면 머리 줄 + 건마다 한 줄) → 정비사업.
// 구조화 필드로 센 줄 수가 lines와 맞지 않으면(서버 문장 규칙이 바뀐 경우) 모두 머리 줄로 보인다
export function lineDepths(b: InterestReportComplex): (0 | 1)[] {
  const d: (0 | 1)[] = [];
  if (b.sales.count > 0) {
    d.push(0);
    const sub = b.sales.areas.length + (b.sales.more_areas > 0 ? 1 : 0);
    for (let i = 0; i < sub; i++) d.push(1);
  }
  if (b.auctions.length === 1) d.push(0);
  if (b.auctions.length > 1) {
    d.push(0);
    // 내용(평형·최저가·날짜)을 하나도 모르는 건은 서버가 건별 줄을 만들지 않고 머리 줄 건수로만 센다
    b.auctions
      .filter((a) => a.area_label || a.min_price != null || a.date)
      .forEach(() => d.push(1));
  }
  b.redevelopments.forEach(() => d.push(0));
  return d.length === b.lines.length ? d : b.lines.map(() => 0);
}

function ComplexBlock({
  b,
  onComplex,
}: {
  b: InterestReportComplex;
  // 없으면 단지 이름을 누를 수 없다
  onComplex?: (id: string) => void;
}) {
  // 시군구·동은 아는 것만 붙인다. 둘 다 모르면 이름만
  const where = [b.sigungu_name, b.dong_name].filter(Boolean).join(" ");
  const depths = lineDepths(b);
  const name = (
    <>
      <T bold size={18} color={onComplex ? C.primary : C.ink}>
        {b.name}
      </T>
      {where !== "" && (
        <T size={14} color={C.muted}>
          {`(${where})`}
        </T>
      )}
    </>
  );
  return (
    <View
      style={{
        paddingVertical: 14,
        gap: 6,
        borderBottomWidth: 1,
        borderColor: C.rule,
      }}
    >
      {onComplex ? (
        <Pressable
          accessibilityRole="button"
          accessibilityHint="지도에서 단지 정보를 열어요"
          onPress={() => onComplex(b.id)}
          style={[s.row, { gap: 6, flexWrap: "wrap", minHeight: 32 }]}
        >
          {name}
        </Pressable>
      ) : (
        <View style={[s.row, { gap: 6, flexWrap: "wrap", minHeight: 32 }]}>
          {name}
        </View>
      )}
      {b.lines.map((l, i) => (
        <View
          key={i}
          style={[s.row, { gap: 6, paddingLeft: depths[i] ? 18 : 2 }]}
        >
          <T size={15} color={C.muted}>
            {depths[i] ? "–" : "•"}
          </T>
          <T size={15} style={{ flex: 1 }}>
            {l}
          </T>
        </View>
      ))}
    </View>
  );
}
