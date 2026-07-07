import { Cell } from "./Cell";
import { ITEM_COLS, ITEM_ROW_HEIGHT, type InvoiceItem, type InvoiceColor } from "./types";

export function ItemsTable({ items, color }: { items: InvoiceItem[]; color: InvoiceColor }) {
  const minItemRows = 10;
  const blankCount = Math.max(0, minItemRows - items.length);
  const tint = color === "blue" ? "rgba(0,0,255,0.08)" : "rgba(255,0,0,0.08)";
  // 원본 실제 출력물은 품목 영역 첫 줄이 항상 흰색이고, 그다음 줄부터 번갈아
  // 옅은 색이 들어간다 (짝수 인덱스가 아니라 홀수 인덱스에 색이 들어감).
  const stripe = (rowIndex: number) => (rowIndex % 2 === 1 ? { backgroundColor: tint } : undefined);

  return (
    <>
      {/* item header */}
      <tr className="h-[19px]">
        <Cell as="th" colSpan={ITEM_COLS[0]}>
          월일
        </Cell>
        <Cell as="th" colSpan={ITEM_COLS[1]}>
          품 명 / 규 격
        </Cell>
        <Cell as="th" colSpan={ITEM_COLS[2]}>
          단위
        </Cell>
        <Cell as="th" colSpan={ITEM_COLS[3]}>
          수량
        </Cell>
        <Cell as="th" colSpan={ITEM_COLS[4]}>
          단 가
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
        <tr key={item.id} className={`${ITEM_ROW_HEIGHT} text-black`} style={stripe(i)}>
          <Cell colSpan={ITEM_COLS[0]} align="center" hideBorder={["t", "b"]}>
            {item.monthDay}
          </Cell>
          <Cell colSpan={ITEM_COLS[1]} hideBorder={["t", "b"]}>
            {item.productLabel}
          </Cell>
          <Cell colSpan={ITEM_COLS[2]} align="center" hideBorder={["t", "b"]}>
            {item.unit}
          </Cell>
          <Cell colSpan={ITEM_COLS[3]} align="right" hideBorder={["t", "b"]}>
            {item.quantity.toLocaleString()}
          </Cell>
          <Cell colSpan={ITEM_COLS[4]} align="right" hideBorder={["t", "b"]}>
            {item.unitPrice.toLocaleString()}
          </Cell>
          <Cell colSpan={ITEM_COLS[5]} align="right" hideBorder={["t", "b"]}>
            {item.supplyAmount.toLocaleString()}
          </Cell>
          <Cell colSpan={ITEM_COLS[6]} align="right" hideBorder={["t", "b"]}>
            {item.taxAmount.toLocaleString()}
          </Cell>
          <Cell colSpan={ITEM_COLS[7]} hideBorder={["t", "b"]} />
        </tr>
      ))}
      {Array.from({ length: blankCount }).map((_, i) => (
        <tr key={`blank-${i}`} className={ITEM_ROW_HEIGHT} style={stripe(items.length + i)}>
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
