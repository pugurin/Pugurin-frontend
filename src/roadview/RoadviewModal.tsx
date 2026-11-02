import React, { useEffect, useState } from "react";
import { ActivityIndicator, Modal, SafeAreaView, View } from "react-native";
import { C } from "../theme/tokens";
import { IconBtn, T } from "../components/ui";
import type { RoadviewStatus } from "../map/kakaoRuntime";
import Roadview from "./Roadview";

// 단지 위치의 로드뷰를 전체 화면으로 띄운다. 근처(100m)에 로드뷰가 없으면 안내만 보여 준다
export function RoadviewModal({
  visible,
  title,
  lat,
  lng,
  onClose,
}: {
  visible: boolean;
  title: string;
  lat: number;
  lng: number;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<RoadviewStatus | "loading">("loading");
  useEffect(() => {
    if (visible) setStatus("loading");
  }, [visible, lat, lng]);
  const message =
    status === "none"
      ? "이 위치는 로드뷰가 없어요"
      : status === "error"
        ? "로드뷰를 불러올 수 없어요"
        : null;
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      {/* 전체 화면 모달이라 상태 표시줄·다이내믹 아일랜드 아래부터 그린다 */}
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            paddingHorizontal: 12,
            paddingTop: 12,
            paddingBottom: 8,
          }}
        >
          <T size={18} bold numberOfLines={1} style={{ flex: 1 }}>
            {title} 로드뷰
          </T>
          <IconBtn name="close" label="로드뷰 닫기" onPress={onClose} />
        </View>
        <View style={{ flex: 1, backgroundColor: C.bg2 }}>
          {visible && <Roadview lat={lat} lng={lng} onStatus={setStatus} />}
          {status !== "ready" && (
            <View
              style={{
                position: "absolute",
                inset: 0,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: C.bg2,
                padding: 24,
              }}
            >
              {message ? (
                <T color={C.muted} style={{ textAlign: "center" }}>
                  {message}
                </T>
              ) : (
                <ActivityIndicator color={C.muted} accessibilityLabel="로드뷰 불러오는 중" />
              )}
            </View>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}
