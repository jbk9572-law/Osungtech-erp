import type { ReactNode } from "react";
import { Cell } from "./Cell";
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
      <tr>
        <Cell colSpan={4} as="th" className="text-[15px] tracking-[0.3em] pl-[6px]">
          공급자
        </Cell>
        <Cell colSpan={7} className="font-bold text-black">
          {company?.business_number ?? "-"}
        </Cell>
        <Cell colSpan={4} as="th" className="text-[15px]">
          종사업장
        </Cell>
        <Cell colSpan={2} />
        {customerSlot}
      </tr>

      {/* 상호 / 성명 */}
      <tr>
        <Cell as="th" colSpan={1}>
          상<br />호
        </Cell>
        <Cell colSpan={8} align="center" className="font-bold text-black">
          {company?.name ?? "-"}
        </Cell>
        <Cell as="th" colSpan={1}>
          성<br />명
        </Cell>
        <Cell colSpan={5} className="font-bold text-black">
          {company?.representative_name ?? "-"}
        </Cell>
        <Cell colSpan={2} align="center" className="relative">
          (인)
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={company?.seal_image_url || "/branding/company-seal.png"}
            alt=""
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 opacity-90 mix-blend-multiply"
          />
        </Cell>
      </tr>

      {/* 주소: 공급받는자/거래처명 병합 칸이 여기까지 이어지므로 값 칸 너비는 상호행과 동일하게 맞춘다 */}
      <tr>
        <Cell as="th" colSpan={1}>
          주<br />소
        </Cell>
        <Cell colSpan={16} className="text-black">
          {company?.address ?? "-"}
        </Cell>
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
        <Cell as="th" colSpan={1} wrap className="text-[14px]">
          비<br />고
        </Cell>
        <Cell colSpan={8} />
        <Cell as="th" colSpan={4}>
          인수자
        </Cell>
        <Cell colSpan={4} />
      </tr>
    </>
  );
}
