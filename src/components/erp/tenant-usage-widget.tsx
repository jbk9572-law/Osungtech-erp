import { UsageBar, type UsageRow } from "@/components/erp/usage-widget";

// usage-widget.tsx(플랫폼 전체 인프라 현황 — Supabase/Netlify/VPS 무료
// 플랜 소진율, 플랫폼 운영자 전용)와 생김새는 같은 도넛 막대를 재사용
// 하지만 완전히 다른 데이터를 보여준다: 이건 "이 회사가 자기 요금제
// 용량을 얼마나 썼는지"라서 고객(테넌트 관리자)에게 그대로 보여준다.
// 그래서 note에 "무료플랜" 같은 내부 인프라 사정을 노출하지 않고
// "Standard 요금제"처럼 고객이 실제로 계약한 상품명을 보여준다.
export function TenantUsageWidget({
  dbBytesUsed,
  dbQuotaBytes,
  fileBytesUsed,
  fileQuotaBytes,
  planLabel,
}: {
  dbBytesUsed: number;
  dbQuotaBytes: number;
  fileBytesUsed: number;
  fileQuotaBytes: number;
  planLabel: string;
}) {
  const rows: UsageRow[] = [
    { kind: "bar", label: "DB 용량", usedBytes: dbBytesUsed, limitBytes: dbQuotaBytes, note: planLabel },
    { kind: "bar", label: "파일 저장소", usedBytes: fileBytesUsed, limitBytes: fileQuotaBytes, note: planLabel },
  ];

  return (
    <div className="erp-tree-usage">
      {rows.map((row) => (
        <UsageBar key={row.label} {...row} />
      ))}
    </div>
  );
}
