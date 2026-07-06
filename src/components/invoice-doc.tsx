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

export function InvoiceDoc({
  copyLabel,
  company,
  customerName,
  orderDate,
  docNumber,
  items,
  memo,
}: {
  copyLabel: "공급받는자 보관용" | "공급자 보관용";
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
    <div className="border border-black text-[11.5px] text-black">
      <div className="flex items-baseline justify-between border-b border-black px-3 py-1.5">
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
            <th className="w-14 border border-black bg-gray-50 px-2 py-1 font-medium">공급자</th>
            <td className="border border-black px-2 py-1">{company?.business_number ?? "-"}</td>
            <th className="w-20 border border-black bg-gray-50 px-2 py-1 font-medium">
              공급받는자
            </th>
            <td className="border border-black px-2 py-1 font-semibold" colSpan={2}>
              {customerName} 貴下
            </td>
          </tr>
          <tr>
            <th className="border border-black bg-gray-50 px-2 py-1 font-medium">상호</th>
            <td className="border border-black px-2 py-1">
              {company?.name ?? "-"} &nbsp;&nbsp;성명 {company?.representative_name ?? "-"} (인)
            </td>
            <th className="border border-black bg-gray-50 px-2 py-1 font-medium">연락처</th>
            <td className="border border-black px-2 py-1" colSpan={2}>
              Tel. {company?.phone ?? "-"} &nbsp;Fax. {company?.fax_number ?? "-"}
            </td>
          </tr>
          <tr>
            <th className="border border-black bg-gray-50 px-2 py-1 font-medium">주소</th>
            <td className="border border-black px-2 py-1" colSpan={3}>
              {company?.address ?? "-"}
            </td>
            <td className="border border-black px-2 py-1 text-center text-gray-500" rowSpan={2}>
              거래해 주셔서
              <br />
              감사드립니다.
            </td>
          </tr>
          <tr>
            <th className="border border-black bg-gray-50 px-2 py-1 font-medium">업태 / 종목</th>
            <td className="border border-black px-2 py-1" colSpan={3}>
              {company?.business_type ?? "-"} / {company?.business_item ?? "-"}
            </td>
          </tr>
        </tbody>
      </table>

      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-50">
            <th className="w-14 border border-black px-1 py-1.5 font-medium">월일</th>
            <th className="border border-black px-2 py-1.5 font-medium">품명 / 규격</th>
            <th className="w-12 border border-black px-1 py-1.5 font-medium">단위</th>
            <th className="w-16 border border-black px-1 py-1.5 font-medium">수량</th>
            <th className="w-16 border border-black px-1 py-1.5 font-medium">단가</th>
            <th className="w-20 border border-black px-1 py-1.5 font-medium">공급가액</th>
            <th className="w-16 border border-black px-1 py-1.5 font-medium">세액</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td className="border border-black px-1 py-1 text-center">{item.monthDay}</td>
              <td className="border border-black px-2 py-1">{item.productLabel}</td>
              <td className="border border-black px-1 py-1 text-center">{item.unit}</td>
              <td className="border border-black px-1 py-1 text-right">
                {item.quantity.toLocaleString()}
              </td>
              <td className="border border-black px-1 py-1 text-right">
                {item.unitPrice.toLocaleString()}
              </td>
              <td className="border border-black px-1 py-1 text-right">
                {item.supplyAmount.toLocaleString()}
              </td>
              <td className="border border-black px-1 py-1 text-right">
                {item.taxAmount.toLocaleString()}
              </td>
            </tr>
          ))}
          {blankRows > 0 && (
            <tr>
              <td className="border border-black px-1 py-1" />
              <td className="border border-black px-2 py-1 text-center text-gray-400">
                =이하여백=
              </td>
              <td className="border border-black px-1 py-1" />
              <td className="border border-black px-1 py-1" />
              <td className="border border-black px-1 py-1" />
              <td className="border border-black px-1 py-1" />
              <td className="border border-black px-1 py-1" />
            </tr>
          )}
          {Array.from({ length: Math.max(0, blankRows - 1) }).map((_, i) => (
            <tr key={`blank-${i}`}>
              <td className="border border-black px-1 py-1">&nbsp;</td>
              <td className="border border-black px-1 py-1" />
              <td className="border border-black px-1 py-1" />
              <td className="border border-black px-1 py-1" />
              <td className="border border-black px-1 py-1" />
              <td className="border border-black px-1 py-1" />
              <td className="border border-black px-1 py-1" />
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-gray-50 font-semibold">
            <td className="border border-black px-2 py-1.5" colSpan={4}>
              합계 {grandTotal.toLocaleString()}
            </td>
            <td className="border border-black px-1 py-1.5" />
            <td className="border border-black px-1 py-1.5 text-right">
              {supplyTotal.toLocaleString()}
            </td>
            <td className="border border-black px-1 py-1.5 text-right">
              {taxTotal.toLocaleString()}
            </td>
          </tr>
          <tr>
            <td className="border border-black px-2 py-1 text-gray-500" colSpan={7}>
              메모: {memo || "-"}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
