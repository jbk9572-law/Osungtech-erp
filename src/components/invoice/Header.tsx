import { Cell } from "./Cell";
import { formatDate, type CopyLabel } from "./types";

// 0707 원본: "거래명세표" 제목 + "(공급받는자/보관용)" 보관용 라벨 + 일자/No/페이지.
export function Header({
  copyLabel,
  orderDate,
  docNumber,
}: {
  copyLabel: CopyLabel;
  orderDate: string;
  docNumber: string;
}) {
  return (
    <tr className="h-[46px]">
      <Cell colSpan={10} align="center" hideBorder={["r"]} className="text-[32px] font-bold tracking-[0.05em]">
        거래명세표
      </Cell>
      <Cell colSpan={7} align="center" hideBorder={["l"]} className="text-[13px] font-medium" wrap>
        ({copyLabel})
      </Cell>
      <Cell colSpan={3}>일자</Cell>
      <Cell colSpan={6}>{formatDate(orderDate)}</Cell>
      <Cell colSpan={2}>No</Cell>
      <Cell colSpan={4}>{docNumber}</Cell>
      <Cell colSpan={2} align="center">
        1/1
      </Cell>
    </tr>
  );
}
