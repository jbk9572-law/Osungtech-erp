"use client";

import { SheetColumnMenu } from "@/components/grid/sheet-parts";

export type ColumnVisibilityOption = { key: string; label: string };

// 매출/매입 등 가로형 표 위에 두는 "열 설정" 버튼 — 열 이름(key)으로 숨김을 관리하는 화면용 얇은 어댑터.
// 모양·동작은 목록 화면의 열 설정(SheetColumnMenu)과 완전히 같다(R-010: 같은 기능이 이름·부품이 달랐던 것을 한 부품으로).
// 계정마다 보고 싶은 칸이 다를 수 있어 useColumnVisibility가 계정별로 저장한다. 항상 보여야 하는 핵심 칸은 options에 안 넣는다.
export function ColumnVisibilityMenu({
  options,
  isHidden,
  onToggle,
}: {
  options: ColumnVisibilityOption[];
  isHidden: (key: string) => boolean;
  onToggle: (key: string) => void;
}) {
  const hidden = new Set(options.flatMap((o, i) => (isHidden(o.key) ? [i] : [])));
  return <SheetColumnMenu labels={options.map((o) => o.label)} hidden={hidden} onToggle={(i) => onToggle(options[i].key)} />;
}
