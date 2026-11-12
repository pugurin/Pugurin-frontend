import React, { useState } from "react";
import { Image, Linking, View } from "react-native";
import type { Meta, Redevelopment } from "../api/types";
import { Btn, T, s } from "../components/ui";
import {
  REDEVELOPMENT_COLOR,
  REDEVELOPMENT_DONE_COLOR,
  REDEVELOPMENT_KIND_LABEL,
  REDEVELOPMENT_SOURCE,
  REDEVELOPMENT_STEPS,
  isDone,
  stageShort,
  stepIndex,
} from "../state/redevelopment";
import { C } from "../theme/tokens";
import { Badge, InfoRow } from "./AuctionContent";

const num = (v: number) => v.toLocaleString("ko-KR");

// 면적. 단위 토글을 따르고, 고른 단위 값이 없으면 다른 단위 값을 쓴다
function areaLine(r: Redevelopment, unit: "평" | "㎡"): string | null {
  const py = r.area_pyeong ?? (r.area_m2 != null ? r.area_m2 / 3.3058 : null);
  const m2 = r.area_m2 ?? (r.area_pyeong != null ? r.area_pyeong * 3.3058 : null);
  if (unit === "평" && py != null) return `${num(Math.round(py))}평`;
  if (m2 != null) return `${num(Math.round(m2))}㎡`;
  return null;
}

// 사업 단계 진행 표시. 지난 단계는 채우고 지금 단계는 이름을 굵게 쓴다
function Steps({ r }: { r: Redevelopment }) {
  const at = stepIndex(r);
  const color = isDone(r) ? REDEVELOPMENT_DONE_COLOR : REDEVELOPMENT_COLOR;
  return (
    <View
      accessibilityLabel={`사업 단계 ${REDEVELOPMENT_STEPS.length}단계 중 ${at + 1}단계`}
      style={{ marginTop: 12 }}
    >
      <View style={{ flexDirection: "row", gap: 3 }}>
        {REDEVELOPMENT_STEPS.map((x, i) => (
          <View
            key={x.stage}
            style={{
              flex: 1,
              height: 6,
              borderRadius: 3,
              backgroundColor: i <= at ? color : C.rule,
            }}
          />
        ))}
      </View>
      <View style={[s.between, { marginTop: 4 }]}>
        <T size={12} color={C.muted}>
          {REDEVELOPMENT_STEPS[0].short}
        </T>
        <T size={12} color={C.muted}>
          {REDEVELOPMENT_STEPS[REDEVELOPMENT_STEPS.length - 1].short}
        </T>
      </View>
    </View>
  );
}

// 재개발 구역 시트 내용. 목록 응답의 값을 그대로 쓰며 따로 부르지 않는다
export function RedevelopmentContent({
  r,
  meta,
  unit,
}: {
  r: Redevelopment;
  meta?: Meta;
  unit: "평" | "㎡";
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const done = isDone(r);
  const color = done ? REDEVELOPMENT_DONE_COLOR : REDEVELOPMENT_COLOR;
  const step = REDEVELOPMENT_STEPS[stepIndex(r)];
  const asOf = meta?.data_as_of?.slice(0, 10).replaceAll("-", ".");
  const area = areaLine(r, unit);
  const ratio = [
    r.floor_area_ratio != null ? `용적률 ${r.floor_area_ratio}%` : null,
    r.building_coverage_ratio != null
      ? `건폐율 ${r.building_coverage_ratio}%`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const rows: [string, string | null][] = [
    ["면적", area],
    ["세대수", r.households != null ? `${num(r.households)}세대` : null],
    ["동수", r.buildings != null ? `${num(r.buildings)}동` : null],
    ["조합원", r.union_members != null ? `${num(r.union_members)}명` : null],
    ["용적률·건폐율", ratio || null],
    ["규모", r.scale],
    ["사업시행자", r.business_entity],
    ["시공사", r.contractor],
    ["정비업체", r.specialists],
    ["전화", r.tel],
  ];
  const image = !imageFailed ? r.images?.view : null;
  return (
    <>
      <View style={[s.row, { flexWrap: "wrap" }]}>
        <Badge bg={color} ink="#fff">
          {REDEVELOPMENT_KIND_LABEL[r.kind]}
        </Badge>
        <Badge>{stageShort(r)}</Badge>
      </View>
      <T size={21} bold style={{ marginTop: 8 }}>
        {r.area_name}
      </T>
      {r.location && (
        <T size={14} color={C.muted}>
          {r.location}
        </T>
      )}
      {!r.location_precise && (
        <View style={[s.card, { marginTop: 8 }]}>
          <T size={14} color={C.ink2}>
            지도의 위치는 구역이 아니라 동 중심이에요
          </T>
        </View>
      )}
      <T size={15} bold style={{ marginTop: 16 }}>
        {step ? `지금 단계: ${step.label}` : `지금 단계: ${stageShort(r)}`}
      </T>
      {r.step_raw && step && r.step_raw !== step.label && (
        <T size={13} color={C.muted}>
          원문: {r.step_raw}
        </T>
      )}
      {stepIndex(r) >= 0 && <Steps r={r} />}
      {image && (
        <Image
          accessibilityLabel={`${r.area_name} 조감도`}
          source={{ uri: image }}
          onError={() => setImageFailed(true)}
          resizeMode="cover"
          style={{
            width: "100%",
            height: 180,
            borderRadius: 10,
            marginTop: 16,
            backgroundColor: C.bg2,
          }}
        />
      )}
      <View style={{ marginTop: 16, gap: 8 }}>
        {rows
          .filter((x): x is [string, string] => !!x[1])
          .map(([label, value]) => (
            <InfoRow key={label} label={label}>
              <T size={14} style={{ textAlign: "right" }}>
                {value}
              </T>
            </InfoRow>
          ))}
      </View>
      {r.source_url && (
        <View style={{ paddingVertical: 12 }}>
          <Btn
            secondary
            onPress={() =>
              void Linking.openURL(r.source_url!).catch(() => {})
            }
          >
            부산시 정비사업 페이지 열기 ↗
          </Btn>
        </View>
      )}
      <T size={13} color={C.muted} style={{ marginTop: 12 }}>
        {`구역 경계는 공개되지 않아 대표 지점만 표시해요\n출처: ${REDEVELOPMENT_SOURCE}${asOf ? ` · 기준일 ${asOf}` : ""}`}
      </T>
    </>
  );
}
