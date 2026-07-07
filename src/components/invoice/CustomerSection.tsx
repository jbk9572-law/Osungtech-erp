import { Cell } from "./Cell";

// 0707 원본: "공급받는자" 세로 라벨 + 거래처 상호/貴下/인사말 박스는 공급자
// 정보 첫 행(공급자/종사업장)에서 시작해 3행(상호~주소)에 걸쳐 세로로
// 병합된다. 그래서 이 컴포넌트는 독립된 <tr>을 갖지 않고, SupplierSection의
// 첫 번째 행 안에 셀로 끼워 넣는다.
export function CustomerSection({ customerName }: { customerName: string }) {
  return (
    <>
      <Cell colSpan={1} rowSpan={3} as="th" className="text-[11px] leading-none" wrap>
        <div className="flex flex-col items-center gap-[3px]">
          {[..."공급받는자"].map((ch, i) => (
            <span key={i}>{ch}</span>
          ))}
        </div>
      </Cell>
      <Cell colSpan={16} rowSpan={3} valign="top" wrap className="relative pt-[18px]">
        <div className="pl-[10px] text-left text-black">{customerName}</div>
        <span className="absolute top-[18px] right-[4px] font-bold">貴下</span>
        <div className="pt-[28px] text-center">거래해 주셔서 감사드립니다.</div>
      </Cell>
    </>
  );
}
