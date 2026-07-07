import { Cell } from "./Cell";
import { TABLE } from "./InvoiceMetrics";
import { ITEM_COLS, type InvoiceItem, type InvoiceColor } from "./types";

// 0707 원본 품목 헤더: 월일 / 품 명 / 규 격 / 단위 / 수량 / 단 가 / 공급가액 / 세 액 / 비고/합계
export function ItemsTable({ items, color }: { items: InvoiceItem[]; color: InvoiceColor }) {
  const minItemRows = 10;
  const blankCount = Math.max(0, minItemRows - items.length);
  const tint = color === "blue" ? "rgba(0,0,255,0.08)" : "rgba(255,0,0,0.08)";
  // 원본 실제 출력물은 품목 영역 첫 줄이 항상 흰색이고, 그다음 줄부터 번갈아
  // 옅은 색이 들어간다 (짝수 인덱스가 아니라 홀수 인덱스에 색이 들어감).
  const stripe = (rowIndex: number) => (rowIndex % 2 === 1 ? { backgroundColor: tint } : undefined);

  return (
    <>
      <tr style={{ height: TABLE.headerRowHeight, fontSize: TABLE.headerFontSize }}>
        <Cell as="th" colSpan={ITEM_COLS[0]}>
          월일
        </Cell>
        <Cell as="th" colSpan={ITEM_COLS[1]}>
          <span style={{ position: "relative", left: TABLE.productHeaderOffsetX }}>
            품{" "} 명 /{" "} 규{" "} 격
          </span>
        </Cell>
        <Cell as="th" colSpan={ITEM_COLS[2]}>
          <span style={{ position: "relative", left: TABLE.unitHeaderOffsetX }}>단위</span>
        </Cell>
        <Cell as="th" colSpan={ITEM_COLS[3]}>
          <span style={{ position: "relative", left: TABLE.qtyHeaderOffsetX }}>수량</span>
        </Cell>
        <Cell as="th" colSpan={ITEM_COLS[4]}>
          <span style={{ position: "relative", left: TABLE.priceHeaderOffsetX }}>단 가</span>
        </Cell>
        <Cell as="th" colSpan={ITEM_COLS[5]}>
          공급가액
        </Cell>
        <Cell as="th" colSpan={ITEM_COLS[6]}>
          세{" "} 액
        </Cell>
        <Cell as="th" colSpan={ITEM_COLS[7]}>
          비고/합계
        </Cell>
      </tr>

      {items.map((item, i) => (
        <tr
          key={item.id}
          className="text-black"
          style={{ height: TABLE.itemRowHeight, fontSize: TABLE.itemFontSize, ...stripe(i) }}
        >
          <Cell colSpan={ITEM_COLS[0]} align="center" hideBorder={["t", "b"]}>
            {item.monthDay}
          </Cell>
          <Cell colSpan={ITEM_COLS[1]} hideBorder={["t", "b"]}>
            <span style={{ position: "relative", left: TABLE.productDataOffsetX }}>{item.productLabel}</span>
          </Cell>
          <Cell colSpan={ITEM_COLS[2]} align="center" hideBorder={["t", "b"]}>
            {item.unit}
          </Cell>
          <Cell colSpan={ITEM_COLS[3]} align="right" hideBorder={["t", "b"]}>
            <span style={{ position: "relative", left: TABLE.qtyDataOffsetX }}>
              {item.quantity.toLocaleString()}
            </span>
          </Cell>
          <Cell colSpan={ITEM_COLS[4]} align="right" hideBorder={["t", "b"]}>
            <span style={{ position: "relative", left: TABLE.priceDataOffsetX }}>
              {item.unitPrice.toLocaleString()}
            </span>
          </Cell>
          <Cell colSpan={ITEM_COLS[5]} align="right" hideBorder={["t", "b"]}>
            {item.supplyAmount.toLocaleString()}
          </Cell>
          <Cell colSpan={ITEM_COLS[6]} align="right" hideBorder={["t", "b"]}>
            <span style={{ position: "relative", left: TABLE.taxDataOffsetX }}>
              {item.taxAmount.toLocaleString()}
            </span>
          </Cell>
          <Cell colSpan={ITEM_COLS[7]} hideBorder={["t", "b"]} />
        </tr>
      ))}
      {Array.from({ length: blankCount }).map((_, i) => (
        <tr key={`blank-${i}`} style={{ height: TABLE.itemRowHeight, ...stripe(items.length + i) }}>
          <Cell colSpan={ITEM_COLS[0]} hideBorder={["t", "b"]} />
          <Cell colSpan={ITEM_COLS[1]} hideBorder={["t", "b"]} />
          <Cell colSpan={ITEM_COLS[2]} hideBorder={["t", "b"]} />
          <Cell colSpan={ITEM_COLS[3]} hideBorder={["t", "b"]} />
          <Cell colSpan={ITEM_COLS[4]} hideBorder={["t", "b"]} />
          <Cell colSpan={ITEM_COLS[5]} hideBorder={["t", "b"]} />
          <Cell colSpan={ITEM_COLS[6]} hideBorder={["t", "b"]} />
          <Cell colSpan={ITEM_COLS[7]} hideBorder={["t", "b"]} />
        </tr>
      ))}
    </>
  );
}
