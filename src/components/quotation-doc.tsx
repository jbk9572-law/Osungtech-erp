import { calcVat } from "@/lib/tax";

type Company = {
  name: string;
  business_number: string | null;
  representative_name: string | null;
  phone: string | null;
  fax_number: string | null;
  business_type: string | null;
  business_item: string | null;
  address: string | null;
  seal_image_url?: string | null;
} | null;

type Customer = {
  name: string;
  contact_name: string | null;
  phone: string | null;
  address: string | null;
} | null;

export type QuotationItem = {
  id: string;
  productLabel: string;
  spec: string;
  quantity: number;
  unitPrice: number;
  remark?: string | null;
};

// 외부 거래처에 실제로 보내는 견적서 서식. 지금까지 견적서관리는 화면
// 안에서만 그리드로 보여줬는데(우리끼리 적고 끝) — 이 문서를 인쇄/PDF로
// 뽑아야 비로소 "거래처에 보내는 견적서"로서 의미가 생긴다. 매출
// 명세표(DeliveryNoteDoc/InvoicePage)와 달리 공급받는자 서명란이나
// 이중 사본 개념은 없고, 대신 견적 유효기간이 핵심 정보다.
export function QuotationDoc({
  company,
  customer,
  docNumber,
  quoteDate,
  validUntil,
  items,
  memo,
}: {
  company: Company;
  customer: Customer;
  docNumber: string;
  quoteDate: string;
  validUntil: string | null;
  items: QuotationItem[];
  memo?: string | null;
}) {
  const rows = items.map((item) => {
    const supplyAmount = item.quantity * item.unitPrice;
    return { ...item, supplyAmount, taxAmount: calcVat(supplyAmount) };
  });
  const supplyTotal = rows.reduce((sum, r) => sum + r.supplyAmount, 0);
  const taxTotal = rows.reduce((sum, r) => sum + r.taxAmount, 0);
  const grandTotal = supplyTotal + taxTotal;
  const blankRows = Math.max(0, 12 - rows.length);

  return (
    <div className="border border-black text-[12px] text-black">
      <div className="flex flex-col items-center gap-1 border-b border-black px-3 py-4">
        <span className="text-xl font-bold tracking-[0.5em]">견 적 서</span>
        <span className="text-xs text-gray-600">문서번호 {docNumber}</span>
      </div>

      <table className="w-full border-collapse">
        <tbody>
          <tr>
            <th className="w-24 border border-black bg-gray-50 px-2 py-1 font-medium">수신</th>
            <td className="border border-black px-2 py-1" colSpan={3}>
              {customer?.name ?? "-"} 귀하
            </td>
            <th className="w-20 border border-black bg-gray-50 px-2 py-1 font-medium">견적일자</th>
            <td className="border border-black px-2 py-1">{new Date(quoteDate).toLocaleDateString("ko-KR")}</td>
          </tr>
          <tr>
            <th className="border border-black bg-gray-50 px-2 py-1 font-medium">담당자</th>
            <td className="border border-black px-2 py-1" colSpan={3}>
              {customer?.contact_name ?? "-"}
              {customer?.phone ? ` (${customer.phone})` : ""}
            </td>
            <th className="border border-black bg-gray-50 px-2 py-1 font-medium">유효기간</th>
            <td className="border border-black px-2 py-1">
              {validUntil ? `~${new Date(validUntil).toLocaleDateString("ko-KR")}` : "-"}
            </td>
          </tr>
          <tr>
            <th className="border border-black bg-gray-50 px-2 py-1 font-medium">등록번호</th>
            <td className="border border-black px-2 py-1" colSpan={3}>
              {company?.business_number ?? "-"}
            </td>
            <th rowSpan={3} className="border border-black bg-gray-50 px-2 py-1 font-medium align-top">
              공급자
            </th>
            <td rowSpan={3} className="border border-black px-2 py-1 align-top">
              <div>{company?.name ?? "-"}</div>
              <div>대표자 {company?.representative_name ?? "-"}</div>
              {company?.phone && <div>Tel {company.phone}</div>}
            </td>
          </tr>
          <tr>
            <th className="border border-black bg-gray-50 px-2 py-1 font-medium">업태 / 종목</th>
            <td className="border border-black px-2 py-1" colSpan={3}>
              {company?.business_type ?? "-"} / {company?.business_item ?? "-"}
            </td>
          </tr>
          <tr>
            <th className="border border-black bg-gray-50 px-2 py-1 font-medium">주소</th>
            <td className="border border-black px-2 py-1" colSpan={3}>
              {company?.address ?? "-"}
            </td>
          </tr>
        </tbody>
      </table>

      <div className="border-t border-black px-3 py-2 text-center text-sm font-semibold">
        아래와 같이 견적합니다. (합계금액: {grandTotal.toLocaleString()}원, 부가세 포함)
      </div>

      <table className="w-full table-fixed border-collapse">
        <thead>
          <tr className="bg-gray-50">
            <th className="border border-black px-2 py-1.5 font-medium" style={{ width: "28%" }}>
              품명
            </th>
            <th className="border border-black px-2 py-1.5 font-medium" style={{ width: "16%" }}>
              규격
            </th>
            <th className="border border-black px-2 py-1.5 font-medium" style={{ width: "8%" }}>
              수량
            </th>
            <th className="border border-black px-2 py-1.5 font-medium" style={{ width: "12%" }}>
              단가
            </th>
            <th className="border border-black px-2 py-1.5 font-medium" style={{ width: "14%" }}>
              공급가액
            </th>
            <th className="border border-black px-2 py-1.5 font-medium" style={{ width: "10%" }}>
              부가세
            </th>
            <th className="border border-black px-2 py-1.5 font-medium" style={{ width: "12%" }}>
              비고
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={row.id}>
              <td className="border border-black px-2 py-1">{row.productLabel}</td>
              <td className="border border-black px-2 py-1 text-center">{row.spec || "-"}</td>
              <td className="border border-black px-2 py-1 text-right">{row.quantity.toLocaleString()}</td>
              <td className="border border-black px-2 py-1 text-right">{row.unitPrice.toLocaleString()}</td>
              <td className="border border-black px-2 py-1 text-right">{row.supplyAmount.toLocaleString()}</td>
              <td className="border border-black px-2 py-1 text-right">{row.taxAmount.toLocaleString()}</td>
              <td className="border border-black px-2 py-1 whitespace-pre-line">
                {idx === 0 ? [memo, row.remark].filter(Boolean).join("\n") : row.remark ?? ""}
              </td>
            </tr>
          ))}
          {Array.from({ length: blankRows }).map((_, i) => (
            <tr key={`blank-${i}`}>
              <td className="border border-black px-2 py-1">&nbsp;</td>
              <td className="border border-black px-2 py-1" />
              <td className="border border-black px-2 py-1" />
              <td className="border border-black px-2 py-1" />
              <td className="border border-black px-2 py-1" />
              <td className="border border-black px-2 py-1" />
              <td className="border border-black px-2 py-1" />
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-gray-50 font-semibold">
            <td className="border border-black px-2 py-1.5 text-right" colSpan={4}>
              합계
            </td>
            <td className="border border-black px-2 py-1.5 text-right">{supplyTotal.toLocaleString()}</td>
            <td className="border border-black px-2 py-1.5 text-right">{taxTotal.toLocaleString()}</td>
            <td className="border border-black px-2 py-1.5" />
          </tr>
        </tfoot>
      </table>

      <div className="relative flex items-center gap-2 border-t border-black px-3 py-4 text-sm">
        <span>공급자</span>
        <span className="text-xs text-gray-700">{company?.name ?? "-"}</span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={company?.seal_image_url || "/branding/sample-company-seal.png"}
          alt=""
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-10 h-10 w-10 -translate-y-1/2 opacity-90 mix-blend-multiply"
        />
        <span className="ml-auto">(인)</span>
      </div>
    </div>
  );
}
