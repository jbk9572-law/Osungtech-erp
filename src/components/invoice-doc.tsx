type Company = {
  name: string;
  business_number: string | null;
  representative_name: string | null;
  phone: string | null;
  fax_number: string | null;
  business_type: string | null;
  business_item: string | null;
  address: string | null;
} | null;

type Item = {
  id: string;
  monthDay: string;
  productLabel: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  supplyAmount: number;
  taxAmount: number;
};

const COLOR_HEX = {
  blue: "#0000FF",
  red: "#FF0000",
};

export function InvoiceDoc({
  copyLabel,
  color,
  company,
  customerName,
  orderDate,
  docNumber,
  items,
  memo,
}: {
  copyLabel: "공급받는자 보관용" | "공급자 보관용";
  color: "blue" | "red";
  company: Company;
  customerName: string;
  orderDate: string;
  docNumber: string;
  items: Item[];
  memo?: string | null;
}) {
  const supplyTotal = items.reduce((sum, item) => sum + item.supplyAmount, 0);
  const taxTotal = items.reduce((sum, item) => sum + item.taxAmount, 0);
  const grandTotal = supplyTotal + taxTotal;
  const blankRows = Math.max(0, 6 - items.length);

  return (
    <div
      className="border border-current text-[11.5px]"
      style={{ color: COLOR_HEX[color] }}
    >
      <div className="flex items-baseline justify-between border-b border-current px-3 py-1.5">
        <span className="text-base font-bold tracking-[0.3em]">거래명세표</span>
        <span className="text-xs font-medium">({copyLabel})</span>
        <span className="text-xs">
          일자 {new Date(orderDate).toLocaleDateString("ko-KR")} &nbsp;&nbsp;No. {docNumber}
          &nbsp;&nbsp;1/1
        </span>
      </div>

      <table className="w-full border-collapse">
        <tbody>
          <tr>
            <td className="border border-current px-2 py-1" colSpan={2} />
            <th className="w-24 border border-current px-2 py-1 font-medium">공급자연락처</th>
            <td className="border border-current px-2 py-1" colSpan={2}>
              Tel. {company?.phone ?? "-"} &nbsp;Fax. {company?.fax_number ?? "-"}
            </td>
          </tr>
          <tr>
            <th className="w-16 border border-current px-2 py-1 font-medium">공급자</th>
            <td className="border border-current px-2 py-1">{company?.business_number ?? "-"}</td>
            <th className="w-20 border border-current px-2 py-1 font-medium">공급받는자</th>
            <td className="border border-current px-2 py-1 font-semibold" colSpan={2}>
              {customerName} 貴下
            </td>
          </tr>
          <tr>
            <th className="border border-current px-2 py-1 font-medium">상호</th>
            <td className="border border-current px-2 py-1">{company?.name ?? "-"}</td>
            <th className="border border-current px-2 py-1 font-medium">성명</th>
            <td className="border border-current px-2 py-1">
              {company?.representative_name ?? "-"} &nbsp;(인)
            </td>
            <td className="border border-current px-2 py-1 text-center" rowSpan={2}>
              &nbsp;
            </td>
          </tr>
          <tr>
            <th className="border border-current px-2 py-1 font-medium">주소</th>
            <td className="border border-current px-2 py-1" colSpan={3}>
              {company?.address ?? "-"}
            </td>
          </tr>
          <tr>
            <td className="border border-current px-2 py-1 text-center opacity-80" colSpan={5}>
              거래해 주셔서 감사드립니다.
            </td>
          </tr>
          <tr>
            <th className="border border-current px-2 py-1 font-medium">업태</th>
            <td className="border border-current px-2 py-1">{company?.business_type ?? "-"}</td>
            <th className="border border-current px-2 py-1 font-medium">종목</th>
            <td className="border border-current px-2 py-1" colSpan={2}>
              {company?.business_item ?? "-"}
            </td>
          </tr>
          <tr>
            <th className="border border-current px-2 py-1 font-medium">비고</th>
            <td className="border border-current px-2 py-1" />
            <th className="border border-current px-2 py-1 font-medium">인수자</th>
            <td className="border border-current px-2 py-1" colSpan={2} />
          </tr>
        </tbody>
      </table>

      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="w-12 border border-current px-1 py-1.5 font-medium">월일</th>
            <th className="border border-current px-2 py-1.5 font-medium">품명 / 규격</th>
            <th className="w-10 border border-current px-1 py-1.5 font-medium">단위</th>
            <th className="w-14 border border-current px-1 py-1.5 font-medium">수량</th>
            <th className="w-14 border border-current px-1 py-1.5 font-medium">단가</th>
            <th className="w-20 border border-current px-1 py-1.5 font-medium">공급가액</th>
            <th className="w-16 border border-current px-1 py-1.5 font-medium">세액</th>
            <th className="w-14 border border-current px-1 py-1.5 font-medium">비고/합계</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td className="border border-current px-1 py-1 text-center">{item.monthDay}</td>
              <td className="border border-current px-2 py-1">{item.productLabel}</td>
              <td className="border border-current px-1 py-1 text-center">{item.unit}</td>
              <td className="border border-current px-1 py-1 text-right">
                {item.quantity.toLocaleString()}
              </td>
              <td className="border border-current px-1 py-1 text-right">
                {item.unitPrice.toLocaleString()}
              </td>
              <td className="border border-current px-1 py-1 text-right">
                {item.supplyAmount.toLocaleString()}
              </td>
              <td className="border border-current px-1 py-1 text-right">
                {item.taxAmount.toLocaleString()}
              </td>
              <td className="border border-current px-1 py-1" />
            </tr>
          ))}
          {blankRows > 0 && (
            <tr>
              <td className="border border-current px-1 py-1" />
              <td className="border border-current px-2 py-1 text-center opacity-70">
                =이하여백=
              </td>
              <td className="border border-current px-1 py-1" />
              <td className="border border-current px-1 py-1" />
              <td className="border border-current px-1 py-1" />
              <td className="border border-current px-1 py-1" />
              <td className="border border-current px-1 py-1" />
              <td className="border border-current px-1 py-1" />
            </tr>
          )}
          {Array.from({ length: Math.max(0, blankRows - 1) }).map((_, i) => (
            <tr key={`blank-${i}`}>
              <td className="border border-current px-1 py-1">&nbsp;</td>
              <td className="border border-current px-1 py-1" />
              <td className="border border-current px-1 py-1" />
              <td className="border border-current px-1 py-1" />
              <td className="border border-current px-1 py-1" />
              <td className="border border-current px-1 py-1" />
              <td className="border border-current px-1 py-1" />
              <td className="border border-current px-1 py-1" />
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-semibold">
            <td className="border border-current px-2 py-1.5" colSpan={4}>
              합계 {grandTotal.toLocaleString()}
            </td>
            <td className="border border-current px-1 py-1.5" />
            <td className="border border-current px-1 py-1.5 text-right">
              {supplyTotal.toLocaleString()}
            </td>
            <td className="border border-current px-1 py-1.5 text-right">
              {taxTotal.toLocaleString()}
            </td>
            <td className="border border-current px-1 py-1.5" />
          </tr>
          <tr>
            <td className="border border-current px-2 py-1 opacity-80" colSpan={8}>
              메모: {memo || "-"}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
