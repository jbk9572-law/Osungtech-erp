import Link from "next/link";
import type { DatePreset } from "@/lib/date-presets";

// 매출/매입 목록 상단의 조회기간 바로가기 — 프리셋(오늘/어제/이번주/지난주)과
// 1월~12월 월별 버튼을 한 줄에 같이 묶어서, 두 목록 화면이 항상 같은 필터
// UI를 쓰게 한다. 예전엔 이번달/지난달/올해/작년까지 포함한 프리셋 줄과
// 월별 버튼 줄을 따로 두었는데, 월별 버튼이 이미 그 기능을 다 포함해서
// 줄만 두 개로 늘어질 뿐이었다 — 겹치지 않는 프리셋만 남겨 한 줄로 합친다.
//
// prefetch={false}: 이 줄엔 평균 16개(프리셋 4 + 월별 12)의 Link가 한
// 화면에 동시에 뜬다. Next.js Link는 기본적으로 화면에 보이는 순간
// 전부 백그라운드로 미리 불러오는데(RSC prefetch), 이 화면 하나를 열 때
// 마다 16개짜리 요청 폭주가 서버로 나가고 있었다 — Cloudflare 운영 로그
// 실시간 확인 중 "로그아웃 한 번 눌렀는데 /sales에 날짜 범위가 전부 다른
// 요청이 동시에 쏟아진다"는 제보로 발견. 사용자는 이 중 하나만 클릭할
// 뿐이라 나머지 15개는 순수 낭비고, 특히 세션이 막 만료된 직후(로그아웃
// 직후 등)엔 이 전부가 /login 리다이렉트까지 거쳐야 해서 지연을 키운다.
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
          prefetch={false}
          className={`erp-date-preset-btn${from === preset.from && to === preset.to ? " active" : ""}`}
        >
          {preset.label}
        </Link>
      ))}
    </div>
  );
}
