import "./invoice-modern.css";
import { computeInvoiceTotals } from "./InvoiceTotals";
import { formatDate, type Company, type CopyLabel, type InvoiceColor, type InvoiceItem, type InvoiceParty } from "./types";
import { formatNumber } from "@/lib/format-number";
import { koreanAmountLine } from "@/lib/korean-amount";

// 새 거래명세표 서식 한 부(공급받는자 보관용 또는 공급자 보관용) — 엔택스 A/B형 복제본이 아니라 우리가 설계한 공용 서식이다(grid-modern 테마의 기본).
// 칸이 나뉜 전통 명세표 구조 + 가는 연한 선, 받는자=파랑·공급자=빨강, 회사 로고 워터마크(올린 회사만), 세금계산서 필수 항목(등록번호·상호·성명·공급가액·세액·작성일자) 포함.
// 회사별 값(로고·도장·인사말·연락처)은 전부 회사 설정에서 props로 받는다. 합계/잔금 계산은 A/B형과 같은 InvoiceTotals를 쓴다.
const MIN_ROWS_HALF = 9;

/** MMDD("1118") → "11-18". 이미 구분자가 있거나 비어 있으면 그대로. */
function monthDayLabel(value: string): string {
  return /^\d{4}$/.test(value) ? `${value.slice(0, 2)}-${value.slice(2)}` : value;
}

export function InvoiceCopyModern({
  copyLabel,
  color,
  company,
  customerName,
  customer,
  orderDate,
  docNumber,
  items,
  memo,
  minItemRows = MIN_ROWS_HALF,
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
  /** 다른 서식과 같은 props를 받기 위해 둔다(이 서식은 줄 높이를 CSS가 정한다). */
  itemRowHeight?: number;
  pageIndex?: number;
  pageCount?: number;
  showSummary?: boolean;
  summaryItems?: InvoiceItem[];
  balance?: number;
}) {
  const buyer: InvoiceParty = customer ?? { name: customerName, business_number: null, representative_name: null, address: null, business_type: null, business_item: null };
  const supplier: InvoiceParty = {
    name: company?.name ?? "",
    business_number: company?.business_number ?? null,
    representative_name: company?.representative_name ?? null,
    address: company?.address ?? null,
    business_type: company?.business_type ?? null,
    business_item: company?.business_item ?? null,
  };
  const totals = computeInvoiceTotals(summaryItems ?? items, balance);
  const blankCount = Math.max(0, minItemRows - items.length);
  const isFull = minItemRows >= 20;
  const sealUrl = company?.seal_image_url;
  const watermarkUrl = company?.logo_mark_url;

  return (
    <div className={`invm-copy invm-${color}${isFull ? " invm-full" : ""}`}>
      {watermarkUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="invm-wm" src={watermarkUrl} alt="" aria-hidden />
      )}

      <div className="invm-head">
        <div className="invm-title">
          <h1>거래명세표</h1>
          <span>({copyLabel})</span>
        </div>
        <div className="invm-box">
          <table className="invm-meta">
            <colgroup>
              <col />
              <col />
              <col />
              <col />
            </colgroup>
            <tbody>
              <tr>
                <th>일자</th>
                <td className="invm-c invm-v" colSpan={3}>{formatDate(orderDate)}</td>
              </tr>
              <tr>
                <th>No.</th>
                <td className="invm-v">{docNumber}</td>
                <th>쪽</th>
                <td className="invm-c">{pageIndex}/{pageCount}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="invm-box">
        <table className="invm-party">
          <colgroup>
            {Array.from({ length: 10 }).map((_, i) => (
              <col key={i} />
            ))}
          </colgroup>
          <tbody>
            <tr>
              <PartyHead label="공급자" bn={supplier.business_number} />
              <PartyHead label="공급받는자" bn={buyer.business_number} />
            </tr>
            <tr>
              <PartyName p={supplier} seal={sealUrl} showSeal />
              <PartyName p={buyer} />
            </tr>
            <tr>
              <PartyAddress address={supplier.address} />
              <PartyAddress address={buyer.address} />
            </tr>
            <tr>
              <PartyBiz p={supplier} />
              <PartyBiz p={buyer} />
            </tr>
          </tbody>
        </table>
      </div>

      <div className="invm-box">
        <table className="invm-items">
          <colgroup>
            {Array.from({ length: 8 }).map((_, i) => (
              <col key={i} />
            ))}
          </colgroup>
          <tbody>
            <tr>
              {["월 일", "품 목 / 규 격", "단위", "수 량", "단 가", "공급가액", "세 액", "비 고"].map((t) => (
                <th key={t}>{t}</th>
              ))}
            </tr>
            {items.map((item, i) => (
              <tr key={item.id} className={i % 2 === 1 ? "invm-z" : undefined}>
                {item.isReference ? (
                  <>
                    <td />
                    <td className="invm-ref">{item.productLabel}</td>
                    <td colSpan={6} />
                  </>
                ) : (
                  <>
                    <td className="invm-c">{monthDayLabel(item.monthDay)}</td>
                    <td>{item.productLabel}</td>
                    <td className="invm-c">{item.unit}</td>
                    <td className="invm-n">{formatNumber(item.quantity)}</td>
                    <td className="invm-n">{formatNumber(item.unitPrice)}</td>
                    <td className="invm-n">{formatNumber(item.supplyAmount)}</td>
                    <td className="invm-n">{formatNumber(item.taxAmount)}</td>
                    <td>{item.remark}</td>
                  </>
                )}
              </tr>
            ))}
            {Array.from({ length: blankCount }).map((_, i) => (
              <tr key={`blank-${i}`} className={(items.length + i) % 2 === 1 ? "invm-z" : undefined}>
                {Array.from({ length: 8 }).map((_c, c) => (
                  <td key={c}>&nbsp;</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showSummary && (
        <div className="invm-box">
          <table className="invm-tot">
            <colgroup>
              {Array.from({ length: 6 }).map((_, i) => (
                <col key={i} />
              ))}
            </colgroup>
            <tbody>
              <tr>
                <th>합 계</th>
                <td className="invm-v invm-sum">
                  {koreanAmountLine(totals.grandTotal)} <small>(₩ {formatNumber(totals.grandTotal)})</small>
                </td>
                <th>공급가액</th>
                <td className="invm-n">{formatNumber(totals.supplyTotal)}</td>
                <th>세 액</th>
                <td className="invm-n">{formatNumber(totals.taxTotal)}</td>
              </tr>
              <tr>
                <th>메 모</th>
                <td>{memo || ""}</td>
                <th>전잔금</th>
                <td className="invm-n">{totals.priorBalance !== undefined ? formatNumber(totals.priorBalance) : ""}</td>
                <th>총잔금</th>
                <td className="invm-n invm-v">{balance !== undefined ? formatNumber(balance) : ""}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <div className="invm-foot">
        <div>
          {company?.greeting_message ? <b>{company.greeting_message}</b> : null}
          {company?.greeting_message && company?.phone ? " · " : null}
          {company?.phone ? <>☎ {company.phone}</> : null}
          {company?.fax_number ? <> · Fax {company.fax_number}</> : null}
          {company?.email ? <> · {company.email}</> : null}
        </div>
        <div className="invm-sign">
          <small>본 서류는 거래 내역 확인용이며 세금계산서가 아닙니다.</small>
          <span>
            <b>인수자</b> <i /> (서명)
          </span>
        </div>
      </div>
    </div>
  );
}

function PartyHead({ label, bn }: { label: string; bn: string | null }) {
  return (
    <>
      <td className="invm-vl" rowSpan={4}>{label}</td>
      <td className="invm-k">등록번호</td>
      <td className="invm-v invm-bn" colSpan={3}>{bn ?? ""}</td>
    </>
  );
}

function PartyName({ p, seal, showSeal }: { p: InvoiceParty; seal?: string | null; showSeal?: boolean }) {
  return (
    <>
      <td className="invm-k">상 호</td>
      <td className="invm-v">{p.name}</td>
      <td className="invm-k">성 명</td>
      <td className="invm-v invm-rep">
        {p.representative_name ?? ""}
        {showSeal &&
          (seal ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="invm-seal" src={seal} alt="" aria-hidden />
          ) : (
            <span className="invm-seal-text">(인)</span>
          ))}
      </td>
    </>
  );
}

function PartyAddress({ address }: { address: string | null }) {
  return (
    <>
      <td className="invm-k">주 소</td>
      <td className="invm-v" colSpan={3}>{address ?? ""}</td>
    </>
  );
}

function PartyBiz({ p }: { p: InvoiceParty }) {
  return (
    <>
      <td className="invm-k">업 태</td>
      <td className="invm-v">{p.business_type ?? ""}</td>
      <td className="invm-k">종 목</td>
      <td className="invm-v">{p.business_item ?? ""}</td>
    </>
  );
}
