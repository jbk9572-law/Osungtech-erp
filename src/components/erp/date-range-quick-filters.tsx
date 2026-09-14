import Link from "next/link";
import type { DatePreset } from "@/lib/date-presets";

// 매출/매입 목록 상단의 조회기간 바로가기 — 프리셋(오늘/이번주/이번달 등)
// 줄과 1월~12월 월별 버튼 줄을 한 컴포넌트로 묶어서, 두 목록 화면이 항상
// 같은 필터 UI를 쓰게 한다.
export function DateRangeQuickFilters({
  basePath,
  presets,
  monthButtons,
  from,
  to,
}: {
  basePath: string;
  presets: DatePreset[];
  monthButtons: DatePreset[];
  from: string | undefined;
  to: string | undefined;
}) {
  return (
    <>
      <div className="erp-date-presets" style={{ marginBottom: 4 }}>
        {presets.map((preset) => (
          <Link
            key={preset.label}
            href={`${basePath}?from=${preset.from}&to=${preset.to}`}
            className={`erp-date-preset-btn${from === preset.from && to === preset.to ? " active" : ""}`}
          >
            {preset.label}
          </Link>
        ))}
      </div>
      <div className="erp-date-presets" style={{ marginBottom: 8 }}>
        {monthButtons.map((preset) => (
          <Link
            key={preset.label}
            href={`${basePath}?from=${preset.from}&to=${preset.to}`}
            className={`erp-date-preset-btn${from === preset.from && to === preset.to ? " active" : ""}`}
          >
            {preset.label}
          </Link>
        ))}
      </div>
    </>
  );
}
