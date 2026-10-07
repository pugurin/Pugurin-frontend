import React, { useState } from "react";
import { Linking, Pressable, ScrollView, View } from "react-native";
import type { Mode } from "../api/repository";
import { C } from "../theme/tokens";
import { Btn, Header, Icon, Section, T, s } from "../components/ui";
export type TermKind =
  | "서비스 이용약관"
  | "위치기반서비스 이용약관"
  | "개인정보 처리방침";
export function MoreScreen({
  date,
  mode,
  onMode,
  onDate,
  onTerms,
  notify,
}: {
  date?: string;
  mode: Mode;
  onMode: (m: Mode) => void;
  onDate: () => void;
  onTerms: (k: TermKind) => void;
  notify: (s: string) => void;
}) {
  const contact = process.env.EXPO_PUBLIC_CONTACT_EMAIL;
  const row = (label: string, onPress: () => void, right?: string) => (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[
        s.between,
        { paddingVertical: 17, borderBottomWidth: 1, borderColor: C.rule },
      ]}
    >
      <T>{label}</T>
      <View style={s.row}>
        {right && (
          <T size={14} color={C.muted}>
            {right}
          </T>
        )}
        <Icon name="right" size={18} color={C.light} />
      </View>
    </Pressable>
  );
  return (
    <View style={s.screen}>
      <T size={26} bold style={{ paddingHorizontal: 18, paddingTop: 16 }}>
        더보기
      </T>
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 32 }}>
        <View
          style={[
            s.card,
            {
              backgroundColor: C.bg2,
              borderStyle: "dashed",
              marginVertical: 14,
            },
          ]}
        >
          <T bold>로그인 · 회원가입</T>
          <T size={14} color={C.light}>
            관심 등록과 중개사 채팅은 2차에서 열려요
          </T>
        </View>
        <Section title="데이터">
          {row(
            "실거래가 기준일",
            onDate,
            date?.slice(0, 10).replaceAll("-", "."),
          )}
        </Section>
        <Section title="문의">
          {row("문의하기", () =>
            contact
              ? void Linking.openURL(`mailto:${contact}`).catch(() =>
                  notify("메일 앱을 열 수 없어요"),
                )
              : notify("문의 연락처가 아직 등록되지 않았어요"),
          )}
        </Section>
        <Section title="약관">
          {(
            [
              "서비스 이용약관",
              "위치기반서비스 이용약관",
              "개인정보 처리방침",
            ] as TermKind[]
          ).map((k) => (
            <React.Fragment key={k}>{row(k, () => onTerms(k))}</React.Fragment>
          ))}
        </Section>
        <Section title="데이터 출처">
          <T size={14} color={C.muted}>
            국토교통부 실거래가 (공공데이터포털){"\n"}카카오맵 지도{"\n"}
            부산광역시 도시계획 조례
          </T>
        </Section>
        <View style={s.between}>
          <T color={C.muted}>앱 버전</T>
          <T color={C.light}>0.1.0</T>
        </View>
        <Section title="화면 확인 설정">
          <T size={14} color={C.muted}>
            {mode === "api"
              ? "백엔드 API에 연결 중이에요"
              : "가짜 샘플 데이터로 화면을 보고 있어요"}
          </T>
          <Btn
            secondary
            onPress={() => onMode(mode === "api" ? "sample" : "api")}
          >
            {mode === "api" ? "샘플 화면 보기" : "백엔드 API 연결"}
          </Btn>
        </Section>
      </ScrollView>
    </View>
  );
}
export function TermsScreen({
  kind,
  onBack,
}: {
  kind: TermKind;
  onBack: () => void;
}) {
  const url =
    kind === "서비스 이용약관"
      ? process.env.EXPO_PUBLIC_TERMS_URL
      : kind === "위치기반서비스 이용약관"
        ? process.env.EXPO_PUBLIC_LOCATION_TERMS_URL
        : process.env.EXPO_PUBLIC_PRIVACY_URL;
  const [error, setError] = useState("");
  return (
    <View style={s.screen}>
      <Header title={kind} onBack={onBack} />
      <ScrollView contentContainerStyle={{ padding: 22, gap: 18 }}>
        <Icon name="file" size={32} color={C.light} />
        <T size={22} bold>
          {url
            ? "약관 원문을 확인해 주세요"
            : "약관 원문이 아직 등록되지 않았어요"}
        </T>
        <T color={C.muted}>
          서비스에 적용되는 약관과 시행일은 원문이 등록된 후 확인할 수 있어요.
        </T>
        {url && (
          <Btn
            onPress={() =>
              void Linking.openURL(url).catch(() =>
                setError("약관 원문을 열 수 없어요"),
              )
            }
          >
            약관 원문 보기
          </Btn>
        )}
        {error !== "" && <T color={C.brown}>{error}</T>}
      </ScrollView>
    </View>
  );
}
export function DataDateScreen({
  date,
  onBack,
}: {
  date?: string;
  onBack: () => void;
}) {
  return (
    <View style={s.screen}>
      <Header title="데이터 기준일" onBack={onBack} />
      <View style={{ padding: 24, gap: 20 }}>
        <T size={28} bold>
          {date?.slice(0, 10).replaceAll("-", ".") ?? "기준일 정보 없음"}
        </T>
        <T size={18} bold>
          하루에 한 번 새로 받아와요
        </T>
        <T>최근 30일 거래는 아직 신고되지 않았을 수 있어요</T>
        <T color={C.muted}>
          실거래는 계약하고 30일 안에 신고해요. 그래서 최근 한 달 거래는 나중에
          더 늘어날 수 있어요.
        </T>
        <Btn onPress={onBack}>확인</Btn>
      </View>
    </View>
  );
}
