import React from "react";
// 테스트에서 react-native-svg 대신 쓰는 svg 요소
export default function Svg({ accessibilityLabel, children, ...p }: any) {
  return (
    <svg role="img" aria-label={accessibilityLabel} width={p.width} height={p.height} viewBox={p.viewBox}>
      {children}
    </svg>
  );
}
export const Path = ({ d, fill }: any) => <path d={d} fill={fill} />;
