import React from "react";
import { Linking, Platform, Pressable, View } from "react-native";
import type { Meta, School } from "../api/types";
import { Btn, T, s } from "../components/ui";
import { SCHOOL_LEVEL, SCHOOL_NOTICE, SCHOOL_SOURCE } from "../state/school";
import { C } from "../theme/tokens";
import { Badge } from "./AuctionContent";

// 개교일 "YYYY-MM-DD"를 "YYYY.MM.DD 개교"로. 형식이 다르면 그대로 쓴다
function openedLine(v: string): string {
  return `${v.slice(0, 10).replaceAll("-", ".")} 개교`;
}

// 학교 시트 내용. 목록 응답의 값을 그대로 쓰며 따로 부르지 않는다. 짧아서 단계와 상관없이 같은 내용이다
export function SchoolContent({
  school,
  meta,
}: {
  school: School;
  meta?: Meta;
}) {
  const level = SCHOOL_LEVEL[school.level];
  const address = school.address.replace(/^부산광역시\s+/, "");
  const notice = meta?.school_notice || SCHOOL_NOTICE;
  // 출처가 배열로 와도 학교 시트에는 학교 출처만 쓴다
  const sourceLine = `출처: ${SCHOOL_SOURCE}${
    meta?.data_as_of ? ` · 기준일 ${meta.data_as_of}` : ""
  }`;
  const callTel = () => {
    if (school.tel) void Linking.openURL(`tel:${school.tel}`).catch(() => {});
  };
  const openHomepage = () => {
    if (school.homepage) void Linking.openURL(school.homepage).catch(() => {});
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
          >
            <T size={14} color={C.brownInk}>
              {school.tel}
            </T>
          </Pressable>
        ))}
      {school.homepage && (
        <View style={{ paddingVertical: 12 }}>
          <Btn secondary onPress={openHomepage}>
            홈페이지 열기 ↗
          </Btn>
        </View>
      )}
      <View style={[s.card, { marginTop: 8 }]}>
        <T size={14} color={C.ink2}>
          {notice}
        </T>
      </View>
      <T size={13} color={C.muted} style={{ marginTop: 12 }}>
        {sourceLine}
      </T>
    </>
  );
}
