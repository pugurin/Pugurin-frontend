import React, { useState } from "react";
import { ScrollView, TextInput, View, Switch } from "react-native";
import type { Filters } from "../api/types";
import {
  DEAL,
  PROPERTY,
  draftFor,
  validateDraft,
  changeProperty,
  type Draft,
} from "../state/market";
import { Btn, Chip, Header, Section, T, s } from "../components/ui";
import { C } from "../theme/tokens";
export function FilterScreen({
  filters,
  onBack,
  onApply,
}: {
  filters: Filters;
  onBack: () => void;
  onApply: (f: Filters) => void;
}) {
  const [d, setD] = useState(draftFor(filters));
  const [error, setError] = useState("");
  const update = (k: keyof Draft, v: string | boolean) =>
    setD((p) => ({ ...p, [k]: v }));
  const range = (
    label: string,
    lo: keyof Draft,
    hi: keyof Draft,
    unit: string,
  ) => (
    <Section title={label}>
      <View style={s.row}>
        <TextInput
          accessibilityLabel={`${label} 최소`}
          placeholder={`최소 (${unit})`}
          keyboardType="decimal-pad"
          value={String(d[lo])}
          onChangeText={(v) => update(lo, v)}
          style={[s.input, { flex: 1 }]}
        />
        <T color={C.light}>~</T>
        <TextInput
          accessibilityLabel={`${label} 최대`}
          placeholder={`최대 (${unit})`}
          keyboardType="decimal-pad"
          value={String(d[hi])}
          onChangeText={(v) => update(hi, v)}
          style={[s.input, { flex: 1 }]}
        />
      </View>
    </Section>
  );
  return (
    <View style={s.screen}>
      <Header
        title="필터"
        onBack={onBack}
        action={
          <Btn
            secondary
            small
            icon="reset"
            onPress={() => {
              setD(
                draftFor({
                  ...changeProperty(filters, filters.property_type),
                  period_months: 12,
                  exclude_direct: false,
                }),
              );
              setError("");
            }}
          >
            초기화
          </Btn>
        }
      />
      <ScrollView contentContainerStyle={{ padding: 18 }}>
        <T color={C.muted}>
          지금 보는 지도 · {PROPERTY[filters.property_type]} ·{" "}
          {DEAL[filters.deal_type]}
        </T>
        <Section title="기간">
          <View style={s.between}>
            <T>최근 {d.period}개월</T>
            <TextInput
              value={d.period}
              onChangeText={(v) => update("period", v)}
              keyboardType="number-pad"
              accessibilityLabel="조회 기간"
              style={[s.input, { width: 80 }]}
            />
          </View>
          <View style={[s.row, { flexWrap: "wrap" }]}>
            {[1, 3, 6, 12, 24, 36, 60].map((n) => (
              <Chip
                key={n}
                selected={d.period === String(n)}
                onPress={() => update("period", String(n))}
              >
                {n}개월
              </Chip>
            ))}
          </View>
        </Section>
        {filters.deal_type === "sale"
          ? range("매매가", "priceMin", "priceMax", "억 원")
          : range("보증금", "depositMin", "depositMax", "억 원")}
        {filters.deal_type === "monthly" &&
          range("월세", "rentMin", "rentMax", "만 원")}
        {range(
          filters.property_type === "land" ? "토지면적" : "전용면적",
          "areaMin",
          "areaMax",
          "평",
        )}
        <Section title="직거래 제외">
          <View style={s.between}>
            <T size={15} color={C.muted} style={{ flex: 1 }}>
              시세와 다를 수 있는 직거래를 지도에서 빼요
            </T>
            <Switch
              accessibilityLabel="직거래 제외"
              value={d.exclude}
              onValueChange={(v) => update("exclude", v)}
              trackColor={{ true: C.primary }}
            />
          </View>
        </Section>
        {error !== "" && <T color={C.brown}>{error}</T>}
      </ScrollView>
      <View style={{ padding: 18, borderTopWidth: 1, borderColor: C.rule }}>
        <Btn
          onPress={() => {
            const r = validateDraft(filters, d);
            if (r.error) setError(r.error);
            else onApply(r.filters!);
          }}
        >
          결과보기
        </Btn>
      </View>
    </View>
  );
}
