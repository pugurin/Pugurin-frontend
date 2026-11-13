import React, { useContext, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import type { ComplexInterest, RegionInterest } from "../api/interests";
import { StarButton } from "../components/StarButton";
import { Chip, Header, Icon, T, s } from "../components/ui";
import { InterestsContext, REGION_LIMIT } from "../state/interests";
import { PROPERTY, formatArea, priceLabel } from "../state/market";
import { C } from "../theme/tokens";

// 더보기 → 관심 목록. 담아 둔 단지·지역(법정동)을 보고, 눌러서 지도로 가거나 ★로 뺀다
export function InterestsScreen({
  onBack,
  onComplex,
  onRegion,
  unit,
}: {
  onBack: () => void;
  onComplex: (complexId: string) => void;
  onRegion: (r: RegionInterest) => void;
  unit: "평" | "㎡";
}) {
  const { complexes, regions } = useContext(InterestsContext);
  const [tab, setTab] = useState<"complex" | "region">("complex");
  const empty =
    tab === "complex" ? complexes.length === 0 : regions.length === 0;
  return (
    <View style={s.screen}>
      <Header title="관심 목록" onBack={onBack} />
      <View style={[s.row, { gap: 6, paddingHorizontal: 16, paddingTop: 8 }]}>
        <Chip selected={tab === "complex"} onPress={() => setTab("complex")}>
          {`단지 ${complexes.length}`}
        </Chip>
        <Chip selected={tab === "region"} onPress={() => setTab("region")}>
          {`지역 ${regions.length}/${REGION_LIMIT}`}
        </Chip>
      </View>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
      >
        {empty ? (
          <View style={{ alignItems: "center", gap: 10, paddingVertical: 56 }}>
            <Icon name="star" size={32} color={C.light} />
            <T color={C.muted}>지도에서 ☆를 눌러 담아 보세요</T>
            {tab === "region" && (
              <T size={14} color={C.light}>
                관심 지역은 동 단위로 {REGION_LIMIT}개까지 담을 수 있어요
              </T>
            )}
          </View>
        ) : tab === "complex" ? (
          complexes.map((c) => (
            <ComplexRow
              key={c.complex_id}
              c={c}
              unit={unit}
              onPress={() => onComplex(c.complex_id)}
            />
          ))
        ) : (
          regions.map((r) => (
            <RegionRow key={r.region_code} r={r} onPress={() => onRegion(r)} />
          ))
        )}
      </ScrollView>
    </View>
  );
}

function Row({
  label,
  onPress,
  star,
  children,
}: {
  label: string;
  onPress: () => void;
  star: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <View
      style={[s.row, { gap: 10, borderBottomWidth: 1, borderColor: C.rule }]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label} 지도에서 보기`}
        onPress={onPress}
        style={{ flex: 1, paddingVertical: 14, gap: 4 }}
      >
        {children}
      </Pressable>
      {star}
    </View>
  );
}

function ComplexRow({
  c,
  unit,
  onPress,
}: {
  c: ComplexInterest;
  unit: "평" | "㎡";
  onPress: () => void;
}) {
  const { latest, created_at: _, ...item } = c;
  return (
    <Row
      label={c.name}
      onPress={onPress}
      star={<StarButton kind="complex" item={item} />}
    >
      <T bold size={17}>
        {c.name}
      </T>
      <T size={14} color={C.muted}>
        {PROPERTY[c.property_type]} · {c.address.replace("부산광역시 ", "")}
      </T>
      {latest ? (
        <T size={15}>
          <T bold size={15}>
            최근 {priceLabel(latest)}
          </T>
          {` · ${formatArea(latest, unit)} · ${latest.contract_date.slice(5).replace("-", ".")}`}
        </T>
      ) : (
        <T size={15} color={C.light}>
          최근 거래 정보 없음
        </T>
      )}
    </Row>
  );
}

function RegionRow({ r, onPress }: { r: RegionInterest; onPress: () => void }) {
  const item = {
    region_code: r.region_code,
    name: r.name,
    lat: r.lat,
    lng: r.lng,
  };
  return (
    <Row
      label={r.name}
      onPress={onPress}
      star={<StarButton kind="region" item={item} />}
    >
      <T bold size={17}>
        {r.name}
      </T>
      <T size={14} color={C.muted}>
        눌러서 지도에서 보기
      </T>
    </Row>
  );
}
