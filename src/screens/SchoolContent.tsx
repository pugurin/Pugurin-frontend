import React, { useEffect, useState } from "react";
import { Linking, Platform, Pressable, View } from "react-native";
import type { ComplexMarker, Meta, Property, School } from "../api/types";
import { PROPERTY, formatArea, priceLabel } from "../state/market";
import { Btn, T, s } from "../components/ui";
import {
  ASSIGNMENT_NOTICE,
  ASSIGNMENT_SOURCE,
  SCHOOL_LEVEL,
  SCHOOL_NOTICE,
  SCHOOL_SOURCE,
} from "../state/school";
import { C } from "../theme/tokens";
import { Badge } from "./AuctionContent";

// 개교일의 앞 10글자("YYYY-MM-DD")를 "YYYY.MM.DD 개교"로 바꾼다
function openedLine(v: string): string {
  return `${v.slice(0, 10).replaceAll("-", ".")} 개교`;
}

// 학교 시트를 처음 여는 높이. 시트 손잡이(42)와 칩·제목·주소·안내·개교일·전화·홈페이지·출처가
// peek 하나에 다 들어가는 높이다. 작은 화면에서는 Sheet가 화면 높이의 42%로 줄인다
export const SCHOOL_PEEK = 360;

// 홈페이지 주소. 나이스 값은 "xxx.es.kr"처럼 프로토콜이 없기도 해서 http://를 붙인다.
// http·https가 아닌 프로토콜(javascript:, ftp: 등)이면 열지 않으려고 null을 돌려준다
export function homepageUrl(v: string | null | undefined): string | null {
  const url = v?.trim();
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  // "xxx.es.kr:8080"처럼 콜론 뒤가 숫자(포트)면 프로토콜이 아니라 호스트로 본다
  if (/^[a-z][a-z0-9+.-]*:(?!\d)/i.test(url)) return null;
  return `http://${url}`;
}

// 초등학교 통학구역 상태. ok면 지도에 칠했고, none은 학구도에 구역이 없는 학교, notReady는 서버 준비 전이다
export type ZoneStatus = "loading" | "ok" | "none" | "notReady" | "error";

const ZONE_LINE: Record<ZoneStatus, string> = {
  loading: "통학구역을 불러오는 중…",
  ok: "지도에 칠한 곳이 이 학교 통학구역이에요. 이 안에 살면 이 학교로 배정돼요",
  none: "학구도에서 이 학교 통학구역을 찾지 못했어요",
  notReady: "통학구역 정보를 준비 중이에요",
  error: "통학구역을 불러오지 못했어요",
};

// 통학구역 안 단지 목록을 처음 펼쳐 두는 건수. 나머지는 더보기로 연다
export const ZONE_COMPLEX_PREVIEW = 5;

// 학교 시트 내용. 목록 응답의 값을 그대로 쓰며 따로 부르지 않는다. 짧아서 단계와 상관없이 같은 내용이다.
// 초등학교는 MapHome이 통학구역과 그 안 단지를 불러와 zone·complexes로 넘긴다
export function SchoolContent({
  school,
  meta,
  zone,
  complexes,
  property = "apartment",
  unit = "평",
  onComplex,
}: {
  school: School;
  meta?: Meta;
  zone?: ZoneStatus;
  // 통학구역 안 단지. null이면 불러오는 중, undefined면 목록을 숨긴다
  complexes?: ComplexMarker[] | null;
  property?: Property;
  unit?: "평" | "㎡";
  onComplex?: (id: string) => void;
}) {
  const level = SCHOOL_LEVEL[school.level];
  const address = school.address.replace(/^부산광역시\s+/, "");
  const notice = meta?.school_notice || SCHOOL_NOTICE;
  // 출처가 배열로 와도 학교 시트에는 학교 출처만 쓴다. 기준일은 날짜시간으로 와서 앞 10글자만 쓴다
  const asOf = meta?.data_as_of?.slice(0, 10).replaceAll("-", ".");
  const sourceLine = `출처: ${SCHOOL_SOURCE}${zone === "ok" ? `, ${ASSIGNMENT_SOURCE}` : ""}${asOf ? ` · 기준일 ${asOf}` : ""}`;
  const homepage = homepageUrl(school.homepage);
  const callTel = () => {
    if (school.tel) void Linking.openURL(`tel:${school.tel}`).catch(() => {});
  };
  const openHomepage = () => {
    if (homepage) void Linking.openURL(homepage).catch(() => {});
  };
  return (
    <>
      <View style={[s.row, { flexWrap: "wrap" }]}>
        <Badge bg={level.color} ink="#fff">
          {level.name}
        </Badge>
        {school.foundation && <Badge>{school.foundation}</Badge>}
        {school.coed && <Badge>{school.coed}</Badge>}
      </View>
      <T size={21} bold style={{ marginTop: 8 }}>
        {school.name}
      </T>
      <T size={14} color={C.muted}>
        {address}
      </T>
      {/* 안내는 제목·주소 바로 뒤에 둬서 작은 화면의 peek에서도 보이게 한다.
          통학구역을 칠했으면 직선거리 안내 대신 통학구역 안내를 쓴다 */}
      <View style={[s.card, { marginTop: 8, marginBottom: 4, gap: 4 }]}>
        {zone ? (
          <>
            <T size={14} bold={zone === "ok"} color={C.ink2}>
              {ZONE_LINE[zone]}
            </T>
            {zone === "ok" && (
              <T size={13} color={C.muted}>
                {meta?.assignment_notice || ASSIGNMENT_NOTICE}
              </T>
            )}
          </>
        ) : (
          <T size={14} color={C.ink2}>
            {notice}
          </T>
        )}
      </View>
      {/* 토지는 단지가 아니라 필지 거래라 목록을 두지 않는다 */}
      {zone === "ok" && complexes !== undefined && property !== "land" && (
        <ZoneComplexes
          key={school.id}
          complexes={complexes}
          property={property}
          unit={unit}
          onComplex={onComplex}
        />
      )}
      {school.opened_on && (
        <T size={14} color={C.muted}>
          {openedLine(school.opened_on)}
        </T>
      )}
      {school.tel &&
        // 웹에서는 전화를 걸 수 없으니 글자만 보여준다
        (Platform.OS === "web" ? (
          <T size={14} selectable>
            {school.tel}
          </T>
        ) : (
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={`전화 ${school.tel}`}
            onPress={callTel}
            // 글자만 누르기에는 작아서 위아래로 누를 자리를 넓힌다
            style={{ alignSelf: "flex-start", paddingVertical: 12 }}
          >
            <T size={14} color={C.brownInk}>
              {school.tel}
            </T>
          </Pressable>
        ))}
      {homepage && (
        <View style={{ paddingVertical: 12 }}>
          <Btn secondary onPress={openHomepage}>
            홈페이지 열기 ↗
          </Btn>
        </View>
      )}
      <T size={13} color={C.muted} style={{ marginTop: 12 }}>
        {sourceLine}
      </T>
    </>
  );
}

// 통학구역 안 단지. 이 안에 살면 이 학교로 배정되니, 학교에서 집으로 거꾸로 찾아가는 목록이다
function ZoneComplexes({
  complexes,
  property,
  unit,
  onComplex,
}: {
  complexes: ComplexMarker[] | null;
  property: Property;
  unit: "평" | "㎡";
  onComplex?: (id: string) => void;
}) {
  const [all, setAll] = useState(false);
  useEffect(() => setAll(false), [complexes]);
  const kind = PROPERTY[property];
  if (!complexes)
    return (
      <T size={14} color={C.light} style={{ paddingVertical: 8 }}>
        통학구역 안 단지를 찾는 중…
      </T>
    );
  const shown = all ? complexes : complexes.slice(0, ZONE_COMPLEX_PREVIEW);
  return (
    <View style={{ marginTop: 8, marginBottom: 8 }}>
      <T size={16} bold>
        통학구역 안 {kind} {complexes.length}곳
      </T>
      <T size={13} color={C.muted}>
        {complexes.length
          ? "지금 조건으로 거래가 있는 곳이에요. 거래 많은 순"
          : "지금 조건으로 거래가 있는 곳이 없어요"}
      </T>
      {shown.map((c) => (
        <Pressable
          key={c.complex_id}
          accessibilityRole="button"
          accessibilityLabel={`${c.name} 보기`}
          onPress={() => onComplex?.(c.complex_id)}
          style={{
            paddingVertical: 10,
            borderBottomWidth: 1,
            borderColor: C.rule,
            gap: 2,
          }}
        >
          <View style={s.between}>
            <T size={15} bold style={{ flexShrink: 1 }}>
              {c.name}
            </T>
            <T size={15} bold>
              {priceLabel(c.latest)}
            </T>
          </View>
          <T size={13} color={C.muted}>
            최근 {formatArea(c.latest, unit)} · 거래 {c.transaction_count}건
          </T>
        </Pressable>
      ))}
      {!all && complexes.length > ZONE_COMPLEX_PREVIEW && (
        <View style={{ marginTop: 8 }}>
          <Btn secondary onPress={() => setAll(true)}>
            {`더보기 (${complexes.length - ZONE_COMPLEX_PREVIEW}곳)`}
          </Btn>
        </View>
      )}
    </View>
  );
}
