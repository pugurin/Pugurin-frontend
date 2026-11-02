import React from "react";
import { View } from "react-native";
import type { Repository } from "../api/repository";
import type { SheetStage } from "../components/Sheet";
import { T } from "../components/ui";

// 경매 시트 내용. 지금은 자리만 잡아 두고, 상세 화면은 다음 작업에서 채운다
export function AuctionContent({
  id,
  repo,
  stage,
  onStage,
  unit,
  notify,
}: {
  id: string;
  repo: Repository;
  stage: SheetStage;
  onStage: (s: SheetStage) => void;
  unit: "평" | "㎡";
  notify: (m: string) => void;
}) {
  return (
    <View style={{ padding: 20 }}>
      <T>경매 정보를 불러오는 중…</T>
    </View>
  );
}
