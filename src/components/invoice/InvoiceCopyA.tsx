import { Cell } from "./Cell";
import { Footer } from "./Footer";
import { DOCUMENT, SEAL, TITLE } from "./InvoiceMetrics";
import {
  A_DEFAULT_ITEM_ROWS,
  A_FONT,
  A_HEADER,
  A_ITEM_COLS,
  A_LEFT,
  A_RIGHT,
  A_ROW,
  A_SUMMARY,
  aColWidthsPct,
  aSpan,
  type APartySide,
} from "./InvoiceGridA";
import { computeInvoiceTotals } from "./InvoiceTotals";
import { COLOR_HEX, formatDate, type Company, type CopyLabel, type InvoiceColor, type InvoiceItem, type InvoiceParty } from "./types";
import { formatNumber } from "@/lib/format-number";

const span = (r: [number, number]) => aSpan(r[0], r[1]);
// 세로로 쓰는 한 글자씩 라벨(상/호, 성/명 …)
const vlabel = { lineHeight: "13px", fontSize: A_FONT.label } as const;
// 좁은 칸의 라벨(종사업장·인수자·전잔금 등)은 좌우 여백을 없애야 글자가 "…"으로 잘리지 않는다(원본도 칸 폭에 글자가 거의 꽉 찬다).
const TIGHT = { paddingLeft: 0, paddingRight: 0 } as const;

// 거래명세표 A형(엔택스 A형 서식) 한 부 — 공급자와 공급받는자를 똑같은 모양으로 나란히 채운다.
// 칸 위치는 InvoiceGridA(원본 PDF 실측)가 정하고, 이 파일은 구조만 담당한다. 합계/잔금 계산은 B형과 같은 InvoiceTotals를 쓴다.
export function InvoiceCopyA({
  copyLabel,
  color,
  company,
  customerName,
  customer,
  orderDate,
  docNumber,
  items,
  memo,
  minItemRows = A_DEFAULT_ITEM_ROWS,
  itemRowHeight = A_ROW.item,
  pageIndex = 1,
  pageCount = 1,
  showSummary = true,
  summaryItems,
  balance,
}: {
  copyLabel: CopyLabel;
  color: InvoiceColor;
  company: Company;
  customerName: string;
  customer?: InvoiceParty | null;
  orderDate: string;
  docNumber: string;
  items: InvoiceItem[];
  memo?: string | null;
  minItemRows?: number;
  itemRowHeight?: number;
  pageIndex?: number;
  pageCount?: number;
  showSummary?: boolean;
  summaryItems?: InvoiceItem[];
  balance?: number;
}) {
  const colorStyle = { color: COLOR_HEX[color], "--invoice-line": COLOR_HEX[color] } as React.CSSProperties;
  const tint = color === "blue" ? "rgba(0,0,255,0.08)" : "rgba(255,0,0,0.08)";
  const stripe = (rowIndex: number) => (rowIndex % 2 === 1 ? { backgroundColor: tint } : undefined);
  const blankCount = Math.max(0, minItemRows - items.length);
  const buyer: InvoiceParty = customer ?? {
    name: customerName,
    business_number: null,
    representative_name: null,
    address: null,
    business_type: null,
    business_item: null,
  };
  const supplier: InvoiceParty = {
    name: company?.name ?? "",
    business_number: company?.business_number ?? null,
    representative_name: company?.representative_name ?? null,
    address: company?.address ?? null,
    business_type: company?.business_type ?? null,
    business_item: company?.business_item ?? null,
  };
  const totals = computeInvoiceTotals(summaryItems ?? items, balance);
  const [labelLine1, labelLine2] = copyLabel.split(" ");

  return (
    <div className="relative break-inside-avoid" style={colorStyle}>
      <table className="w-full table-fixed border-collapse leading-tight" style={{ fontSize: DOCUMENT.baseFontSize }}>
        <colgroup>
          {aColWidthsPct().map((w, i) => (
            <col key={i} style={{ width: `${w}%` }} />
          ))}
        </colgroup>
        <tbody>
          {/* 제목 / 보관용 / 일자 / No / 쪽수 */}
          <tr style={{ height: A_ROW.header1, fontSize: A_FONT.label }}>
            <Cell
              colSpan={span(A_HEADER.title)}
              rowSpan={2}
              align="center"
              hideBorder={["r"]}
              style={{
                fontFamily: TITLE.fontFamily,
                fontSize: A_FONT.title,
                fontWeight: TITLE.fontWeight,
                overflow: "visible",
              }}
            >
              <span className="erp-u-relative" style={{ left: A_HEADER.titleOffsetPx }}>
                거래명세표
              </span>
            </Cell>
            <Cell colSpan={span(A_HEADER.copyLabel)} rowSpan={2} align="center" hideBorder={["l"]} style={{ fontSize: A_FONT.copyLabel, ...TIGHT }}>
              ({labelLine1}
              <br />
              {labelLine2})
            </Cell>
            <Cell colSpan={span(A_HEADER.dateLabel)} align="center">
              일자
            </Cell>
            <Cell colSpan={span(A_HEADER.date)} align="center">
              {formatDate(orderDate)}
            </Cell>
            <Cell colSpan={span(A_HEADER.noLabel)} align="center">
              No
            </Cell>
            <Cell colSpan={span(A_HEADER.no)}>{docNumber}</Cell>
            <Cell colSpan={span(A_HEADER.page)} align="center">
              {pageIndex}/{pageCount}
            </Cell>
          </tr>
          <tr style={{ height: A_ROW.header2 }}>
            <Cell colSpan={span(A_HEADER.rest)} />
          </tr>

          {/* 1행: 사업자번호 / 종사업장 */}
          <tr style={{ height: A_ROW.party1, fontSize: A_FONT.label }}>
            <PartyRow1 side={A_LEFT} label="공급자" spaced number={supplier.business_number} />
            <PartyRow1 side={A_RIGHT} label="공급받는자" number={buyer.business_number} />
          </tr>
          {/* 2행: 상호 / 성명(인) */}
          <tr style={{ height: A_ROW.party2 }}>
            <PartyRow2 side={A_LEFT} name={supplier.name} rep={supplier.representative_name} />
            <PartyRow2 side={A_RIGHT} name={buyer.name} rep={buyer.representative_name} />
          </tr>
          {/* 3행: 주소 */}
          <tr style={{ height: A_ROW.party3, fontSize: A_FONT.body }}>
            <PartyRow3 side={A_LEFT} address={supplier.address} />
            <PartyRow3 side={A_RIGHT} address={buyer.address} />
          </tr>
          {/* 4행: 업태 / 종목 — 비고 / 인수자 */}
          <tr style={{ height: A_ROW.party4, fontSize: A_FONT.body }}>
            <VLabel range={A_LEFT.r4.l1}>
              업<br />태
            </VLabel>
            <Cell colSpan={span(A_LEFT.r4.v1)} className="text-black">
              {supplier.business_type ?? ""}
            </Cell>
            <VLabel range={A_LEFT.r4.l2}>
              종<br />목
            </VLabel>
            <Cell colSpan={span(A_LEFT.r4.v2)} className="text-black">
              {supplier.business_item ?? ""}
            </Cell>
            <VLabel range={A_RIGHT.r4.l1}>
              비<br />고
            </VLabel>
            <Cell colSpan={span(A_RIGHT.r4.v1)} />
            <Cell as="th" colSpan={span(A_RIGHT.r4.l2)} align="center" style={{ fontSize: A_FONT.assignee, ...TIGHT }}>
              인수자
            </Cell>
            <Cell colSpan={span(A_RIGHT.r4.v2)} />
          </tr>

          {/* 품목 표 머리 */}
          <tr style={{ height: A_ROW.itemHead, fontSize: A_FONT.body }}>
            {["월일", "품 명 / 규 격", "단위", "수량", "단 가", "공급가액", "세 액", "비고/합계"].map((t, i) => (
              <Cell key={t} as="th" colSpan={span(A_ITEM_COLS[i])} style={{ paddingLeft: 3, paddingRight: 3 }}>
                {t}
              </Cell>
            ))}
          </tr>
          {items.map((item, i) => (
            <tr
              key={item.id}
              className={item.isReference ? "text-gray-600" : "text-black"}
              style={{ height: itemRowHeight, fontSize: A_FONT.body, ...stripe(i) }}
            >
              <ItemCell col={0} align="center">
                {item.monthDay}
              </ItemCell>
              <ItemCell col={1}>{item.productLabel}</ItemCell>
              <ItemCell col={2} align="center">
                {item.isReference ? "-" : item.unit}
              </ItemCell>
              <ItemCell col={3} align="right">
                {item.isReference ? "-" : formatNumber(item.quantity)}
              </ItemCell>
              <ItemCell col={4} align="right">
                {item.isReference ? "-" : formatNumber(item.unitPrice)}
              </ItemCell>
              <ItemCell col={5} align="right">
                {item.isReference ? "-" : formatNumber(item.supplyAmount)}
              </ItemCell>
              <ItemCell col={6} align="right">
                {item.isReference ? "-" : formatNumber(item.taxAmount)}
              </ItemCell>
              <ItemCell col={7}>{item.remark}</ItemCell>
            </tr>
          ))}
          {Array.from({ length: blankCount }).map((_, i) => (
            <tr key={`blank-${i}`} style={{ height: itemRowHeight, ...stripe(items.length + i) }}>
              {A_ITEM_COLS.map((_c, col) => (
                <ItemCell key={col} col={col} />
              ))}
            </tr>
          ))}

          {showSummary && (
            <>
              <tr style={{ height: A_ROW.total, fontSize: A_FONT.label }}>
                <Cell as="th" colSpan={span(A_SUMMARY.label)} className="font-semibold">
                  합계
                </Cell>
                <Cell colSpan={span(A_SUMMARY.value)} className="text-black" style={{ fontSize: DOCUMENT.baseFontSize, paddingLeft: 3, paddingRight: 3 }}>
                  <div className="flex items-baseline justify-between">
                    <span className="font-bold">￦{formatNumber(totals.grandTotal)}원정</span>
                    <span style={{ fontSize: A_FONT.label }}>
                      (수량 : {totals.quantityLabel}, 공급가 : {formatNumber(totals.supplyTotal)}, 세액 :{" "}
                      {formatNumber(totals.taxTotal)})
                    </span>
                  </div>
                </Cell>
                <Cell as="th" colSpan={span(A_SUMMARY.balLabel)} style={TIGHT}>
                  전잔금
                </Cell>
                <Cell colSpan={span(A_SUMMARY.balValue)} align="right" className="text-black" style={{ fontSize: DOCUMENT.baseFontSize, paddingLeft: 3, paddingRight: 3 }}>
                  {totals.priorBalance !== undefined ? formatNumber(totals.priorBalance) : ""}
                </Cell>
              </tr>
              <tr style={{ height: A_ROW.memo, fontSize: A_FONT.label }}>
                <Cell as="th" colSpan={span(A_SUMMARY.label)}>
                  메모
                </Cell>
                <Cell colSpan={span(A_SUMMARY.value)} className="text-black" style={{ fontSize: DOCUMENT.baseFontSize, paddingLeft: 3, paddingRight: 3 }}>
                  {memo || ""}
                </Cell>
                <Cell as="th" colSpan={span(A_SUMMARY.balLabel)} style={TIGHT}>
                  총잔금
                </Cell>
                <Cell colSpan={span(A_SUMMARY.balValue)} align="right" className="text-black" style={{ fontSize: DOCUMENT.baseFontSize, paddingLeft: 3, paddingRight: 3 }}>
                  {balance !== undefined ? formatNumber(balance) : ""}
                </Cell>
              </tr>
            </>
          )}
        </tbody>
      </table>
      {/* 도장 위치는 B형과 같다(공급자 (인) 칸 위 — 원본 A형 실측으로 확인: 칸 중심 47.5%, 표 상단에서 약 58px) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={company?.seal_image_url || "/branding/sample-company-seal.png"}
        alt=""
        aria-hidden
        className="pointer-events-none absolute -translate-x-1/2 opacity-90 mix-blend-multiply"
        style={{ top: SEAL.top, left: SEAL.left, height: SEAL.size, width: SEAL.size }}
      />
      <Footer company={company} />
    </div>
  );
}

function VLabel({ range, children }: { range: [number, number]; children: React.ReactNode }) {
  return (
    <Cell as="th" colSpan={span(range)} style={vlabel}>
      {children}
    </Cell>
  );
}

function ItemCell({ col, align, children }: { col: number; align?: "left" | "center" | "right"; children?: React.ReactNode }) {
  return (
    <Cell colSpan={span(A_ITEM_COLS[col])} align={align} hideBorder={["t", "b"]} style={{ paddingLeft: 3, paddingRight: 3 }}>
      {children}
    </Cell>
  );
}

function PartyRow1({ side, label, spaced, number }: { side: APartySide; label: string; spaced?: boolean; number: string | null }) {
  return (
    <>
      <Cell as="th" colSpan={span(side.r1.label)} style={spaced ? { letterSpacing: "0.35em" } : undefined}>
        {label}
      </Cell>
      <Cell colSpan={span(side.r1.number)} align="center" className="font-bold text-black" style={{ fontSize: A_FONT.number }}>
        {number ?? ""}
      </Cell>
      <Cell as="th" colSpan={span(side.r1.sub)} style={TIGHT}>
        종사업장
      </Cell>
      <Cell colSpan={span(side.r1.blank)} />
    </>
  );
}

function PartyRow2({ side, name, rep }: { side: APartySide; name: string; rep: string | null }) {
  return (
    <>
      <VLabel range={side.r2.label}>
        상<br />호
      </VLabel>
      <Cell colSpan={span(side.r2.name)} align="center" className="font-bold text-black" style={{ fontSize: A_FONT.name }}>
        {name}
      </Cell>
      <VLabel range={side.r2.repLabel}>
        성<br />명
      </VLabel>
      <Cell colSpan={span(side.r2.rep)} className="text-black" style={{ fontSize: A_FONT.name, paddingLeft: 3, paddingRight: 3 }}>
        <div className="flex items-center justify-between">
          <span>{rep ?? ""}</span>
          <span style={{ fontSize: A_FONT.stamp }}>(인)</span>
        </div>
      </Cell>
    </>
  );
}

function PartyRow3({ side, address }: { side: APartySide; address: string | null }) {
  return (
    <>
      <VLabel range={side.r3.label}>
        주<br />소
      </VLabel>
      <Cell colSpan={span(side.r3.value)} className="text-black" style={{ paddingLeft: 3 }}>
        {address ?? ""}
      </Cell>
    </>
  );
}
