"use client";

import type { ReactNode } from "react";
import { useThemeFeatures } from "@/lib/erp-theme-features";

// 표의 행 번호(No) 칸 — 테마 기능 rowNumbers가 켜졌을 때만 그린다(꺼져 있으면 칸 자체가 없다).
// 서버 컴포넌트 화면의 표(근태·권한관리 등)도 클라이언트 훅 없이 이 두 조각만 끼우면 같은 모양이 된다.
// 머리글에는 <RowNoHead />, 각 행의 첫 칸에는 <RowNoCell n={행번호(1부터)} />.
// 선택(체크박스)이 있는 표는 checkbox를 같이 넘긴다 — 번호가 있으면 한 칸에 [체크박스 번호]로 합치고, 번호가 없으면 체크박스만 있는 좁은 칸이 된다.
export function RowNoHead({ checkbox }: { checkbox?: ReactNode }) {
  const { rowNumbers } = useThemeFeatures();
  if (!rowNumbers) return checkbox ? <th className="erp-col-check">{checkbox}</th> : null;
  return (
    <th className="erp-col-no">
      {checkbox}
      <span className="erp-row-no">No</span>
    </th>
  );
}

export function RowNoCell({ n, checkbox }: { n: number; checkbox?: ReactNode }) {
  const { rowNumbers } = useThemeFeatures();
  if (!rowNumbers) return checkbox ? <td className="erp-col-check">{checkbox}</td> : null;
  return (
    <td className="erp-col-no">
      {checkbox}
      <span className="erp-row-no">{n}</span>
    </td>
  );
}
