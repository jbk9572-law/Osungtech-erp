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
  seal_image_url?: string | null;
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
// 품목 테이블의 모든 행(입력된 행/빈 행 포함)이 항상 같은 높이를 갖도록 고정.
// 비어 있는 셀은 내용이 없어 줄 높이가 생기지 않아 그냥 두면 입력된 행보다
// 얇게 찌그러지는 문제가 있어, 모든 품목 행에 동일한 높이를 강제로 지정한다.
const ITEM_ROW_HEIGHT = "h-[23px]";

// 라벨(th)은 가운데 정렬, 값(td)은 왼쪽 정렬이 기본값 (실제 인쇄본 기준).
// 숫자 열이나 특별히 가운데/왼쪽 정렬이 필요한 값은 align prop으로 개별 지정한다.
function Cell({
  as = "td",
  colSpan,
  rowSpan,
  className = "",
  wrap = false,
  align,
  children,
}: {
  as?: "td" | "th";
  colSpan?: number;
  rowSpan?: number;
  className?: string;
  wrap?: boolean;
  align?: "left" | "center" | "right";
  children?: React.ReactNode;
}) {
  const Tag = as;
  const resolvedAlign = align ?? (as === "th" ? "center" : "left");
  const alignClass =
    resolvedAlign === "center" ? "text-center" : resolvedAlign === "right" ? "text-right" : "text-left";
  return (
    <Tag
      colSpan={colSpan}
      rowSpan={rowSpan}
      className={`overflow-hidden border border-current px-[4px] py-[2.5px] ${alignClass} align-middle font-normal ${wrap ? "whitespace-normal break-words text-clip" : "whitespace-nowrap text-ellipsis"} ${className}`}
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
      <table className="w-full table-fixed border-collapse text-[13px] leading-tight">
        <colgroup>
          {COL_WIDTHS.map((w, i) => (
            <col key={i} style={{ width: `${w}%` }} />
          ))}
        </colgroup>
        <tbody>
          {/* title row: 실제 인쇄본은 제목이 가운데가 아니라 왼쪽 정렬 */}
          <tr>
            <Cell colSpan={9} align="left" className="text-[19px] font-bold tracking-[0.2em]">
              거래명세표
            </Cell>
            <Cell colSpan={4} align="center" className="font-medium" wrap>
              ({copyLabel})
            </Cell>
            <Cell colSpan={2}>일자</Cell>
            <Cell colSpan={6}>{formatDate(orderDate)}</Cell>
            <Cell colSpan={2}>No.</Cell>
            <Cell colSpan={9}>{docNumber}</Cell>
            <Cell colSpan={2} align="center">
              1/1
            </Cell>
          </tr>

          {/* 공급자 / 종사업장 / 공급받는자 / 貴下 */}
          <tr>
            <Cell colSpan={4} as="th" className="tracking-[0.3em] pl-[6px]">
              공급자
            </Cell>
            <Cell colSpan={7}>{company?.business_number ?? "-"}</Cell>
            <Cell colSpan={4} as="th">
              종사업장
            </Cell>
            <Cell colSpan={2} />
            <Cell
              colSpan={1}
              rowSpan={2}
              as="th"
              className="text-[8px] leading-none"
              wrap
            >
              공급받는자
            </Cell>
            <Cell colSpan={13} align="center" className="font-semibold">
              {customerName}
            </Cell>
            <Cell colSpan={3} align="center">
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
            <Cell colSpan={2} align="center" className="relative">
              (인)
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={company?.seal_image_url || "/branding/company-seal.png"}
                alt=""
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-1/2 h-9 w-9 -translate-x-1/2 -translate-y-1/2 opacity-90 mix-blend-multiply"
              />
            </Cell>
            <Cell colSpan={16} align="center" className="opacity-80">
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
            <Cell as="th" colSpan={1} wrap>
              비<br />고
            </Cell>
            <Cell colSpan={8} />
            <Cell as="th" colSpan={4}>
              인수자
            </Cell>
            <Cell colSpan={4} />
          </tr>

          {/* item header */}
          <tr className={ITEM_ROW_HEIGHT}>
            <Cell as="th" colSpan={ITEM_COLS[0]}>
              월일
            </Cell>
            <Cell as="th" colSpan={ITEM_COLS[1]}>
              품명 / 규격
            </Cell>
            <Cell as="th" colSpan={ITEM_COLS[2]}>
              단위
            </Cell>
            <Cell as="th" colSpan={ITEM_COLS[3]}>
              수량
            </Cell>
            <Cell as="th" colSpan={ITEM_COLS[4]}>
              단가
            </Cell>
            <Cell as="th" colSpan={ITEM_COLS[5]}>
              공급가액
            </Cell>
            <Cell as="th" colSpan={ITEM_COLS[6]}>
              세 액
            </Cell>
            <Cell as="th" colSpan={ITEM_COLS[7]}>
              비고/합계
            </Cell>
          </tr>

          {items.map((item, i) => (
            <tr key={item.id} className={ITEM_ROW_HEIGHT} style={stripe(i)}>
              <Cell colSpan={ITEM_COLS[0]} align="center">
                {item.monthDay}
              </Cell>
              <Cell colSpan={ITEM_COLS[1]}>{item.productLabel}</Cell>
              <Cell colSpan={ITEM_COLS[2]} align="center">
                {item.unit}
              </Cell>
              <Cell colSpan={ITEM_COLS[3]} align="right">
                {item.quantity.toLocaleString()}
              </Cell>
              <Cell colSpan={ITEM_COLS[4]} align="right">
                {item.unitPrice.toLocaleString()}
              </Cell>
              <Cell colSpan={ITEM_COLS[5]} align="right">
                {item.supplyAmount.toLocaleString()}
              </Cell>
              <Cell colSpan={ITEM_COLS[6]} align="right">
                {item.taxAmount.toLocaleString()}
              </Cell>
              <Cell colSpan={ITEM_COLS[7]} />
            </tr>
          ))}
          {Array.from({ length: blankCount }).map((_, i) => (
            <tr key={`blank-${i}`} className={ITEM_ROW_HEIGHT} style={stripe(items.length + i)}>
              <Cell colSpan={ITEM_COLS[0]} />
              <Cell colSpan={ITEM_COLS[1]} align="center" className="opacity-60">
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

      <div className="flex w-full justify-between px-[4px] pt-[3px] text-[12px] opacity-90">
        <span>{company?.greeting_message || ""}</span>
        <span>
          From. ☎ {company?.phone ?? "-"} Fax {company?.fax_number ?? "-"}
          {company?.email ? ` ${company.email}` : ""}
        </span>
      </div>
    </div>
  );
}
