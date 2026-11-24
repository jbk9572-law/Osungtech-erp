"use client";

import { useThemeFeatures } from "@/lib/erp-theme-features";
import { MessengerPage as ModernMessenger } from "./messenger/modern";
import { MessengerPage as ClassicMessenger } from "./messenger/classic";
import type { ErpRefAccess } from "@/lib/messenger-erp-access";

export type { MessengerMessage } from "@/lib/messenger-types";

// 테마별로 화면 코드를 완전히 나눈다 — 모던(grid-modern)은 messenger/modern.tsx, 클래식은 동결본 messenger/classic.tsx. 서로 코드를 공유하지 않는다.
export function MessengerPage({ erpRefAccess, ...props }: React.ComponentProps<typeof ClassicMessenger> & { erpRefAccess?: ErpRefAccess }) {
  const { listSidePanel } = useThemeFeatures();
  return listSidePanel ? <ModernMessenger {...props} erpRefAccess={erpRefAccess} /> : <ClassicMessenger {...props} />;
}
