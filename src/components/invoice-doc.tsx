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

// 원본 엑셀(34개 열)의 실제 열 너비(문자 단위 * 7px)를 그대로 옮긴 값
const COL_WIDTHS = [
  18, 18, 18, 18, 18, 18, 18, 22, 18, 18, 22, 18, 18, 18, 18, 16, 23, 16, 16, 16, 16, 16, 16, 16,
  16, 46, 33, 16, 16, 11, 16, 18, 16, 30,
];

const ITEM_COLS = [2, 10, 3, 3, 4, 4, 4, 4] as const;

function Cell({
  as = "td",
  colSpan,
  rowSpan,
  className = "",
  children,
}: {
  as?: "td" | "th";
  colSpan?: number;
  rowSpan?: number;
  className?: string;
  children?: React.ReactNode;
}) {
  const Tag = as;
  return (
    <Tag
      colSpan={colSpan}
      rowSpan={rowSpan}
      className={`overflow-hidden text-ellipsis break-words border border-current px-[3px] py-[1px] text-left align-middle font-normal ${className}`}
    >
      {children}
    </Tag>
  );
}

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

  const minItemRows = 10;
  const blankCount = Math.max(0, minItemRows - items.length);

  return (
    <table
      className="table-fixed border-collapse text-[10px] leading-tight"
      style={{ color: COLOR_HEX[color], width: `${COL_WIDTHS.reduce((a, b) => a + b, 0)}px` }}
    >
      <colgroup>
        {COL_WIDTHS.map((w, i) => (
          <col key={i} style={{ width: `${w}px` }} />
        ))}
      </colgroup>
      <tbody>
        {/* excel row 2-3 */}
        <tr>
          <Cell colSpan={9} rowSpan={2} className="text-center text-[13px] font-bold tracking-[0.25em]">
            거래명세표
          </Cell>
          <Cell colSpan={4} rowSpan={2} className="text-center font-medium">
            ({copyLabel})
          </Cell>
          <Cell colSpan={2}>일자</Cell>
          <Cell colSpan={6}>{new Date(orderDate).toLocaleDateString("ko-KR")}</Cell>
          <Cell colSpan={2}>No.</Cell>
          <Cell colSpan={9}>{docNumber}</Cell>
          <Cell colSpan={2} className="text-center">
            1/1
          </Cell>
        </tr>
        <tr>
          <Cell colSpan={5}>공급자연락처</Cell>
          <Cell colSpan={16}>
            Tel. {company?.phone ?? "-"} &nbsp;Fax. {company?.fax_number ?? "-"}
          </Cell>
        </tr>

        {/* excel row 4 */}
        <tr>
          <Cell colSpan={4} as="th">
            공급자
          </Cell>
          <Cell colSpan={13}>{company?.business_number ?? "-"}</Cell>
          <Cell colSpan={1} rowSpan={3} as="th" className="text-center">
            공급받는자
          </Cell>
          <Cell colSpan={13} rowSpan={2} className="text-center font-semibold">
            {customerName}
          </Cell>
          <Cell colSpan={3} rowSpan={2} className="text-center">
            貴下
          </Cell>
        </tr>

        {/* excel row 5 */}
        <tr>
          <Cell as="th" colSpan={1}>
            상<br />호
          </Cell>
          <Cell colSpan={8}>{company?.name ?? "-"}</Cell>
          <Cell as="th" colSpan={1}>
            성<br />명
          </Cell>
          <Cell colSpan={5}>{company?.representative_name ?? "-"}</Cell>
          <Cell colSpan={2} className="text-center">
            (인)
          </Cell>
        </tr>

        {/* excel row 6 */}
        <tr>
          <Cell as="th" colSpan={1}>
            주<br />소
          </Cell>
          <Cell colSpan={16}>{company?.address ?? "-"}</Cell>
          <Cell colSpan={16} className="text-center opacity-80">
            거래해 주셔서 감사드립니다.
          </Cell>
        </tr>

        {/* excel row 7 */}
        <tr>
          <Cell as="th" colSpan={1}>
            업<br />태
          </Cell>
          <Cell colSpan={7}>{company?.business_type ?? "-"}</Cell>
          <Cell as="th" colSpan={1}>
            종<br />목
          </Cell>
          <Cell colSpan={8}>{company?.business_item ?? "-"}</Cell>
          <Cell as="th" colSpan={1}>
            비고
          </Cell>
          <Cell colSpan={9} />
          <Cell as="th" colSpan={3}>
            인수자
          </Cell>
          <Cell colSpan={4} />
        </tr>

        {/* excel row 8: item header */}
        <tr>
          <Cell as="th" colSpan={ITEM_COLS[0]} className="text-center">
            월일
          </Cell>
          <Cell as="th" colSpan={ITEM_COLS[1]} className="text-center">
            품명 / 규격
          </Cell>
          <Cell as="th" colSpan={ITEM_COLS[2]} className="text-center">
            단위
          </Cell>
          <Cell as="th" colSpan={ITEM_COLS[3]} className="text-center">
            수량
          </Cell>
          <Cell as="th" colSpan={ITEM_COLS[4]} className="text-center">
            단가
          </Cell>
          <Cell as="th" colSpan={ITEM_COLS[5]} className="text-center">
            공급가액
          </Cell>
          <Cell as="th" colSpan={ITEM_COLS[6]} className="text-center">
            세 액
          </Cell>
          <Cell as="th" colSpan={ITEM_COLS[7]} className="text-center">
            비고/합계
          </Cell>
        </tr>

        {items.map((item) => (
          <tr key={item.id}>
            <Cell colSpan={ITEM_COLS[0]} className="text-center">
              {item.monthDay}
            </Cell>
            <Cell colSpan={ITEM_COLS[1]}>{item.productLabel}</Cell>
            <Cell colSpan={ITEM_COLS[2]} className="text-center">
              {item.unit}
            </Cell>
            <Cell colSpan={ITEM_COLS[3]} className="text-right">
              {item.quantity.toLocaleString()}
            </Cell>
            <Cell colSpan={ITEM_COLS[4]} className="text-right">
              {item.unitPrice.toLocaleString()}
            </Cell>
            <Cell colSpan={ITEM_COLS[5]} className="text-right">
              {item.supplyAmount.toLocaleString()}
            </Cell>
            <Cell colSpan={ITEM_COLS[6]} className="text-right">
              {item.taxAmount.toLocaleString()}
            </Cell>
            <Cell colSpan={ITEM_COLS[7]} />
          </tr>
        ))}
        {Array.from({ length: blankCount }).map((_, i) => (
          <tr key={`blank-${i}`}>
            <Cell colSpan={ITEM_COLS[0]} />
            <Cell colSpan={ITEM_COLS[1]} className="text-center opacity-60">
              {i === 0 ? "=이하여백=" : ""}
            </Cell>
            <Cell colSpan={ITEM_COLS[2]} />
            <Cell colSpan={ITEM_COLS[3]} />
            <Cell colSpan={ITEM_COLS[4]} />
            <Cell colSpan={ITEM_COLS[5]} />
            <Cell colSpan={ITEM_COLS[6]} />
            <Cell colSpan={ITEM_COLS[7]} />
          </tr>
        ))}

        {/* 합계 */}
        <tr>
          <Cell colSpan={2} className="font-semibold">
            합계
          </Cell>
          <Cell colSpan={5} className="text-right font-semibold">
            {grandTotal.toLocaleString()}
          </Cell>
          <Cell colSpan={5} className="text-right font-semibold">
            {supplyTotal.toLocaleString()}
          </Cell>
          <Cell colSpan={6} className="text-right font-semibold">
            {taxTotal.toLocaleString()}
          </Cell>
          <Cell colSpan={16} />
        </tr>
        {/* 메모 */}
        <tr>
          <Cell colSpan={2}>메모</Cell>
          <Cell colSpan={23} className="opacity-80">
            {memo || ""}
          </Cell>
          <Cell colSpan={9} />
        </tr>
      </tbody>
    </table>
  );
}
