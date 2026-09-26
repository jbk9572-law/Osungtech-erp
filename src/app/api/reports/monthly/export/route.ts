import { buildXlsxResponse } from "@/lib/xlsx-response";
import { requireAuthedApiUser } from "@/lib/require-auth";
import { currentMonth } from "@/lib/date-presets";
import { fetchMonthlyReportData, type View } from "@/lib/monthly-report-data";

// 월별 리포트 엑셀 다운로드 — 화면(reports/monthly/page.tsx)과 완전히 같은
// 집계 로직(src/lib/monthly-report-data.ts)을 그대로 재사용해서, 화면에
// 보이는 숫자와 다운로드 파일의 숫자가 어긋나는 일이 없게 한다.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month") || currentMonth();
  const q = searchParams.get("q") || undefined;
  const viewParam = searchParams.get("view");
  const view: View = viewParam === "supplier" || viewParam === "customer" ? viewParam : "product";

  const { supabase, user } = await requireAuthedApiUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { itemGroups, supplierGroups, customerGroups } = await fetchMonthlyReportData(supabase, month, q, view);

  if (view === "product") {
    const rows = itemGroups.flatMap((g) => [
      {
        구분: "품목",
        SKU: g.sku,
        품목명: g.name,
        규격: g.spec,
        거래처: "",
        입고수량: g.inQty,
        입고금액: g.inAmount,
        출고수량: g.outQty,
        출고금액: g.outAmount,
        재고순증감: g.inQty - g.outQty,
      },
      ...g.details.map((d) => ({
        구분: d.type === "in" ? "입고처" : "출고처",
        SKU: "",
        품목명: "",
        규격: "",
        거래처: d.companyName,
        입고수량: d.type === "in" ? d.quantity : "",
        입고금액: d.type === "in" ? d.amount : "",
        출고수량: d.type === "out" ? d.quantity : "",
        출고금액: d.type === "out" ? d.amount : "",
        재고순증감: "",
      })),
    ]);
    return buildXlsxResponse(rows, `월별리포트_품목별_${month}.xlsx`);
  }

  const companyGroups = view === "supplier" ? supplierGroups : customerGroups;
  const companyLabel = view === "supplier" ? "매입처" : "매출처";
  const rows = companyGroups.flatMap((cg) => [
    {
      구분: companyLabel,
      [companyLabel]: cg.companyName,
      품목: "",
      규격: "",
      수량: cg.totalQuantity,
      전표수: cg.transactionCount,
      평균단가: "",
      금액: cg.totalAmount,
      세액: cg.totalTax,
    },
    ...cg.products.map((pg) => {
      const first = pg.items[0];
      return {
        구분: "품목",
        [companyLabel]: "",
        품목: first.productName,
        규격: first.spec !== "-" ? first.spec : "",
        수량: pg.totalQuantity,
        전표수: "",
        평균단가: Math.round(pg.avgUnitPrice),
        금액: pg.totalAmount,
        세액: pg.totalTax,
      };
    }),
  ]);
  return buildXlsxResponse(rows, `월별리포트_${companyLabel}별_${month}.xlsx`);
}
