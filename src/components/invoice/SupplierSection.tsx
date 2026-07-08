import type { ReactNode } from "react";
import { Cell } from "./Cell";
import { SUPPLIER } from "./InvoiceMetrics";
import type { Company } from "./types";

// 0707 원본: 공급자 사업자번호/종사업장, 상호/성명/(인), 주소, 업태/종목/비고/인수자.
export function SupplierSection({
  company,
  customerSlot,
}: {
  company: Company;
  // 공급받는자(거래처) 블록은 이 첫 번째 행에서 시작해 3행에 걸쳐 병합되므로,
  // CustomerSection이 반환하는 셀들을 이 자리에 그대로 끼워 넣는다.
  customerSlot: ReactNode;
}) {
  return (
    <>
      {/* 공급자 / 종사업장 / 공급받는자 시작 */}
      <tr style={{ height: SUPPLIER.row1Height }}>
        <Cell
          colSpan={4}
          as="th"
          style={{
            fontSize: SUPPLIER.labelFontSize,
            letterSpacing: SUPPLIER.labelLetterSpacing,
            paddingLeft: SUPPLIER.labelPaddingLeft,
          }}
        >
          공급자
        </Cell>
        <Cell colSpan={7} className="font-bold text-black" style={{ fontSize: SUPPLIER.businessNumberFontSize }}>
          <span style={{ position: "relative", left: SUPPLIER.businessNumberOffsetX }}>
            {company?.business_number ?? "-"}
          </span>
        </Cell>
        <Cell colSpan={4} as="th" style={{ fontSize: SUPPLIER.labelFontSize }}>
          <span style={{ position: "relative", left: SUPPLIER.subLabelOffsetX }}>종사업장</span>
        </Cell>
        <Cell colSpan={2} />
        {customerSlot}
      </tr>

      {/* 상호 / 성명 */}
      <tr style={{ height: SUPPLIER.row2Height }}>
        <Cell as="th" colSpan={1} style={{ lineHeight: `${SUPPLIER.verticalLabelLineHeight}px` }}>
          상<br />호
        </Cell>
        <Cell colSpan={8} align="center" className="font-bold text-black">
          <span style={{ position: "relative", left: SUPPLIER.companyNameOffsetX }}>{company?.name ?? "-"}</span>
        </Cell>
        <Cell as="th" colSpan={1} style={{ lineHeight: `${SUPPLIER.verticalLabelLineHeight}px` }}>
          성<br />명
        </Cell>
        <Cell colSpan={5} className="font-bold text-black">
          <span style={{ position: "relative", left: SUPPLIER.repNameOffsetX }}>
            {company?.representative_name ?? "-"}
          </span>
        </Cell>
        <Cell colSpan={2} align="center">
          <span style={{ position: "relative", left: SUPPLIER.stampOffsetX, fontSize: SUPPLIER.stampFontSize }}>
            (인)
          </span>
        </Cell>
      </tr>

      {/* 주소: 공급받는자/거래처명 병합 칸이 여기까지 이어지므로 값 칸 너비는 상호행과 동일하게 맞춘다 */}
      <tr style={{ height: SUPPLIER.row3Height }}>
        <Cell as="th" colSpan={1} style={{ lineHeight: `${SUPPLIER.verticalLabelLineHeight}px` }}>
          주<br />소
        </Cell>
        <Cell colSpan={16} className="text-black">
          {company?.address ?? "-"}
        </Cell>
      </tr>

      {/* 업태 / 종목 / 비고 / 인수자 */}
      <tr style={{ height: SUPPLIER.row4Height }}>
        <Cell as="th" colSpan={1} style={{ lineHeight: `${SUPPLIER.verticalLabelLineHeight}px` }}>
          업<br />태
        </Cell>
        <Cell colSpan={7}>{company?.business_type ?? "-"}</Cell>
        <Cell as="th" colSpan={1} style={{ lineHeight: `${SUPPLIER.verticalLabelLineHeight}px` }}>
          종<br />목
        </Cell>
        <Cell colSpan={8}>{company?.business_item ?? "-"}</Cell>
        <Cell
          as="th"
          colSpan={1}
          wrap
          style={{ fontSize: SUPPLIER.remarkLabelFontSize, lineHeight: `${SUPPLIER.verticalLabelLineHeight}px` }}
        >
          비<br />고
        </Cell>
        <Cell colSpan={8} />
        <Cell as="th" colSpan={4} align="center" style={{ fontSize: SUPPLIER.assigneeLabelFontSize }}>
          인수자
        </Cell>
        <Cell colSpan={4} />
      </tr>
    </>
  );
}
