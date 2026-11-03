import React, { useState } from "react";
import { Linking, Pressable, View } from "react-native";
import type { Hospital, Meta } from "../api/types";
import { Btn, T, s } from "../components/ui";
import { HOSPITAL_SOURCE, tierSummary } from "../state/hospital";
import type { HospitalArea } from "../state/hospital";
import { C } from "../theme/tokens";
import { homepageUrl } from "./SchoolContent";

// "종합병원 · 의사 84명". 종별이나 의사 수가 비어 있으면 있는 것만 쓴다
function detailLine(h: Hospital): string {
  return [h.class_name, h.doctors != null ? `의사 ${h.doctors}명` : null]
    .filter(Boolean)
    .join(" · ");
}

// 병원 한 줄. 누르면 주소·전화·홈페이지가 펼쳐진다
function HospitalRow({
  h,
  open,
  onToggle,
}: {
  h: Hospital;
  open: boolean;
  onToggle: () => void;
}) {
  const homepage = homepageUrl(h.homepage);
  const address = h.address.replace(/^부산광역시\s+/, "");
  const line = detailLine(h);
  return (
    <View style={{ borderTopWidth: 1, borderTopColor: C.rule }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        aria-expanded={open}
        onPress={onToggle}
        style={{ paddingVertical: 12 }}
      >
        <T size={16} bold>
          {h.name}
        </T>
        {line !== "" && (
          <T size={14} color={C.muted}>
            {line}
          </T>
        )}
      </Pressable>
      {open && (
        <View style={{ paddingBottom: 12 }}>
          <T size={14} color={C.ink2}>
            {address}
          </T>
          {(h.tel || homepage) && (
            <View style={[s.row, { marginTop: 8, flexWrap: "wrap" }]}>
              {h.tel && (
                <Btn
                  secondary
                  onPress={() =>
                    void Linking.openURL(`tel:${h.tel}`).catch(() => {})
                  }
                >
                  전화
                </Btn>
              )}
              {homepage && (
                <Btn
                  secondary
                  onPress={() => void Linking.openURL(homepage).catch(() => {})}
                >
                  홈페이지
                </Btn>
              )}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

// 병원 원 시트 내용. 원 안의 병원을 모두 나열하며 목록 응답의 값을 그대로 쓴다
export function HospitalAreaContent({
  area,
  meta,
}: {
  area: HospitalArea;
  meta?: Meta;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  // 기준일은 날짜시간으로 와서 앞 10글자만 쓴다. 병원 시트는 항상 병원 출처를 쓴다
  const asOf = meta?.data_as_of?.slice(0, 10).replaceAll("-", ".");
  const sourceLine = `출처: ${HOSPITAL_SOURCE}${asOf ? ` · 기준일 ${asOf}` : ""}`;
  return (
    <>
      <T size={21} bold>
        {`병원 ${area.members.length}곳`}
      </T>
      <T size={14} color={C.muted} style={{ marginBottom: 8 }}>
        {tierSummary(area.members)}
      </T>
      {area.members.map((h) => (
        <HospitalRow
          key={h.id}
          h={h}
          open={openId === h.id}
          onToggle={() => setOpenId(openId === h.id ? null : h.id)}
        />
      ))}
      <T size={13} color={C.muted} style={{ marginTop: 12 }}>
        {sourceLine}
      </T>
    </>
  );
}
