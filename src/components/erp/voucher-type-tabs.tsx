"use client";

import { useThemeFeatures } from "@/lib/erp-theme-features";

// 전표 등록 화면의 "유형" 탭(매출/반품/샘플/수금, 매입/지급 …) — 매출·매입 전환기가 같은 마크업을 각자 갖고 있던 것을 한 곳으로.
// voucherLayout 테마는 제목줄 안에 한 줄로 들어가므로 아래 여백(erp-u-mb-12, !important)을 붙이지 않는다 — 그 여백이 탭을 제목·칩보다 위로 띄워 높낮이가 어긋났다.
// tone="danger"인 탭(반품)은 선택됐을 때 빨강으로 보인다.
export type VoucherTab<T extends string> = { value: T; label: string; tone?: "danger" };

export function VoucherTypeTabs<T extends string>({ tabs, value, onChange }: { tabs: VoucherTab<T>[]; value: T; onChange: (v: T) => void }) {
  const { voucherLayout } = useThemeFeatures();
  return (
    <div className={`erp-seg${voucherLayout ? "" : " erp-u-mb-12"}`} role="tablist" aria-label="전표 유형">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          role="tab"
          aria-selected={value === tab.value}
          className={`erp-seg-btn${value === tab.value ? " active" : ""}${tab.tone === "danger" ? " erp-seg-btn-danger" : ""}`}
          onClick={() => onChange(tab.value)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
