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
  logo_wordmark_url?: string | null;
} | null;

export type DeliveryNoteVariant = "sns_pheeltech" | "zenith_tech" | "kt_solution" | null;

type Item = {
  id: string;
  category: string;
  productName: string;
  spec: string;
  sku: string;
  unit: string;
  quantity: number;
};

type DisplayRow = {
  key: string;
  category: string;
  spec: string;
  sku: string;
  unit: string;
  quantity: number | null;
};

// 업체별 실제 출고증 3종(에스엔에스필텍/제니스테크/케이이티솔루션) 벡터 실측 기준:
// 품목 영역은 항상 5개 구역(대분류 | 규격 | B | C | 비고)으로 나뉘고,
// 업체마다 B/C 구역에 들어가는 라벨과 값만 다르다.
const ITEM_ZONE_WIDTHS = {
  category: 17.89,
  spec: 26.08,
  b: 23.66,
  c: 15.96,
  remark: 16.41,
} as const;

type ZoneConfig = {
  bLabel: string;
  cLabel: string;
  cellB: (row: DisplayRow) => string;
  cellC: (row: DisplayRow) => string;
  totalZone: "b" | "c";
};

const VARIANT_CONFIG: Record<Exclude<DeliveryNoteVariant, null>, ZoneConfig> = {
  sns_pheeltech: {
    bLabel: "수량 (box)",
    cLabel: "",
    cellB: (row) => (row.quantity != null ? `${row.quantity.toLocaleString()}${row.unit ? ` ${row.unit}` : ""}` : ""),
    cellC: () => "",
    totalZone: "b",
  },
  zenith_tech: {
    bLabel: "단위",
    cLabel: "합계 (Ea)",
    cellB: (row) => row.unit,
    cellC: (row) => (row.quantity != null ? row.quantity.toLocaleString() : ""),
    totalZone: "c",
  },
  kt_solution: {
    bLabel: "관리번호",
    cLabel: "수량",
    cellB: (row) => row.sku,
    cellC: (row) => (row.quantity != null ? `${row.quantity.toLocaleString()}${row.unit ? ` ${row.unit}` : ""}` : ""),
    totalZone: "c",
  },
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
  variant = null,
}: {
  company: Company;
  customerName: string;
  customerAddress: string | null;
  customerContactName?: string | null;
  customerContactPhone?: string | null;
  orderDate: string;
  items: Item[];
  note?: string | null;
  variant?: DeliveryNoteVariant;
}) {
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const blankRows = Math.max(0, 20 - items.length);
  const zone = variant ? VARIANT_CONFIG[variant] : null;

  const displayRows: DisplayRow[] = [
    ...items.map((item) => ({
      key: item.id,
      category: item.category,
      spec: item.spec,
      sku: item.sku,
      unit: item.unit,
      quantity: item.quantity,
    })),
    ...Array.from({ length: blankRows }).map((_, i) => ({
      key: `blank-${i}`,
      category: items[items.length - 1]?.category ?? "",
      spec: "",
      sku: "",
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
            <th rowSpan={4} className="w-14 border border-black bg-gray-50 px-2 py-1 font-medium align-top">
              주소
            </th>
            <td rowSpan={4} className="border border-black px-2 py-1 align-top">
              <div>{customerAddress ?? "-"}</div>
              <div className="mt-2">
                담당자 &nbsp;
                {customerContactPhone && <>Tel : {customerContactPhone} &nbsp;&nbsp;</>}
                {customerContactName ?? ""}
              </div>
            </td>
          </tr>
          <tr>
            <th className="border border-black bg-gray-50 px-2 py-1 font-medium">공급자</th>
            <td className="border border-black px-2 py-1" colSpan={3}>
              {company?.name ?? "-"} &nbsp;&nbsp;성명 {company?.representative_name ?? "-"}
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

      <table className="w-full border-collapse table-fixed">
        <thead>
          <tr className="bg-gray-50">
            <th className="border border-black px-2 py-1.5 font-medium" style={{ width: `${ITEM_ZONE_WIDTHS.category}%` }}>
              품명
            </th>
            <th className="border border-black px-2 py-1.5 font-medium" style={{ width: `${ITEM_ZONE_WIDTHS.spec}%` }}>
              규격
            </th>
            <th className="border border-black px-2 py-1.5 font-medium" style={{ width: `${ITEM_ZONE_WIDTHS.b}%` }}>
              {zone ? zone.bLabel : "수량"}
            </th>
            <th className="border border-black px-2 py-1.5 font-medium" style={{ width: `${ITEM_ZONE_WIDTHS.c}%` }}>
              {zone ? zone.cLabel : ""}
            </th>
            <th className="border border-black px-2 py-1.5 font-medium" style={{ width: `${ITEM_ZONE_WIDTHS.remark}%` }}>
              비고
            </th>
          </tr>
        </thead>
        <tbody>
          {displayRows.map((row, idx) => (
            <tr key={row.key}>
              {rowSpans[idx] > 0 && (
                <td rowSpan={rowSpans[idx]} className="border border-black px-2 py-1 text-center align-top">
                  {row.category}
                </td>
              )}
              <td className="border border-black px-2 py-1">{row.spec}</td>
              <td className="border border-black px-2 py-1 text-center">
                {zone ? zone.cellB(row) : row.unit}
              </td>
              <td className="border border-black px-2 py-1 text-right">
                {zone ? zone.cellC(row) : row.quantity != null ? row.quantity.toLocaleString() : ""}
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
            <td className="border border-black px-2 py-1.5" colSpan={2}>
              합계
            </td>
            <td className="border border-black px-2 py-1.5 text-right">
              {(!zone || zone.totalZone === "b") ? totalQuantity.toLocaleString() : ""}
            </td>
            <td className="border border-black px-2 py-1.5 text-right">
              {zone?.totalZone === "c" ? totalQuantity.toLocaleString() : ""}
            </td>
            <td className="border border-black px-2 py-1.5" />
          </tr>
        </tfoot>
      </table>

      <div className="flex items-center justify-around border-t border-black px-3 py-4 text-sm">
        <span className="relative">
          공급자 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;(인)
          {company?.logo_wordmark_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={company.logo_wordmark_url}
              alt=""
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-0 h-4 w-auto -translate-y-1/2 opacity-90"
            />
          )}
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
