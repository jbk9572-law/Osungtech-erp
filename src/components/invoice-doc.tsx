type Company = {
  name: string;
  business_number: string | null;
  representative_name: string | null;
  phone: string | null;
  fax_number: string | null;
  business_type: string | null;
  business_item: string | null;
  address: string | null;
  email: string | null;
  greeting_message: string | null;
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

// 원본 엑셀(34개 열)의 실제 열 너비 비율을 그대로 유지한 채 %로 변환한 값.
// 고정 px가 아니라 %로 두어야 인쇄 시 A4 용지 폭을 실제로 꽉 채운다.
const COL_WIDTHS = [
  3.2821, 3.2821, 2.7821, 2.7821, 2.7821, 2.7821, 2.7821, 3.4003, 2.7821, 2.7821, 3.4003, 2.7821,
  2.7821, 2.7821, 2.7821, 2.473, 3.5549, 2.473, 2.473, 2.473, 2.473, 2.473, 2.473, 2.473, 2.473,
  6.1097, 5.1005, 2.473, 2.473, 1.7002, 2.473, 2.7821, 2.473, 4.6368,
];

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

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
      className={`overflow-hidden text-ellipsis break-words border border-current px-[5px] py-[1.5px] text-left align-middle font-normal ${className}`}
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
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const supplyTotal = items.reduce((sum, item) => sum + item.supplyAmount, 0);
  const taxTotal = items.reduce((sum, item) => sum + item.taxAmount, 0);
  const grandTotal = supplyTotal + taxTotal;

  const minItemRows = 10;
  const blankCount = Math.max(0, minItemRows - items.length);
  const colorStyle = { color: COLOR_HEX[color] };
  const tint = color === "blue" ? "rgba(0,0,255,0.08)" : "rgba(255,0,0,0.08)";
  const stripe = (rowIndex: number) => (rowIndex % 2 === 0 ? { backgroundColor: tint } : undefined);

  return (
    <div className="break-inside-avoid" style={colorStyle}>
      <table className="w-full table-fixed border-collapse text-[12px] leading-tight">
        <colgroup>
          {COL_WIDTHS.map((w, i) => (
            <col key={i} style={{ width: `${w}%` }} />
          ))}
        </colgroup>
        <tbody>
          {/* title row */}
          <tr>
            <Cell colSpan={9} className="text-center text-[17px] font-bold tracking-[0.2em]">
              거래명세표
            </Cell>
            <Cell colSpan={4} className="text-center font-medium">
              ({copyLabel})
            </Cell>
            <Cell colSpan={2}>일자</Cell>
            <Cell colSpan={6}>{formatDate(orderDate)}</Cell>
            <Cell colSpan={2}>No.</Cell>
            <Cell colSpan={9}>{docNumber}</Cell>
            <Cell colSpan={2} className="text-center">
              1/1
            </Cell>
          </tr>

          {/* 공급자 / 종사업장 / 공급받는자 / 貴下 */}
          <tr>
            <Cell colSpan={4} as="th">
              공급자
            </Cell>
            <Cell colSpan={7}>{company?.business_number ?? "-"}</Cell>
            <Cell colSpan={3} as="th">
              종사업장
            </Cell>
            <Cell colSpan={3} />
            <Cell colSpan={1} rowSpan={2} as="th" className="text-center">
              공급받는자
            </Cell>
            <Cell colSpan={13} className="text-center font-semibold">
              {customerName}
            </Cell>
            <Cell colSpan={3} className="text-center">
              貴下
            </Cell>
          </tr>

          {/* 상호 / 성명 / 거래해주셔서 감사드립니다 */}
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
            <Cell colSpan={16} className="text-center opacity-80">
              거래해 주셔서 감사드립니다.
            </Cell>
          </tr>

          {/* 주소 */}
          <tr>
            <Cell as="th" colSpan={1}>
              주<br />소
            </Cell>
            <Cell colSpan={33}>{company?.address ?? "-"}</Cell>
          </tr>

          {/* 업태 / 종목 / 비고 / 인수자 */}
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

          {/* item header */}
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

          {items.map((item, i) => (
            <tr key={item.id} style={stripe(i)}>
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
            <tr key={`blank-${i}`} style={stripe(items.length + i)}>
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

          {/* 합계: "₩1,234원정 (수량 : x, 공급가 : y, 세액 : z)" 형태 */}
          <tr>
            <Cell colSpan={2} className="font-semibold">
              합계
            </Cell>
            <Cell colSpan={10} className="font-semibold">
              ₩{grandTotal.toLocaleString()}원정
            </Cell>
            <Cell colSpan={18} className="opacity-80">
              (수량 : {totalQuantity.toLocaleString()}, 공급가 : {supplyTotal.toLocaleString()},
              세액 : {taxTotal.toLocaleString()})
            </Cell>
            <Cell colSpan={4} as="th">
              전잔금
            </Cell>
          </tr>
          {/* 메모 */}
          <tr>
            <Cell colSpan={2}>메모</Cell>
            <Cell colSpan={28} className="opacity-80">
              {memo || ""}
            </Cell>
            <Cell colSpan={4} as="th">
              총잔금
            </Cell>
          </tr>
        </tbody>
      </table>

      <div className="flex w-full justify-between px-[5px] pt-[4px] text-[12px] opacity-90">
        <span>{company?.greeting_message || ""}</span>
        <span>
          From. ☎ {company?.phone ?? "-"} Fax {company?.fax_number ?? "-"}
          {company?.email ? ` ${company.email}` : ""}
        </span>
      </div>
    </div>
  );
}
