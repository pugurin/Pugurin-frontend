import React, { useEffect, useState } from "react";
import { Linking, Pressable, View } from "react-native";
import type { Meta, NearbySchools, School } from "../api/types";
import type { Repository } from "../api/repository";
import { Section, T, s } from "../components/ui";
import {
  ASSIGNMENT_NOTICE,
  ASSIGNMENT_SOURCE,
  SCHOOL_LEVEL,
  SCHOOL_NOTICE,
  SCHOOL_SOURCE,
} from "../state/school";
import { C } from "../theme/tokens";
import { homepageUrl } from "./SchoolContent";
import { Badge } from "./AuctionContent";

const LEVELS = ["elementary", "middle", "high"] as const;

// 1km 미만은 m, 그 이상은 소수 한 자리 km
function distanceLabel(m: number | null): string | null {
  if (m == null) return null;
  return m < 1000 ? `${m}m` : `${(m / 1000).toFixed(1)}km`;
}

// 학교 한 줄. 홈페이지가 있으면 눌러서 열고, 없으면 누를 수 없게 표시만 한다
function SchoolRow({
  school,
  assigned = false,
}: {
  school: School;
  assigned?: boolean;
}) {
  const level = SCHOOL_LEVEL[school.level];
  const homepage = homepageUrl(school.homepage);
  const distance = distanceLabel(school.distance_m);
  const body = (
    <>
      <Badge bg={level.color} ink="#fff">
        {level.badge}
      </Badge>
      <View style={{ flex: 1, minWidth: 0 }}>
        <T bold>{school.name}</T>
        <T size={13} color={C.muted}>
          {[
            assigned && "배정",
            distance && `직선 ${distance}`,
            school.foundation,
            school.coed,
          ]
            .filter(Boolean)
            .join(" · ")}
        </T>
      </View>
      <T size={13} color={homepage ? C.brownInk : C.light}>
        {homepage ? "홈페이지 ↗" : "홈페이지 없음"}
      </T>
    </>
  );
  const style = [s.row, { gap: 10, paddingVertical: 10 }];
  return homepage ? (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${school.name} 홈페이지 열기`}
      onPress={() => void Linking.openURL(homepage).catch(() => {})}
      style={style}
    >
      {body}
    </Pressable>
  ) : (
    <View style={style}>{body}</View>
  );
}

// 단지 상세의 주변 학교. 불러오지 못하면(서버 준비 전 503 등) 칸째로 숨긴다.
// 서버가 학구도 기준 배정 초등학교를 주면 초등학교는 배정 학교로, 중·고는 가까운 학교로 보여준다.
// 학구도를 아직 싣지 않았으면(키 없음) 초등학교도 가까운 학교로 대신한다
export function NearbySchoolsSection({
  complexId,
  repo,
}: {
  complexId: string;
  repo: Repository;
}) {
  const [schools, setSchools] = useState<NearbySchools | null>(null);
  const [meta, setMeta] = useState<Meta>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    setSchools(null);
    setFailed(false);
    repo
      .nearby(complexId, abort.signal)
      .then((r) => {
        if (abort.signal.aborted) return;
        setSchools(r.data.schools);
        setMeta(r.meta);
      })
      .catch(() => {
        if (!abort.signal.aborted) setFailed(true);
      });
    return () => abort.abort();
  }, [complexId, repo]);
  if (failed) return null;
  const asOf = meta?.data_as_of?.slice(0, 10).replaceAll("-", ".");
  const radius = schools ? distanceLabel(schools.radius_m) : null;
  // 키가 있으면 학구도를 실은 것. null이면 이 단지가 어느 통학구역에도 들지 않는 경우다
  const hasZone = schools != null && schools.assigned_elementary !== undefined;
  const assigned = schools?.assigned_elementary ?? null;
  const empty = (
    <T size={14} color={C.light} style={{ paddingVertical: 8 }}>
      {radius ? `${radius} 안에 없어요` : "근처에 없어요"}
    </T>
  );
  return (
    <Section title="주변 학교">
      {!schools ? (
        <T size={14} color={C.light}>
          주변 학교를 불러오는 중…
        </T>
      ) : (
        <>
          {hasZone && (
            <View style={{ marginTop: 4 }}>
              <T size={14} bold color={C.ink2}>
                배정 초등학교
              </T>
              {assigned ? (
                <SchoolRow school={assigned} assigned />
              ) : (
                <T size={14} color={C.light} style={{ paddingVertical: 8 }}>
                  학구도에서 배정 학교를 찾지 못했어요
                </T>
              )}
              <T size={13} color={C.muted}>
                {meta?.assignment_notice || ASSIGNMENT_NOTICE}
              </T>
            </View>
          )}
          <T size={13} color={C.muted} style={{ marginTop: hasZone ? 12 : 0 }}>
            {hasZone
              ? "중·고등학교는 학군 배정이 아니라 직선거리로 가까운 학교예요"
              : meta?.school_notice || SCHOOL_NOTICE}
          </T>
          {LEVELS.filter((lv) => !(hasZone && lv === "elementary")).map(
            (lv) => (
              <View key={lv} style={{ marginTop: 8 }}>
                <T size={14} bold color={C.ink2}>
                  {hasZone
                    ? `가까운 ${SCHOOL_LEVEL[lv].name}`
                    : SCHOOL_LEVEL[lv].name}
                </T>
                {schools[lv].length
                  ? schools[lv].map((x) => <SchoolRow key={x.id} school={x} />)
                  : empty}
              </View>
            ),
          )}
          <T size={12} color={C.muted} style={{ marginTop: 8 }}>
            출처: {SCHOOL_SOURCE}
            {hasZone ? `, ${ASSIGNMENT_SOURCE}` : ""}
            {asOf ? ` · 기준일 ${asOf}` : ""}
          </T>
        </>
      )}
    </Section>
  );
}
