import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
  type StyleProp,
} from "react-native";
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  Info,
  Layers,
  LocateFixed,
  Map as MapIcon,
  MessageCircle,
  Minus,
  MoreHorizontal,
  Plus,
  Search,
  SlidersHorizontal,
  Star,
  X,
  RotateCcw,
  List,
  WifiOff,
  HelpCircle,
  MapPin,
  Mail,
  FileText,
  type LucideIcon,
} from "lucide-react-native";
import { C, FONT } from "../theme/tokens";
export const ICONS = {
  back: ArrowLeft,
  book: BookOpen,
  calendar: Calendar,
  check: Check,
  down: ChevronDown,
  right: ChevronRight,
  info: Info,
  layers: Layers,
  locate: LocateFixed,
  map: MapIcon,
  chat: MessageCircle,
  minus: Minus,
  more: MoreHorizontal,
  plus: Plus,
  search: Search,
  filter: SlidersHorizontal,
  star: Star,
  close: X,
  reset: RotateCcw,
  list: List,
  wifi: WifiOff,
  help: HelpCircle,
  pin: MapPin,
  mail: Mail,
  file: FileText,
};
export type IconName = keyof typeof ICONS;
export function Icon({
  name,
  size = 22,
  color = C.ink,
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  const I: LucideIcon = ICONS[name];
  return <I size={size} color={color} strokeWidth={1.8} />;
}
export function T({
  children,
  size = 16,
  bold = false,
  color = C.ink,
  style,
  ...props
}: {
  children?: React.ReactNode;
  size?: number;
  bold?: boolean;
  color?: string;
  style?: any;
  numberOfLines?: number;
  accessibilityRole?: "header";
}) {
  return (
    <Text
      {...props}
      style={[
        {
          fontFamily: bold ? "Pretendard-Bold" : FONT,
          fontSize: size,
          lineHeight: size * 1.5,
          fontWeight: bold ? "700" : "400",
          color,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
export function Btn({
  children,
  onPress,
  icon,
  secondary = false,
  small = false,
  disabled = false,
  style,
  label,
}: {
  children?: React.ReactNode;
  onPress: () => void;
  icon?: IconName;
  secondary?: boolean;
  small?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  label?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.btn,
        secondary && s.secondary,
        small && { height: 48 },
        disabled && { opacity: 0.45 },
        pressed && { opacity: 0.75 },
        style,
      ]}
    >
      {icon && <Icon name={icon} color={secondary ? C.ink : C.bg} />}
      <T bold size={small ? 16 : 17} color={secondary ? C.ink : C.bg}>
        {children}
      </T>
    </Pressable>
  );
}
export function IconBtn({
  name,
  onPress,
  label,
  style,
}: {
  name: IconName;
  onPress: () => void;
  label: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        s.iconBtn,
        pressed && { backgroundColor: C.bg2 },
        style,
      ]}
    >
      <Icon name={name} />
    </Pressable>
  );
}
export function Chip({
  children,
  onPress,
  selected = false,
  color = C.primary,
  disabled = false,
}: {
  children: React.ReactNode;
  onPress: () => void;
  selected?: boolean;
  color?: string;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      onPress={onPress}
      style={({ pressed }) => [
        s.chip,
        selected && { backgroundColor: color, borderColor: color },
        disabled && { backgroundColor: C.bg2, borderStyle: "dashed" },
        pressed && { opacity: 0.7 },
      ]}
    >
      <T
        size={15}
        bold={selected}
        color={disabled ? C.disabled : selected ? "#fff" : C.ink2}
      >
        {children}
      </T>
    </Pressable>
  );
}
export function Header({
  title,
  onBack,
  action,
}: {
  title: string;
  onBack: () => void;
  action?: React.ReactNode;
}) {
  return (
    <View style={s.header}>
      <IconBtn name="back" label="뒤로 가기" onPress={onBack} />
      <T size={21} bold style={{ flex: 1 }} accessibilityRole="header">
        {title}
      </T>
      {action}
    </View>
  );
}
export function Section({
  title,
  children,
  right,
}: {
  title: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <View style={{ paddingVertical: 16, gap: 12 }}>
      <View style={s.between}>
        <T bold size={18}>
          {title}
        </T>
        {right}
      </View>
      {children}
    </View>
  );
}
export function Notice({
  date,
  mode,
  onPress,
}: {
  date?: string;
  mode?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={onPress ? "button" : undefined}
      style={{
        paddingVertical: 10,
        paddingHorizontal: 16,
        flexDirection: "row",
        gap: 8,
        backgroundColor: C.bg,
      }}
    >
      <Icon name="info" size={18} color={C.light} />
      <T size={13} color={C.muted} style={{ flex: 1 }}>
        {mode === "sample" ? "샘플 데이터 · " : ""}
        {date
          ? `${date.slice(0, 10).replaceAll("-", ".")} 기준`
          : "데이터 기준일 확인 중"}{" "}
        · 최근 30일 거래는 아직 신고되지 않았을 수 있어요
      </T>
    </Pressable>
  );
}
export function AdSlot() {
  return (
    <View
      style={{
        height: 50,
        marginHorizontal: 20,
        marginBottom: 6,
        borderWidth: 1,
        borderStyle: "dashed",
        borderColor: C.disabled,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: C.bg2,
      }}
    >
      <T size={12} color={C.light}>
        광고 배너 (외부 SDK) 320×50
      </T>
    </View>
  );
}
export function StateCard({
  loading,
  error,
  empty,
  onRetry,
}: {
  loading?: boolean;
  error?: string | null;
  empty?: string;
  onRetry?: () => void;
}) {
  return (
    <View style={{ padding: 24, gap: 12, alignItems: "center" }}>
      {loading ? (
        <>
          <ActivityIndicator color={C.primary} />
          <T color={C.muted}>정보를 불러오는 중…</T>
        </>
      ) : (
        <>
          <Icon name={error ? "wifi" : "search"} size={28} color={C.light} />
          <T size={18} bold>
            {error ?? empty ?? "조건에 맞는 정보가 없어요"}
          </T>
          {Boolean(error) && onRetry && (
            <Btn onPress={onRetry} secondary small>
              다시 시도
            </Btn>
          )}
        </>
      )}
    </View>
  );
}
export function Help({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="용어 설명 보기"
      onPress={onPress}
      hitSlop={12}
    >
      <Icon name="help" size={19} color={C.muted} />
    </Pressable>
  );
}
export const s = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  between: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  btn: {
    height: 52,
    borderRadius: 12,
    backgroundColor: C.primary,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  secondary: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.rule,
  },
  iconBtn: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  chip: {
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: C.rule,
    backgroundColor: C.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    height: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderColor: C.rule,
    backgroundColor: C.bg,
  },
  input: {
    fontFamily: FONT,
    fontSize: 16,
    color: C.ink,
    height: 52,
    borderWidth: 1,
    borderColor: C.rule,
    borderRadius: 12,
    paddingHorizontal: 14,
    backgroundColor: C.surface,
  },
  card: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.rule,
    borderRadius: 12,
    padding: 16,
  },
  rule: { height: 1, backgroundColor: C.rule },
  screen: { flex: 1, backgroundColor: C.bg },
  link: { color: C.apartment, textDecorationLine: "underline" },
});
