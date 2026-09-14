import Link from "next/link";
import type { DatePreset } from "@/lib/date-presets";

// 매출/매입 목록 상단의 조회기간 바로가기 — 프리셋(오늘/어제/이번주/지난주)과
// 1월~12월 월별 버튼을 한 줄에 같이 묶어서, 두 목록 화면이 항상 같은 필터
// UI를 쓰게 한다. 예전엔 이번달/지난달/올해/작년까지 포함한 프리셋 줄과
// 월별 버튼 줄을 따로 두었는데, 월별 버튼이 이미 그 기능을 다 포함해서
// 줄만 두 개로 늘어질 뿐이었다 — 겹치지 않는 프리셋만 남겨 한 줄로 합친다.
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
    <div className="erp-date-presets" style={{ marginBottom: 8 }}>
      {[...presets, ...monthButtons].map((preset) => (
        <Link
          key={preset.label}
          href={`${basePath}?from=${preset.from}&to=${preset.to}`}
          className={`erp-date-preset-btn${from === preset.from && to === preset.to ? " active" : ""}`}
        >
          {preset.label}
        </Link>
      ))}
    </div>
  );
}
