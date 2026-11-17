import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import type { Repository } from "../api/repository";
import type { TransitResult, TransitRoute } from "../api/transit";
import {
  RETRYABLE,
  UNAVAILABLE_TEXT,
  legColor,
  legInk,
  legText,
  minutesLabel,
  MODE_LABEL,
  useCommute,
  type Place,
} from "../state/commute";
import { C } from "../theme/tokens";
import { Btn, Header, Icon, IconBtn, Section, StateCard, T, s } from "../components/ui";

const SOURCE = "경로 정보: ODsay · 실제 시간은 배차·교통 상황에 따라 달라요";
// 직장 위치가 기기 밖으로 나간다는 안내. 좌표는 약 100m 단위로 줄여 보낸다
const PRIVACY =
  "경로를 찾으려고 집·직장 위치(약 100m 단위)를 우리 서버를 거쳐 ODsay에 보내요. 직장은 이 기기에만 저장돼요";
const SAMPLE_NOTICE = "샘플 경로예요. 직선거리로 만든 가짜 시간이라 실제와 달라요";

// 경로 조회 공통. from·to가 바뀌면 다시 부른다
function useTransit(repo: Repository, from: Place | null, to: Place | null, retry = 0) {
  const [result, setResult] = useState<TransitResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const key = from && to ? `${from.lat},${from.lng}>${to.lat},${to.lng}` : "";
  useEffect(() => {
    if (!from || !to) return;
    const a = new AbortController();
    setLoading(true);
    setError(null);
    setResult(null);
    repo
      .transitRoute(from, to, a.signal)
      .then((r) => !a.signal.aborted && setResult(r.data))
      .catch((e) => !a.signal.aborted && setError(e.message))
      .finally(() => !a.signal.aborted && setLoading(false));
    return () => a.abort();
  }, [repo, key, retry]);
  return { result, error, loading };
}

const summary = (r: TransitRoute) =>
  [
    r.transfer_count ? `환승 ${r.transfer_count}회` : "환승 없음",
    r.fare != null && `${r.fare.toLocaleString()}원`,
    `도보 ${r.walk_minutes}분`,
  ]
    .filter(Boolean)
    .join(" · ");

// 구간을 시간 비율대로 이어 붙인 막대
function LegBar({ route }: { route: TransitRoute }) {
  return (
    <View style={{ flexDirection: "row", height: 10, borderRadius: 5, overflow: "hidden", gap: 2 }}>
      {route.legs.map((l, i) => (
        <View key={i} style={{ flex: Math.max(1, l.minutes), backgroundColor: legColor(l) }} />
      ))}
    </View>
  );
}

// 단지 시트의 출퇴근 칸. 직장이 없으면 설정 버튼, 있으면 가장 빠른 경로 요약
export function CommuteSection({ repo, home }: { repo: Repository; home: Place }) {
  const commute = useCommute();
  const workplace = commute?.workplace ?? null;
  const { result, error, loading } = useTransit(repo, workplace && home, workplace);
  if (!commute) return null;
  const best = result?.routes[0];
  const status = loading
    ? "경로를 찾는 중"
    : error
      ? error
      : best
        ? `${minutesLabel(best.total_minutes)}, ${summary(best)}`
        : UNAVAILABLE_TEXT[result?.unavailable_reason ?? "no_route"];
  return (
    <Section title="출퇴근 (대중교통)">
      {!workplace ? (
        <View style={[s.card, { gap: 10 }]}>
          <T color={C.muted}>직장을 정하면 이 단지에서 출근 시간을 보여드려요</T>
          <Btn small icon="work" onPress={() => commute.pickWorkplace(home)}>
            직장 설정하기
          </Btn>
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${workplace.name}까지 ${status}. 경로 자세히 보기`}
          onPress={() => commute.openRoute(home)}
          style={[s.card, { gap: 8 }]}
        >
          <View style={[s.row, { gap: 6 }]}>
            <Icon name="work" size={18} color={C.muted} />
            <T size={14} color={C.muted} style={{ flex: 1 }} numberOfLines={1}>
              {workplace.name}까지
            </T>
            <Icon name="right" size={18} color={C.light} />
          </View>
          {loading ? (
            <T color={C.light}>경로를 찾는 중…</T>
          ) : error ? (
            <T color={C.brownInk}>{error}</T>
          ) : best ? (
            <>
              <T size={22} bold>
                {minutesLabel(best.total_minutes)}
              </T>
              <T size={13} color={C.muted}>
                {summary(best)}
              </T>
              <LegBar route={best} />
            </>
          ) : (
            <T color={C.muted}>
              {UNAVAILABLE_TEXT[result?.unavailable_reason ?? "no_route"]}
            </T>
          )}
        </Pressable>
      )}
      {repo.mode === "sample" && workplace && (
        <T size={12} color={C.light}>
          {SAMPLE_NOTICE}
        </T>
      )}
    </Section>
  );
}

function PlaceRow({
  icon,
  label,
  place,
  onPress,
}: {
  icon: "home" | "work";
  label: string;
  place: Place;
  onPress?: () => void;
}) {
  const body = (
    <>
      <Icon name={icon} color={C.muted} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <T size={12} color={C.light}>
          {label}
        </T>
        <T bold numberOfLines={1}>
          {place.name}
        </T>
      </View>
      {onPress && (
        <T size={13} color={C.greenInk}>
          바꾸기
        </T>
      )}
    </>
  );
  const style = [s.row, { gap: 10, paddingVertical: 10 }];
  return onPress ? (
    <Pressable accessibilityRole="button" accessibilityLabel={`${label} 바꾸기`} onPress={onPress} style={style}>
      {body}
    </Pressable>
  ) : (
    <View style={style}>{body}</View>
  );
}

function RouteCard({
  route,
  rank,
  open,
  onPress,
}: {
  route: TransitRoute;
  rank: number;
  open: boolean;
  onPress: () => void;
}) {
  // 펼친 구간 목록은 버튼 밖에 두어 스크린리더가 한 줄씩 읽게 한다
  return (
    <View style={[s.card, { gap: 8 }, open && { borderColor: C.greenRule }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`경로 ${rank + 1}${rank === 0 ? ", 가장 빠름" : ""}, ${minutesLabel(route.total_minutes)}, ${summary(route)}`}
        onPress={onPress}
        style={{ gap: 8 }}
      >
        <View style={s.between}>
          <T size={22} bold>
            {minutesLabel(route.total_minutes)}
          </T>
          {rank === 0 && (
            <T size={12} color={C.greenInk}>
              가장 빠름
            </T>
          )}
        </View>
        <T size={13} color={C.muted}>
          {summary(route)}
        </T>
        <LegBar route={route} />
      </Pressable>
      {open && (
        <View style={{ marginTop: 6, gap: 2 }}>
          {route.legs.map((l, i) => (
            <View key={i} style={[s.row, { gap: 10, alignItems: "flex-start", paddingVertical: 6 }]}>
              <View
                style={{
                  width: 40,
                  paddingVertical: 2,
                  borderRadius: 6,
                  alignItems: "center",
                  backgroundColor: legColor(l),
                }}
              >
                <T size={11} bold color={legInk(l)}>
                  {MODE_LABEL[l.mode]}
                </T>
              </View>
              <T size={14} style={{ flex: 1 }}>
                {legText(l)}
              </T>
              <T size={13} color={C.muted}>
                {l.minutes}분
              </T>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// 집 ↔ 직장 대중교통 길찾기 화면. 출근(집→직장)·퇴근(직장→집)을 바꿀 수 있다
export function CommuteScreen({
  repo,
  home,
  onBack,
}: {
  repo: Repository;
  home: Place;
  onBack: () => void;
}) {
  const commute = useCommute();
  const workplace = commute?.workplace ?? null;
  const [toWork, setToWork] = useState(true);
  const [open, setOpen] = useState(0);
  const [retry, setRetry] = useState(0);
  const from = toWork ? home : workplace;
  const to = toWork ? workplace : home;
  const { result, error, loading } = useTransit(repo, from, to, retry);
  useEffect(() => setOpen(0), [result]);
  const pick = () => commute?.pickWorkplace(home);
  const homeRow = <PlaceRow icon="home" label="집" place={home} />;
  const workRow = workplace && (
    <PlaceRow icon="work" label="직장" place={workplace} onPress={pick} />
  );
  return (
    <View style={s.screen}>
      <Header title={toWork ? "출근 길찾기" : "퇴근 길찾기"} onBack={onBack} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        {!workplace ? (
          <View style={[s.card, { gap: 10 }]}>
            <T color={C.muted}>직장을 먼저 정해 주세요</T>
            <Btn small icon="work" onPress={pick}>
              직장 설정하기
            </Btn>
          </View>
        ) : (
          <>
            <View style={[s.card, s.row, { paddingVertical: 4 }]}>
              <View style={{ flex: 1 }}>
                {toWork ? homeRow : workRow}
                <View style={s.rule} />
                {toWork ? workRow : homeRow}
              </View>
              <IconBtn
                name="swap"
                label={toWork ? "퇴근 경로로 바꾸기" : "출근 경로로 바꾸기"}
                onPress={() => setToWork((x) => !x)}
              />
            </View>
            <Section title="대중교통 경로">
              {loading || error ? (
                <StateCard loading={loading} error={error} onRetry={() => setRetry((x) => x + 1)} />
              ) : result && result.routes.length === 0 ? (
                RETRYABLE.includes(result.unavailable_reason ?? "no_route") ? (
                  <StateCard
                    error={UNAVAILABLE_TEXT[result.unavailable_reason!]}
                    onRetry={() => setRetry((x) => x + 1)}
                  />
                ) : (
                  <StateCard empty={UNAVAILABLE_TEXT[result.unavailable_reason ?? "no_route"]} />
                )
              ) : (
                result?.routes.map((r, i) => (
                  <RouteCard
                    key={i}
                    route={r}
                    rank={i}
                    open={open === i}
                    onPress={() => setOpen(open === i ? -1 : i)}
                  />
                ))
              )}
              <T size={12} color={C.light}>
                {repo.mode === "sample" ? SAMPLE_NOTICE : SOURCE}
              </T>
            </Section>
            <T size={12} color={C.light}>
              {PRIVACY}
            </T>
            <Btn small secondary icon="close" onPress={() => commute?.clearWorkplace()}>
              직장 지우기
            </Btn>
          </>
        )}
      </ScrollView>
    </View>
  );
}
