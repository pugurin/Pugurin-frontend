import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import type { Repository } from "../api/repository";
import type {
  AppNotification,
  RegionReport,
  RegionReportBlock,
} from "../api/types";
import { Btn, Header, StateCard, T, s } from "../components/ui";
import { C } from "../theme/tokens";

// 더보기 → 알림함. 주간 관심 지역 리포트를 최근 것부터 보여 준다
export function NotificationsScreen({
  repo,
  loggedIn,
  onBack,
  onOpen,
  onLogin,
}: {
  repo: Repository;
  loggedIn: boolean;
  onBack: () => void;
  onOpen: (id: string) => void;
  onLogin: () => void;
}) {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(loggedIn);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!loggedIn) return;
    const a = new AbortController();
    setLoading(true);
    setError(null);
    repo
      .notifications(1, a.signal)
      .then((r) => {
        if (!a.signal.aborted) setItems(r.data);
      })
      .catch((e: Error) => {
        if (!a.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!a.signal.aborted) setLoading(false);
      });
    return () => a.abort();
  }, [repo, loggedIn, retry]);
  return (
    <View style={s.screen}>
      <Header title="알림" onBack={onBack} />
      {!loggedIn ? (
        <View style={{ padding: 24, gap: 12, alignItems: "center" }}>
          <T size={18} bold>
            로그인하면 주간 리포트를 받아요
          </T>
          <T size={14} color={C.muted} style={{ textAlign: "center" }}>
            관심 지역의 한 주 소식을 매주 월요일에 모아 드려요
          </T>
          <Btn onPress={onLogin}>로그인</Btn>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
        >
          {loading || error ? (
            <StateCard
              loading={loading}
              error={error}
              onRetry={() => setRetry((x) => x + 1)}
            />
          ) : items.length === 0 ? (
            <StateCard empty="아직 받은 리포트가 없어요" />
          ) : (
            items.map((n) => (
              <Pressable
                key={n.id}
                accessibilityRole="button"
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
                  <T bold={!n.read_at} size={17}>
                    {n.title}
                  </T>
                  <T size={14} color={C.muted}>
                    {n.summary}
                  </T>
                </View>
                {!n.read_at && (
                  <View
                    accessibilityLabel="안 읽음"
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 5,
                      backgroundColor: C.primary,
                    }}
                  />
                )}
              </Pressable>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

// 리포트 한 건. 열면 읽음 처리한다. 숫자는 서버가 준 lines를 그대로 보여 준다
export function ReportScreen({
  repo,
  id,
  onBack,
  onRegion,
  onRead,
}: {
  repo: Repository;
  id: string;
  onBack: () => void;
  onRegion: (p: { lat: number; lng: number }) => void;
  // 읽음 처리가 끝났을 때(배지를 다시 받는다)
  onRead: () => void;
}) {
  const [report, setReport] = useState<RegionReport>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
        if (!a.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!a.signal.aborted) setLoading(false);
      });
    return () => a.abort();
    // onRead는 호출 시점의 최신 값이면 충분하다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo, id, retry]);
  return (
    <View style={s.screen}>
      <Header title="주간 리포트" onBack={onBack} />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
      >
        {loading || error || !report ? (
          <StateCard
            loading={loading}
            error={error}
            onRetry={() => setRetry((x) => x + 1)}
          />
        ) : (
          <>
            <View style={{ paddingVertical: 16, gap: 4 }}>
              <T size={22} bold>
                {report.title}
              </T>
              <T size={14} color={C.muted}>
                {`${report.payload.period.start.replaceAll("-", ".")} ~ ${report.payload.period.end.replaceAll("-", ".")}`}
              </T>
            </View>
            {report.payload.regions.map((b) => (
              <RegionBlock key={b.code} b={b} onRegion={onRegion} />
            ))}
            <View style={{ paddingTop: 16, gap: 6 }}>
              {report.payload.sources.length > 0 && (
                <T size={13} color={C.muted}>
                  {`출처: ${report.payload.sources.join(" · ")}`}
                </T>
              )}
              {report.payload.lag_notice !== "" && (
                <T size={13} color={C.light}>
                  {report.payload.lag_notice}
                </T>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function RegionBlock({
  b,
  onRegion,
}: {
  b: RegionReportBlock;
  onRegion: (p: { lat: number; lng: number }) => void;
}) {
  return (
    <View
      style={{
        paddingVertical: 14,
        gap: 6,
        borderBottomWidth: 1,
        borderColor: C.rule,
      }}
    >
      <T bold size={18}>{`📍 ${b.name}`}</T>
      {b.lines.map((l, i) => (
        <T key={i} size={15} color={b.empty ? C.muted : undefined}>
          {l}
        </T>
      ))}
      {b.lat != null && b.lng != null && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`지도에서 ${b.name} 보기`}
          onPress={() => onRegion({ lat: b.lat!, lng: b.lng! })}
          style={{ paddingVertical: 6 }}
        >
          <T size={14} bold color={C.primary}>
            {`지도에서 ${b.name} 보기`}
          </T>
        </Pressable>
      )}
    </View>
  );
}
