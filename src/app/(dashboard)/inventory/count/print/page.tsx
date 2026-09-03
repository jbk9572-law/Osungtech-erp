import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { PrintButton } from "@/components/print-button";
import { todayKstStr } from "@/lib/kst-date";

const cellStyle: React.CSSProperties = {
  border: "1px solid #000",
  padding: "5px 8px",
  fontSize: 12,
};

// 휴대폰 화면으로 246개 품목을 보면서 실사하기 어렵다는 요청 — 종이에
// 인쇄해서 창고를 돌며 손으로 적은 뒤, 나중에 화면에서 실사 수량 칸에
// 옮겨 적을 수 있게 하는 용도. 화면의 erp-grid 표를 그대로 인쇄하는
// 대신(회색 테두리가 인쇄에서 흐리게 나옴), 지급결의서 인쇄 양식과
// 같은 방식으로 검은 테두리 표를 따로 그린다 — "실사 수량"/"비고" 칸은
// 항상 빈 칸으로 둬서 손으로 적을 자리를 만든다.
export default async function InventoryCountPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ onlyNonZero?: string }>;
}) {
  const { onlyNonZero } = await searchParams;
  const supabase = await createClient();

  const products = await fetchAllRows<{
    id: string;
    sku: string;
    name: string;
    spec: string | null;
    unit: string;
    base_package_qty: number | null;
    inventory: { quantity: number }[];
  }>((from, to) =>
    supabase
      .from("products")
      .select("id, sku, name, spec, unit, base_package_qty, inventory(quantity)")
      .order("name")
      .range(from, to),
  );

  const rows = products
    .map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      spec: p.spec,
      unit: p.unit,
      basePackageQty: p.base_package_qty,
      systemQuantity: p.inventory?.[0]?.quantity ?? 0,
    }))
    .filter((r) => onlyNonZero !== "1" || r.systemQuantity !== 0);

  return (
    <div className="mx-auto print-page-margin" style={{ width: 780, maxWidth: "100%" }}>
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link href="/inventory/count" className="erp-btn erp-btn-danger">
          닫기
        </Link>
        <PrintButton />
      </div>

      <div className="mb-3 flex items-end justify-between" style={{ color: "#000" }}>
        <h1 style={{ fontSize: 18, fontWeight: 700 }}>재고 실사 목록</h1>
        <div style={{ fontSize: 12 }}>
          기준일 {todayKstStr()} · {rows.length.toLocaleString()}개 품목
          {onlyNonZero === "1" && " (전산 재고 0 제외)"}
        </div>
      </div>

      <table style={{ borderCollapse: "collapse", width: "100%", tableLayout: "fixed", color: "#000" }}>
        <colgroup>
          <col style={{ width: "13%" }} />
          <col style={{ width: "24%" }} />
          <col style={{ width: "13%" }} />
          <col style={{ width: "14%" }} />
          <col style={{ width: "12%" }} />
          <col style={{ width: "12%" }} />
          <col style={{ width: "12%" }} />
        </colgroup>
        <thead>
          <tr>
            <th style={cellStyle}>SKU</th>
            <th style={cellStyle}>품목명</th>
            <th style={cellStyle}>규격</th>
            <th style={cellStyle}>포장수량</th>
            <th style={cellStyle}>전산 재고</th>
            <th style={cellStyle}>실사 수량</th>
            <th style={cellStyle}>비고</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} style={{ breakInside: "avoid" }}>
              <td style={cellStyle}>{row.sku}</td>
              <td style={cellStyle}>{row.name}</td>
              <td style={cellStyle}>{row.spec || ""}</td>
              <td style={cellStyle}>
                {row.basePackageQty ? `${Number(row.basePackageQty).toLocaleString()}${row.unit ?? ""}/박스` : ""}
              </td>
              <td style={{ ...cellStyle, textAlign: "right" }}>
                {row.systemQuantity.toLocaleString()} {row.unit ?? ""}
              </td>
              <td style={{ ...cellStyle, height: 26 }} />
              <td style={{ ...cellStyle, height: 26 }} />
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td colSpan={7} style={{ ...cellStyle, textAlign: "center" }}>
                조건에 맞는 품목이 없습니다.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
