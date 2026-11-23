"use client";

import type { ReactNode } from "react";
import { ListToolbar } from "@/components/erp/list-toolbar";
import { useThemeFeatures } from "@/lib/erp-theme-features";

// 서버 화면(매출·매입 목록처럼 표 상태가 클라이언트 쪽에 있는 화면)의 버튼 줄 — 모던은 공용 도구 줄(ListToolbar: 작업 | 도구 구분선),
// 클래식은 예전 그대로 한 줄(.erp-toolbar). 버튼은 화면이 만들고 이 부품은 줄의 모양만 테마에 맞춘다.
export function PageToolbar({ actions, tools }: { actions: ReactNode; tools?: ReactNode }) {
  const { appChrome } = useThemeFeatures();
  if (appChrome) return <ListToolbar actions={actions} tools={tools} />;
  return (
    <div className="erp-toolbar">
      {actions}
      {tools}
    </div>
  );
}
