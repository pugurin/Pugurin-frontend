import React, { useEffect, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { C } from "../theme/tokens";
import { Chip, Icon, Section, T, s } from "./ui";
import { formatWon } from "../state/auction";
import {
  ASSET_STEP,
  HOMES,
  LOAN_TERMS,
  SAMPLE_RATES,
  calcLoan,
  snapAssets,
  type Homes,
  type LoanRates,
  type LoanTerm,
} from "../state/loan";

// 처음 슬라이더 위치. 매매가의 30%를 내 자산으로 둔다
const DEFAULT_ASSET_RATIO = 0.3;

// 단지 상세 최하단 대출 계산기 (#143).
// regulated·rates는 백엔드가 줄 값이다. 없으면(null) 규제지역은 사용자가 고르고 금리는 예시값을 쓴다
export function LoanCalculator({
  defaultPrice,
  regulated = null,
  rates = null,
}: {
  defaultPrice?: number | null;
  regulated?: boolean | null;
  rates?: LoanRates | null;
}) {
  const [price, setPrice] = useState(defaultPrice ?? 0);
  const [priceText, setPriceText] = useState(manText(defaultPrice));
  const [assets, setAssets] = useState(initialAssets(defaultPrice ?? 0));
  const [isRegulated, setRegulated] = useState(regulated ?? false);
  const [homes, setHomes] = useState<Homes>("none");
  const [firstTime, setFirstTime] = useState(false);
  const [years, setYears] = useState<LoanTerm>(30);
  // 단지·평형을 바꾸면 매매가와 자산을 새로 맞춘다
  useEffect(() => {
    setPrice(defaultPrice ?? 0);
    setPriceText(manText(defaultPrice));
    setAssets(initialAssets(defaultPrice ?? 0));
  }, [defaultPrice]);
  useEffect(() => {
    if (regulated != null) setRegulated(regulated);
  }, [regulated]);

  const rate = (rates ?? SAMPLE_RATES)[years];
  const criteria = { regulated: isRegulated, homes, firstTime };
  const r = calcLoan({ price, assets, criteria, rate, years });
  const commitPrice = (text: string) => {
    const man = Number(text.replace(/[^0-9]/g, ""));
    const won = Number.isFinite(man) ? man * 1e4 : 0;
    setPrice(won);
    setPriceText(won ? manText(won) : "");
    setAssets((a) => snapAssets(a, won));
  };

  return (
    <Section title="대출 계산">
      <View style={{ gap: 6 }}>
        <T size={14} color={C.muted}>
          매매가 (만 원)
        </T>
        <TextInput
          accessibilityLabel="매매가 (만 원)"
          placeholder="예: 50000"
          keyboardType="number-pad"
          value={priceText}
          onChangeText={setPriceText}
          onBlur={() => commitPrice(priceText)}
          onSubmitEditing={() => commitPrice(priceText)}
          style={s.input}
        />
        <T size={13} color={C.light}>
          {defaultPrice
            ? `최근 매매 실거래가 ${formatWon(defaultPrice)} 기준이에요. 바꿔 볼 수 있어요`
            : "매매 실거래가가 없어요. 매매가를 입력해 주세요"}
        </T>
      </View>

      <View style={[s.card, { gap: 10 }]}>
        <T bold>적용 기준</T>
        <Check
          label="규제지역 (투기과열지구 등)"
          checked={isRegulated}
          onPress={() => setRegulated((v) => !v)}
        />
        {regulated == null && (
          <T size={12} color={C.light}>
            이 단지의 규제지역 정보는 준비 중이에요. 직접 골라 주세요
          </T>
        )}
        <View style={[s.row, { flexWrap: "wrap" }]}>
          {(Object.keys(HOMES) as Homes[]).map((h) => (
            <Chip key={h} selected={homes === h} onPress={() => setHomes(h)}>
              {HOMES[h]}
            </Chip>
          ))}
        </View>
        <Check
          label="생애최초 주택 구입"
          checked={firstTime && homes === "none"}
          disabled={homes !== "none"}
          onPress={() => setFirstTime((v) => !v)}
        />
        <View style={s.between}>
          <T size={14} color={C.muted}>
            최대 LTV
          </T>
          <T bold color={r.ltv === 0 ? C.brown : C.ink}>
            {r.ltv}% · 한도 {price ? formatWon(r.limit) : "—"}
          </T>
        </View>
      </View>

      {price > 0 && (
        <>
          <View style={{ gap: 8 }}>
            <View style={s.between}>
              <T size={14} color={C.muted}>
                내 자산
              </T>
              <T size={20} bold>
                {formatWon(assets)}
              </T>
            </View>
            <View style={s.row}>
              <StepBtn
                icon="minus"
                label="내 자산 1천만 원 줄이기"
                onPress={() => setAssets((a) => snapAssets(a - ASSET_STEP, price))}
              />
              <Slider
                value={assets}
                max={price}
                onChange={(v) => setAssets(snapAssets(v, price))}
              />
              <StepBtn
                icon="plus"
                label="내 자산 1천만 원 늘리기"
                onPress={() => setAssets((a) => snapAssets(a + ASSET_STEP, price))}
              />
            </View>
            <View style={s.between}>
              <T size={14} color={C.muted}>
                필요한 대출
              </T>
              <T bold>
                {formatWon(r.needed)} · 매매가의{" "}
                {Math.round((r.needed / price) * 100)}%
              </T>
            </View>
          </View>

          <View
            accessibilityRole="summary"
            style={[
              s.card,
              {
                gap: 4,
                backgroundColor: r.ok ? C.greenWash : C.brownWash,
                borderColor: r.ok ? C.greenRule : C.brown,
              },
            ]}
          >
            <T bold color={r.ok ? C.greenInk : C.brownInk}>
              {r.needed === 0
                ? "대출 없이 살 수 있어요"
                : r.ok
                  ? "LTV 기준 대출 가능"
                  : "LTV 한도 초과"}
            </T>
            <T size={14} color={r.ok ? C.greenInk : C.brownInk}>
              {r.needed === 0
                ? "내 자산이 매매가보다 많아요"
                : r.ok
                  ? `한도 ${formatWon(r.limit)} 안에서 ${formatWon(r.needed)}을 빌려요`
                  : r.limit === 0
                    ? "이 조건에서는 주택담보대출을 받을 수 없어요"
                    : `자산이 ${formatWon(r.shortfall)} 더 필요해요`}
            </T>
          </View>

          <View style={{ gap: 8 }}>
            <View style={s.between}>
              <T size={14} color={C.muted}>
                대출 기간
              </T>
              <T size={14} color={C.muted}>
                연 {rate.toFixed(1)}%{rates ? "" : " · 예시 금리"}
              </T>
            </View>
            <View style={s.row}>
              {LOAN_TERMS.map((y) => (
                <Chip key={y} selected={years === y} onPress={() => setYears(y)}>
                  {`${y}년`}
                </Chip>
              ))}
            </View>
          </View>

          <View style={[s.card, { gap: 4 }]}>
            <T size={14} color={C.muted}>
              예상 월납입금{!r.ok && r.loan > 0 ? " (한도까지 빌릴 때)" : ""}
            </T>
            <T size={26} bold>
              {r.loan > 0 ? `월 ${formatWon(Math.round(r.monthly))}원` : "없음"}
            </T>
            {r.loan > 0 && (
              <T size={13} color={C.light}>
                원리금균등 · {years}년 · 총 이자 {formatWon(r.totalInterest)}원
              </T>
            )}
          </View>
        </>
      )}
      <T size={12} color={C.light}>
        LTV만 반영한 참고용 계산이에요. DSR(소득 대비 상환 비율)·은행 심사·정책
        대출 한도에 따라 실제 대출액은 달라요.
      </T>
    </Section>
  );
}

function manText(won: number | null | undefined) {
  return won ? String(Math.round(won / 1e4)) : "";
}
function initialAssets(price: number) {
  return snapAssets(price * DEFAULT_ASSET_RATIO, price);
}

function Check({
  label,
  checked,
  disabled = false,
  onPress,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[s.row, { paddingVertical: 4 }]}
    >
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 6,
          borderWidth: 1.5,
          borderColor: checked ? C.primary : disabled ? C.disabled : C.light,
          backgroundColor: checked ? C.primary : C.surface,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {checked && <Icon name="check" size={16} color="#fff" />}
      </View>
      <T size={15} color={disabled ? C.disabled : C.ink2}>
        {label}
      </T>
    </Pressable>
  );
}

function StepBtn({
  icon,
  label,
  onPress,
}: {
  icon: "minus" | "plus";
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[s.iconBtn, s.secondary]}
    >
      <Icon name={icon} size={18} />
    </Pressable>
  );
}

// 가로 슬라이더. 트랙을 누르거나 끌면 그 위치 값으로 바꾼다.
// 손잡이·채움은 pointerEvents="none"이라 locationX가 항상 트랙 기준이다
const THUMB = 24;
function Slider({
  value,
  max,
  onChange,
}: {
  value: number;
  max: number;
  onChange: (v: number) => void;
}) {
  const [width, setWidth] = useState(0);
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const pick = (x: number) => {
    if (width <= 0) return;
    onChange(((x - THUMB / 2) / (width - THUMB)) * max);
  };
  return (
    <View
      accessibilityRole="adjustable"
      accessibilityLabel="내 자산"
      accessibilityValue={{ min: 0, max, now: value, text: formatWon(value) }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(e) =>
        onChange(value + (e.nativeEvent.actionName === "increment" ? 1 : -1) * ASSET_STEP)
      }
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={(e) => pick(e.nativeEvent.locationX)}
      onResponderMove={(e) => pick(e.nativeEvent.locationX)}
      style={{ flex: 1, height: 44, justifyContent: "center", cursor: "pointer" } as any}
    >
      <View
        pointerEvents="none"
        style={{
          height: 6,
          marginHorizontal: THUMB / 2,
          borderRadius: 3,
          backgroundColor: C.bg2,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            width: `${ratio * 100}%`,
            height: "100%",
            backgroundColor: C.primary,
          }}
        />
      </View>
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: ratio * Math.max(0, width - THUMB),
          width: THUMB,
          height: THUMB,
          borderRadius: THUMB / 2,
          backgroundColor: C.surface,
          borderWidth: 2,
          borderColor: C.primary,
        }}
      />
    </View>
  );
}
