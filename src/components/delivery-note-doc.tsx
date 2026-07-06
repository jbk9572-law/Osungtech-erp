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
} | null;

type Item = {
  id: string;
  category: string;
  productName: string;
  unit: string;
  quantity: number;
};

export function DeliveryNoteDoc({
  company,
  customerName,
  customerAddress,
  orderDate,
  items,
}: {
  company: Company;
  customerName: string;
  customerAddress: string | null;
  orderDate: string;
  items: Item[];
}) {
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const blankRows = Math.max(0, 10 - items.length);

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
            <td className="border border-black px-2 py-1" colSpan={2} rowSpan={4} />
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
              &nbsp;&nbsp;담당자 {company?.manager_phone ?? "-"} {company?.manager_name ?? ""}
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
            <th className="w-20 border border-black px-2 py-1.5 font-medium">수량</th>
            <th className="w-24 border border-black px-2 py-1.5 font-medium">비고</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td className="border border-black px-2 py-1">{item.category}</td>
              <td className="border border-black px-2 py-1">{item.productName}</td>
              <td className="border border-black px-2 py-1 text-center">{item.unit}</td>
              <td className="border border-black px-2 py-1 text-right">
                {item.quantity.toLocaleString()}
              </td>
              <td className="border border-black px-2 py-1" />
            </tr>
          ))}
          {Array.from({ length: blankRows }).map((_, i) => (
            <tr key={`blank-${i}`}>
              <td className="border border-black px-2 py-1">&nbsp;</td>
              <td className="border border-black px-2 py-1" />
              <td className="border border-black px-2 py-1" />
              <td className="border border-black px-2 py-1" />
              <td className="border border-black px-2 py-1" />
            </tr>
          ))}
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
        <span>공급자 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;(인)</span>
        <span>인수자 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;(인)</span>
      </div>
    </div>
  );
}
