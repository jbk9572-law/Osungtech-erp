type Company = {
  name: string;
  business_number: string | null;
  representative_name: string | null;
  phone: string | null;
  fax_number: string | null;
  business_type: string | null;
  business_item: string | null;
  address: string | null;
  manager_name: string | null;
  manager_phone: string | null;
  seal_image_url?: string | null;
} | null;

type Item = {
  id: string;
  category: string;
  productName: string;
  unit: string;
  quantity: number;
};

type DisplayRow = {
  key: string;
  category: string;
  productName: string;
  unit: string;
  quantity: number | null;
};

export function DeliveryNoteDoc({
  company,
  customerName,
  customerAddress,
  customerContactName,
  customerContactPhone,
  orderDate,
  items,
  note,
}: {
  company: Company;
  customerName: string;
  customerAddress: string | null;
  customerContactName?: string | null;
  customerContactPhone?: string | null;
  orderDate: string;
  items: Item[];
  note?: string | null;
}) {
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const blankRows = Math.max(0, 20 - items.length);

  const displayRows: DisplayRow[] = [
    ...items.map((item) => ({
      key: item.id,
      category: item.category,
      productName: item.productName,
      unit: item.unit,
      quantity: item.quantity,
    })),
    ...Array.from({ length: blankRows }).map((_, i) => ({
      key: `blank-${i}`,
      category: items[items.length - 1]?.category ?? "",
      productName: "",
      unit: "",
      quantity: null,
    })),
  ];

  // 연속된 같은 품명(대분류)은 세로로 병합한다 (실제 거래명세표처럼 빈 줄까지 이어짐).
  const rowSpans: number[] = new Array(displayRows.length).fill(0);
  for (let i = 0; i < displayRows.length; ) {
    let j = i + 1;
    while (j < displayRows.length && displayRows[j].category === displayRows[i].category) j++;
    rowSpans[i] = j - i;
    i = j;
  }

  return (
    <div className="border border-black text-[12px] text-black">
      <div className="flex items-baseline justify-between border-b border-black px-3 py-2">
        <span className="text-lg font-bold tracking-[0.3em]">거래명세표 (출고)</span>
        <span className="text-sm font-semibold">{customerName} 귀하</span>
      </div>

      <table className="w-full border-collapse">
        <tbody>
          <tr>
            <th className="w-20 border border-black bg-gray-50 px-2 py-1 font-medium">등록번호</th>
            <td className="border border-black px-2 py-1" colSpan={3}>
              {company?.business_number ?? "-"}
            </td>
            <th className="w-14 border border-black bg-gray-50 px-2 py-1 font-medium">주소</th>
            <td className="border border-black px-2 py-1">{customerAddress ?? "-"}</td>
          </tr>
          <tr>
            <th className="border border-black bg-gray-50 px-2 py-1 font-medium">공급자</th>
            <td className="border border-black px-2 py-1" colSpan={3}>
              {company?.name ?? "-"} &nbsp;&nbsp;성명 {company?.representative_name ?? "-"}
            </td>
            <th rowSpan={3} className="border border-black bg-gray-50 px-2 py-1 font-medium align-top">
              담당자
            </th>
            <td rowSpan={3} className="border border-black px-2 py-1 align-top">
              {customerContactPhone && <div>Tel : {customerContactPhone}</div>}
              {customerContactName && <div>{customerContactName}</div>}
              {!customerContactPhone && !customerContactName && "-"}
            </td>
          </tr>
          <tr>
            <th className="border border-black bg-gray-50 px-2 py-1 font-medium">전화번호</th>
            <td className="border border-black px-2 py-1" colSpan={3}>
              {company?.phone ?? "-"} &nbsp;&nbsp;팩스번호 {company?.fax_number ?? "-"}
            </td>
          </tr>
          <tr>
            <th className="border border-black bg-gray-50 px-2 py-1 font-medium">업태</th>
            <td className="border border-black px-2 py-1" colSpan={3}>
              {company?.business_type ?? "-"} &nbsp;&nbsp;종목 {company?.business_item ?? "-"}
            </td>
          </tr>
          <tr>
            <th className="border border-black bg-gray-50 px-2 py-1 font-medium">사업장 주소</th>
            <td className="border border-black px-2 py-1" colSpan={3}>
              {company?.address ?? "-"}
            </td>
            <th className="border border-black bg-gray-50 px-2 py-1 font-medium">출고일</th>
            <td className="border border-black px-2 py-1">
              {new Date(orderDate).toLocaleDateString("ko-KR")}
            </td>
          </tr>
        </tbody>
      </table>

      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-50">
            <th className="border border-black px-2 py-1.5 font-medium">품명</th>
            <th className="border border-black px-2 py-1.5 font-medium">규격</th>
            <th className="w-16 border border-black px-2 py-1.5 font-medium">단위</th>
            <th className="w-20 border border-black px-2 py-1.5 font-medium">
              합계
              <br />
              (Ea)
            </th>
            <th className="w-24 border border-black px-2 py-1.5 font-medium">비고</th>
          </tr>
        </thead>
        <tbody>
          {displayRows.map((row, idx) => (
            <tr key={row.key}>
              {rowSpans[idx] > 0 && (
                <td
                  rowSpan={rowSpans[idx]}
                  className="border border-black px-2 py-1 text-center align-top"
                >
                  {row.category}
                </td>
              )}
              <td className="border border-black px-2 py-1">{row.productName}</td>
              <td className="border border-black px-2 py-1 text-center">{row.unit}</td>
              <td className="border border-black px-2 py-1 text-right">
                {row.quantity != null ? row.quantity.toLocaleString() : ""}
              </td>
              <td className="border border-black px-2 py-1" />
            </tr>
          ))}
          {note && (
            <tr>
              <td colSpan={5} className="border border-black px-2 py-1 text-[11px] text-gray-600">
                {note}
              </td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr className="bg-gray-50 font-semibold">
            <td className="border border-black px-2 py-1.5" colSpan={3}>
              합계
            </td>
            <td className="border border-black px-2 py-1.5 text-right">
              {totalQuantity.toLocaleString()}
            </td>
            <td className="border border-black px-2 py-1.5" />
          </tr>
        </tfoot>
      </table>

      <div className="flex items-center justify-around border-t border-black px-3 py-4 text-sm">
        <span className="relative">
          공급자 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;(인)
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={company?.seal_image_url || "/branding/company-seal.png"}
            alt=""
            aria-hidden
            className="pointer-events-none absolute top-1/2 right-2 h-10 w-10 -translate-y-1/2 opacity-90 mix-blend-multiply"
          />
        </span>
        <span>인수자 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;(인)</span>
      </div>
    </div>
  );
}
