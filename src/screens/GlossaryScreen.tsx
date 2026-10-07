import React, { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, TextInput, View } from "react-native";
import type { Term } from "../api/types";
import { C } from "../theme/tokens";
import {
  Btn,
  Chip,
  Header,
  Icon,
  IconBtn,
  Section,
  StateCard,
  T,
  s,
} from "../components/ui";
export const CATEGORIES = {
  trade: "거래",
  land: "토지",
  building: "건물",
  tax: "세금",
};
export function GlossaryScreen({
  terms,
  loading,
  error,
  onRetry,
  onTerm,
}: {
  terms: Term[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onTerm: (t: Term) => void;
}) {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const popular = terms.filter((t) => t.is_popular);
  const result = useMemo(
    () =>
      terms
        .filter(
          (t) =>
            (!category || t.category === category) &&
            `${t.term} ${t.short_definition}`.includes(q.trim()),
        )
        .sort(
          (a, b) =>
            a.display_order - b.display_order ||
            a.term.localeCompare(b.term, "ko"),
        ),
    [terms, q, category],
  );
  const chips = (
    <View style={[s.row, { flexWrap: "wrap" }]}>
      {popular.map((t) => (
        <Pressable
          key={t.id}
          accessibilityRole="button"
          onPress={() => onTerm(t)}
          style={{
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderWidth: 1,
            borderColor: C.rule,
            borderRadius: 12,
            backgroundColor: C.surface,
          }}
        >
          <T bold>{t.term}</T>
        </Pressable>
      ))}
    </View>
  );
  return (
    <View style={s.screen}>
      <T
        size={26}
        bold
        style={{ paddingHorizontal: 18, paddingTop: 14, paddingBottom: 8 }}
      >
        용어사전
      </T>
      <View
        style={[
          s.row,
          {
            marginHorizontal: 16,
            backgroundColor: C.surface,
            borderWidth: 1,
            borderColor: C.rule,
            borderRadius: 12,
            paddingLeft: 12,
          },
        ]}
      >
        <Icon name="search" color={C.light} />
        <TextInput
          placeholder="궁금한 용어를 검색하세요"
          value={q}
          onChangeText={setQ}
          style={[s.input, { borderWidth: 0, flex: 1, paddingLeft: 0 }]}
        />
        {q !== "" && (
          <IconBtn
            name="close"
            label="용어 검색어 지우기"
            onPress={() => setQ("")}
          />
        )}
      </View>
      <View style={{ height: 66 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 16,
            alignItems: "center",
            gap: 8,
          }}
        >
          {[["", "전체"], ...Object.entries(CATEGORIES)].map(([k, v]) => (
            <Chip
              key={k}
              selected={k === category}
              color={k === "land" ? C.land : C.primary}
              onPress={() => setCategory(k)}
            >
              {v}
            </Chip>
          ))}
        </ScrollView>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
        {loading || error ? (
          <StateCard loading={loading} error={error} onRetry={onRetry} />
        ) : (
          <>
            {!q && !category && (
              <View style={{ padding: 18, backgroundColor: C.bg }}>
                <T bold color={C.muted} style={{ marginBottom: 12 }}>
                  자주 찾는 용어
                </T>
                {chips}
              </View>
            )}
            {!q && !category && (
              <View style={{ height: 8, backgroundColor: C.bg2 }} />
            )}
            {result.length ? (
              <>
                <T
                  bold
                  size={15}
                  color={C.muted}
                  style={{ padding: 18, paddingBottom: 8 }}
                >
                  {q
                    ? `검색 결과 ${result.length}개`
                    : category
                      ? `${CATEGORIES[category as keyof typeof CATEGORIES]} 용어 ${result.length}개`
                      : "전체 용어"}
                </T>
                {result.map((t) => (
                  <Pressable
                    accessibilityRole="button"
                    key={t.id}
                    onPress={() => onTerm(t)}
                    style={{
                      paddingHorizontal: 18,
                      paddingVertical: 14,
                      borderBottomWidth: 1,
                      borderColor: C.rule,
                      backgroundColor: C.surface,
                    }}
                  >
                    <View style={s.between}>
                      <View style={{ flex: 1, gap: 4 }}>
                        <View style={s.row}>
                          <T size={18} bold>
                            {t.term}
                          </T>
                          <T
                            size={13}
                            color={t.category === "land" ? C.land : C.light}
                          >
                            {CATEGORIES[t.category]}
                          </T>
                        </View>
                        <T size={15} color={C.muted}>
                          {t.short_definition}
                        </T>
                      </View>
                      <Icon name="right" size={20} color={C.light} />
                    </View>
                  </Pressable>
                ))}
              </>
            ) : (
              <View style={{ padding: 20, gap: 14 }}>
                <T size={19} bold>
                  ‘{q}’에 맞는 용어가 없어요
                </T>
                <T size={15} color={C.muted}>
                  띄어쓰기를 바꾸거나 다른 말로 검색해 보세요
                </T>
                <T bold style={{ marginTop: 12 }}>
                  이런 용어는 어떠세요
                </T>
                {chips}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
export function TermDetail({
  term,
  onBack,
  returnMap = false,
}: {
  term: Term;
  onBack: () => void;
  returnMap?: boolean;
}) {
  return (
    <View style={s.screen}>
      <Header
        title={returnMap ? "지도로 돌아가기" : "용어 목록"}
        onBack={onBack}
      />
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 32, gap: 16 }}
      >
        <T size={14} color={term.category === "land" ? C.land : C.muted}>
          {CATEGORIES[term.category]}
        </T>
        <T size={30} bold>
          {term.term}
        </T>
        <View style={s.card}>
          <T size={18} bold>
            {term.short_definition}
          </T>
        </View>
        <Section title="쉽게 풀면">
          <T size={17} style={{ lineHeight: 29 }}>
            {term.long_definition}
          </T>
        </Section>
        <Section title="예시">
          {term.term === "용적률" ? (
            <View
              style={{
                padding: 20,
                alignItems: "center",
                backgroundColor: C.bg2,
                borderRadius: 12,
                gap: 4,
              }}
            >
              {[5, 4, 3, 2, 1].map((n) => (
                <View
                  key={n}
                  style={{
                    width: 130,
                    height: 25,
                    backgroundColor: n % 2 ? C.light : C.disabled,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <T size={13} color="#fff">
                    {n}층
                  </T>
                </View>
              ))}
              <T size={14}>땅 100평 · 1층 50평 × 5층</T>
              <T bold>연면적 250평 → 용적률 250%</T>
            </View>
          ) : term.term === "건폐율" ? (
            <View
              style={{ backgroundColor: C.bg2, padding: 18, borderRadius: 12 }}
            >
              <View
                style={{
                  height: 110,
                  borderWidth: 1,
                  borderColor: C.light,
                  flexDirection: "row",
                }}
              >
                <View
                  style={{
                    width: "60%",
                    backgroundColor: C.light,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <T color="#fff">건물 60평</T>
                </View>
                <View
                  style={{
                    flex: 1,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <T size={14}>마당{"\n"}40평</T>
                </View>
              </View>
              <T style={{ marginTop: 10 }}>땅 100평 · 건폐율 60%</T>
            </View>
          ) : null}
          <View style={[s.card, { backgroundColor: C.bg2, borderWidth: 0 }]}>
            <T size={16}>{term.example}</T>
          </View>
        </Section>
      </ScrollView>
    </View>
  );
}
export function TermPopup({
  term,
  onClose,
  onDetail,
}: {
  term: Term | null;
  onClose: () => void;
  onDetail: (t: Term) => void;
}) {
  return (
    <Modal
      visible={!!term}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: "rgba(17,17,16,.45)",
          justifyContent: "center",
          padding: 20,
        }}
      >
        <Pressable
          onPress={() => {}}
          style={{
            backgroundColor: C.surface,
            borderRadius: 18,
            padding: 20,
            gap: 16,
          }}
        >
          <View style={s.between}>
            <T size={22} bold>
              {term?.term}
            </T>
            <IconBtn name="close" label="용어 팝업 닫기" onPress={onClose} />
          </View>
          <T size={18}>{term?.short_definition}</T>
          <View style={s.row}>
            <Btn secondary onPress={onClose} style={{ flex: 1 }}>
              닫기
            </Btn>
            <Btn onPress={() => term && onDetail(term)} style={{ flex: 1.7 }}>
              용어사전에서 보기
            </Btn>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
