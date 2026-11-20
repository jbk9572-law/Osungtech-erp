"use client";

import { useThemeFeatures } from "@/lib/erp-theme-features";

// 표의 행 번호(No) 칸 — 테마 기능 rowNumbers가 켜졌을 때만 그린다(꺼져 있으면 칸 자체가 없다).
// 서버 컴포넌트 화면의 표(근태·권한관리 등)도 클라이언트 훅 없이 이 두 조각만 끼우면 같은 모양이 된다.
// 머리글에는 <RowNoHead />, 각 행의 첫 칸에는 <RowNoCell n={행번호(1부터)} />.
export function RowNoHead() {
  const { rowNumbers } = useThemeFeatures();
  if (!rowNumbers) return null;
  return (
    <th className="erp-col-no">
      <span className="erp-row-no">No</span>
    </th>
  );
}

export function RowNoCell({ n }: { n: number }) {
  const { rowNumbers } = useThemeFeatures();
  if (!rowNumbers) return null;
  return (
    <td className="erp-col-no">
      <span className="erp-row-no">{n}</span>
    </td>
  );
}
