import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ListPageHeader } from "@/components/erp/page-header";
import { PageGuide } from "@/components/erp/page-guide";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { currentMonthRange } from "@/lib/xlsx-response";
import { fetchHometaxBulkExportData, classifyAndBuildRows, HOMETAX_BULK_EXCEL_HEADERS } from "@/lib/hometax-bulk-export";
import { validateHometaxRow } from "@/lib/hometax-bulk-export-rules";
import { formatNumber } from "@/lib/format-number";

const INVOICE_TYPE_LABEL: Record<string, string> = {
  consignment: "위수탁",
  consignment_zero_rate: "위수탁영세",
};

export default async function TaxInvoiceExportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; summarize?: string }>;
}) {
  const { from: defaultFrom, to: defaultTo } = currentMonthRange();
  const { from: fromParam, to: toParam, summarize: summarizeParam } = await searchParams;
  const from = fromParam || defaultFrom;
  const to = toParam || defaultTo;
  const summarize = summarizeParam !== "0";

  const supabase = await createClient();
  const { supplier, eligible, ineligibleByType } = await fetchHometaxBulkExportData(supabase, from, to);
  const { rows, excluded } = classifyAndBuildRows(eligible, supplier, summarize);

  // classifyAndBuildRows가 건너뛰는 건(품목 4개 초과 + 자동요약 꺼짐)만
  // 빼면 eligible과 rows는 같은 순서로 1:1 대응한다 — 어느 매출 건이
  // 형식 규칙을 어겼는지 알려주려고 같은 기준으로 다시 짝지어둔다.
  const includedInvoices = eligible.filter((inv) => inv.items.length <= 4 || summarize);
  const formatIssues = rows
    .map((row, i) => ({ invoice: includedInvoices[i], errors: validateHometaxRow(HOMETAX_BULK_EXCEL_HEADERS, row) }))
    .filter((r) => r.errors.length > 0);

  const overCapCount = eligible.filter((inv) => inv.items.length > 4).length;
  const downloadParams = new URLSearchParams({ from, to, summarize: summarize ? "1" : "0" });
  const downloadHref = `/api/sales/tax-invoice-export?${downloadParams.toString()}`;

  const toggleParams = new URLSearchParams({ from, to, summarize: summarize ? "0" : "1" });

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/sales" } }} />
      <ListPageHeader title="매출관리 > 홈택스 일괄발급 엑셀" />

      <PageGuide>
        국세청 홈택스 [전자(세금)계산서 발급 &gt; 일괄발급(100건 이하)] 메뉴에 그대로 업로드할 수 있는 엑셀을 만듭니다.
        일반/영세율 세금계산서만 대상이며(위수탁 계열은 이 양식에 칸이 없어 제외), 품목이 4개를 넘는 건은 아래 설정에 따라
        자동 요약되거나 목록에서 제외됩니다. 생성될 각 행은 공식 양식의 형식 규칙(등록번호 자릿수, 글자수 제한, 날짜 형식 등)에
        맞는지 미리 검사하며, 문제가 있으면 다운로드 전에 아래에 보여드립니다(다만 이 검사를 통과해도 국세청 서버가 또 다른
        이유로 거부할 가능성까지 없애주지는 못합니다). 엑셀을 받은 뒤 홈택스에 로그인해서 직접 업로드/발급까지 진행해주세요
        (여기서 국세청으로 바로 전송하지는 않습니다).
      </PageGuide>

      <form method="get" className="erp-search">
        <div className="erp-field">
          <label htmlFor="export-from">시작일</label>
          <input id="export-from" type="date" name="from" defaultValue={from} className="erp-input" />
        </div>
        <div className="erp-field">
          <label htmlFor="export-to">종료일</label>
          <input id="export-to" type="date" name="to" defaultValue={to} className="erp-input" />
        </div>
        <input type="hidden" name="summarize" value={summarize ? "1" : "0"} />
        <button type="submit" className="erp-btn erp-btn-primary">
          F5 조회
        </button>
      </form>

      <div className="erp-toolbar">
        <Link href={`?${toggleParams.toString()}`} className="erp-btn">
          {summarize ? "✓ 품목 5개 이상 건 자동 요약 (켜짐)" : "품목 5개 이상 건 자동 요약 (꺼짐)"}
        </Link>
        <a href={downloadHref} className="erp-btn erp-btn-primary">
          📥 엑셀 다운로드 ({formatNumber(rows.length)}건)
        </a>
      </div>

      {formatIssues.length > 0 && (
        <div className="erp-detail" style={{ marginTop: 0 }}>
          <div className="erp-detail-tabs">
            <span className="erp-detail-tab active">⚠ 양식 형식 오류 — 다운로드 전 확인 필요 ({formatIssues.length}건)</span>
          </div>
          <div className="erp-detail-body" style={{ fontSize: 12.5, display: "flex", flexDirection: "column", gap: 6 }}>
            {formatIssues.map(({ invoice, errors }) => (
              <div key={invoice.salesOrderId} style={{ borderBottom: "1px solid var(--erp-border)", paddingBottom: 6 }}>
                <div className="flex flex-wrap items-center gap-2">
                  <span style={{ color: "var(--erp-text-muted)" }}>{invoice.issueDate}</span>
                  <span>{invoice.customerName}</span>
                  <Link href={`/sales/${invoice.salesOrderId}/tax-invoice`} className="erp-btn" style={{ minWidth: 0, height: 22, padding: "0 8px", fontSize: 11 }}>
                    매출 건 보기
                  </Link>
                </div>
                <ul style={{ marginTop: 4, paddingLeft: 16, color: "var(--erp-danger)" }}>
                  {errors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {(excluded.length > 0 || ineligibleByType.length > 0) && (
        <div className="erp-detail" style={{ marginTop: 0 }}>
          <div className="erp-detail-tabs">
            <span className="erp-detail-tab active">
              일괄발급 제외 — 직접 처리 필요 ({excluded.length + ineligibleByType.length}건)
            </span>
          </div>
          <div className="erp-detail-body" style={{ fontSize: 12.5, display: "flex", flexDirection: "column", gap: 6 }}>
            {excluded.map((inv) => (
              <div key={inv.salesOrderId} className="flex flex-wrap items-center gap-2">
                <span style={{ color: "var(--erp-text-muted)" }}>{inv.issueDate}</span>
                <span>{inv.customerName}</span>
                <span style={{ color: "var(--erp-danger)" }}>품목 {inv.items.length}개 (4개 초과, 자동 요약 꺼짐)</span>
                <Link href={`/sales/${inv.salesOrderId}/tax-invoice`} className="erp-btn" style={{ minWidth: 0, height: 22, padding: "0 8px", fontSize: 11 }}>
                  매출 건 보기
                </Link>
              </div>
            ))}
            {ineligibleByType.map((inv) => (
              <div key={inv.salesOrderId} className="flex flex-wrap items-center gap-2">
                <span style={{ color: "var(--erp-text-muted)" }}>{inv.issueDate}</span>
                <span>{inv.customerName}</span>
                <span style={{ color: "var(--erp-danger)" }}>
                  {INVOICE_TYPE_LABEL[inv.invoiceType] ?? inv.invoiceType} — 이 양식에 없는 종류, 홈택스 건별입력 필요
                </span>
                <Link href={`/sales/${inv.salesOrderId}/tax-invoice`} className="erp-btn" style={{ minWidth: 0, height: 22, padding: "0 8px", fontSize: 11 }}>
                  매출 건 보기
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs" style={{ color: "var(--erp-text-muted)", marginTop: 14 }}>
        기간 내 발행된 세금계산서 총 {formatNumber(eligible.length + ineligibleByType.length)}건 — 일괄발급 대상{" "}
        {formatNumber(eligible.length)}건 중 품목 4개 초과 {formatNumber(overCapCount)}건
        {summarize ? "(자동 요약 적용됨)" : "(제외됨)"}, 위수탁 계열 {formatNumber(ineligibleByType.length)}건 제외.
      </p>
    </div>
  );
}
