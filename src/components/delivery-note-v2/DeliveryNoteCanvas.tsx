import type { ReactNode } from "react";
import { SNS_LINES, SNS_FILLS } from "./sns-lines";

// 실제 출고증 PDF(에스엔에스필텍 기준)를 벡터 좌표 그대로 재현하는 컴포넌트.
// 모든 좌표/치수는 원본 PDF(595.32 x 841.92pt)에서 PyMuPDF로 실측한 값이며
// 1 단위 = 1pt = 1px로 그대로 사용한다(이 프로젝트의 인쇄 페이지 관례).
const PAGE_W = 595.32;
const PAGE_H = 841.92;

const FONT = "'Malgun Gothic', '맑은 고딕', Gulim, '굴림', sans-serif";

// 브라우저 인쇄(page.pdf) 파이프라인은 CSS px를 96dpi 기준으로 72dpi(pt)에
// 매핑해서 0.75배로 줄여버린다. 값 뒤에 "pt" 단위를 직접 붙이면 CSS가
// 물리적 포인트로 그대로 처리해 원본 PDF 좌표와 1:1로 맞는다.
const pt = (n: number) => `${n}pt`;

type Company = {
  name: string;
  business_number: string | null;
  representative_name: string | null;
  phone: string | null;
  fax_number: string | null;
  business_type: string | null;
  business_item: string | null;
  address: string | null;
  seal_image_url?: string | null;
  logo_wordmark_url?: string | null;
} | null;

type Item = {
  id: string;
  category: string;
  spec: string;
  sku: string;
  unit: string;
  quantity: number;
  basePackageQty: number | null;
};

function Fill({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        left: pt(x),
        top: pt(y),
        width: pt(w),
        height: pt(h),
        background: "#d0cece",
      }}
    />
  );
}

function Line({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        left: pt(x),
        top: pt(y),
        width: pt(Math.max(w, 0.75)),
        height: pt(Math.max(h, 0.75)),
        border: "0.75pt solid #000",
        boxSizing: "border-box",
      }}
    />
  );
}

// 왼쪽 정렬 텍스트: 좌상단 좌표 그대로 배치. width를 주면 그 폭 안에서 줄바꿈.
function T({
  x,
  y,
  size,
  bold,
  children,
  width,
}: {
  x: number;
  y: number;
  size: number;
  bold?: boolean;
  children: ReactNode;
  width?: number;
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: pt(x),
        top: pt(y),
        width: width != null ? pt(width) : undefined,
        fontSize: pt(size),
        fontWeight: bold ? 700 : 400,
        fontFamily: FONT,
        color: "#000",
        lineHeight: 1.2,
        whiteSpace: width ? "normal" : "nowrap",
      }}
    >
      {children}
    </div>
  );
}

// 가운데 정렬 텍스트: centerX를 텍스트 중심으로 고정(translateX(-50%)).
function TCenter({
  centerX,
  y,
  size,
  bold,
  children,
}: {
  centerX: number;
  y: number;
  size: number;
  bold?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: pt(centerX),
        top: pt(y),
        transform: "translateX(-50%)",
        fontSize: pt(size),
        fontWeight: bold ? 700 : 400,
        fontFamily: FONT,
        color: "#000",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </div>
  );
}

// 오른쪽 정렬 텍스트: 오른쪽 기준점 고정, 왼쪽으로 자라남 - 거래처명 등.
function TRight({
  right,
  y,
  size,
  bold,
  children,
}: {
  right: number;
  y: number;
  size: number;
  bold?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        position: "absolute",
        right: pt(PAGE_W - right),
        top: pt(y),
        fontSize: pt(size),
        fontWeight: bold ? 700 : 400,
        fontFamily: FONT,
        color: "#000",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </div>
  );
}

// 품목 영역 좌표 (모든 출고증 서식 공통, 실측 확인됨).
const CATEGORY_X0 = 75.36;
const CATEGORY_X1 = 158.64;
const CATEGORY_CENTER = (CATEGORY_X0 + CATEGORY_X1) / 2;
const SUM_LABEL_CENTER = (CATEGORY_X0 + 278.64) / 2;
const SPEC_X = 187.8;
const COL_B_CENTER = (278.64 + 387.48) / 2;
const COL_C_CENTER = (387.48 + 460.92) / 2;
const ROW_TOP0 = 238.28;
const ROW_H = 16.68;
const ROW_COUNT = 27;

export function SnsFiltechCanvas({
  company,
  customerName,
  customerAddress,
  customerContactName,
  customerContactPhone,
  orderDate,
  items,
  note,
}: {
  company: Company;
  customerName: string;
  customerAddress: string | null;
  customerContactName?: string | null;
  customerContactPhone?: string | null;
  orderDate: string;
  items: Item[];
  note?: string | null;
}) {
  const blankCount = Math.max(0, ROW_COUNT - items.length);
  const rows = [
    ...items,
    ...Array.from({ length: blankCount }).map((_, i) => ({
      id: `blank-${i}`,
      category: items[items.length - 1]?.category ?? "",
      spec: "",
      sku: "",
      unit: "",
      quantity: 0,
      basePackageQty: null as number | null,
    })),
  ];

  // 연속된 같은 대분류(품명)는 세로로 병합해서 그 구간 중앙에 한 번만 표시한다.
  const groups: { category: string; start: number; count: number }[] = [];
  for (let i = 0; i < rows.length; ) {
    let j = i + 1;
    while (j < rows.length && rows[j].category === rows[i].category) j++;
    groups.push({ category: rows[i].category, start: i, count: j - i });
    i = j;
  }

  const totalBox = items.reduce((sum, it) => sum + it.quantity, 0);
  const totalEa = items.reduce((sum, it) => sum + it.quantity * (it.basePackageQty ?? 0), 0);

  return (
    <div style={{ position: "relative", width: pt(PAGE_W), height: pt(PAGE_H), fontFamily: FONT }}>
      {SNS_FILLS.map((f, i) => (
        <Fill key={i} {...f} />
      ))}
      {SNS_LINES.map((l, i) => (
        <Line key={i} {...l} />
      ))}

      {/* 제목 / 거래처 귀하 */}
      <T x={161.04} y={78.38} size={12} bold>
        거래명세표 (출고)
      </T>
      <TRight right={534.48} y={78.38} size={12} bold>
        {customerName}&nbsp;&nbsp;귀하
      </TRight>

      {/* 공급자(우리 회사) 정보 - 항상 고정 */}
      <T x={99.36} y={104.09} size={9}>등록번호</T>
      <T x={216.48} y={104.09} size={9}>{company?.business_number ?? "-"}</T>
      <T x={103.92} y={119.81} size={9}>공급자</T>
      <T x={168.84} y={120.29} size={9}>{company?.name ?? "-"}</T>
      <T x={244.19} y={120.29} size={9}>성명</T>
      <T x={297.83} y={120.29} size={9}>{company?.representative_name ?? "-"}</T>
      <T x={99.36} y={135.53} size={9}>전화번호</T>
      <T x={164.64} y={136.01} size={9}>{company?.phone ?? "-"}</T>
      <T x={235.16} y={136.01} size={9}>팩스번호</T>
      <T x={283.04} y={136.01} size={9}>{company?.fax_number ?? "-"}</T>
      <T x={108.12} y={151.25} size={9}>업태</T>
      <T x={173.04} y={151.73} size={9}>{company?.business_type ?? "-"}</T>
      <T x={243.98} y={151.73} size={9}>종목</T>
      <T x={291.5} y={151.73} size={9}>{company?.business_item ?? "-"}</T>
      <T x={93.36} y={175.61} size={9}>사업장 주소</T>
      <T x={162.84} y={168.77} size={9} width={166}>{company?.address ?? "-"}</T>

      {/* 공급받는자(거래처) 정보 */}
      <T x={356.76} y={119.81} size={9}>주소</T>
      <T x={389.76} y={112.97} size={9} width={144}>{customerAddress ?? "-"}</T>
      <T x={352.32} y={159.17} size={9}>담당자</T>
      <T x={415.2} y={151.25} size={9}>{customerContactPhone ? `Tel : ${customerContactPhone}` : ""}</T>
      <T x={430.44} y={166.97} size={9}>{customerContactName ?? ""}</T>
      <T x={386.28} y={183.41} size={9} bold>출고일 :</T>
      <T x={474.48} y={183.89} size={9} bold>{new Date(orderDate).toLocaleDateString("sv-SE")}</T>

      {/* 품목 헤더 */}
      <T x={107.4} y={213.8} size={9.96} bold>품명</T>
      <T x={209.29} y={213.8} size={9.96} bold>규격</T>
      <TCenter centerX={COL_B_CENTER} y={213.8} size={9.96} bold>수량 (box)</TCenter>
      <T x={488.88} y={213.8} size={9.96} bold>비고</T>

      {/* 품목 대분류(세로 병합) */}
      {groups.map((g) => {
        const groupTop = ROW_TOP0 + g.start * ROW_H;
        const groupHeight = g.count * ROW_H;
        return (
          <TCenter key={g.start} centerX={CATEGORY_CENTER} y={groupTop + groupHeight / 2 - 6} size={9.96}>
            {g.category}
          </TCenter>
        );
      })}

      {/* 품목 행 */}
      {rows.map((row, i) => {
        const y = ROW_TOP0 + i * ROW_H;
        const total = row.basePackageQty != null ? row.quantity * row.basePackageQty : null;
        return (
          <div key={row.id}>
            <T x={SPEC_X} y={y} size={9.96}>{row.spec}</T>
            {row.quantity > 0 && (
              <TCenter centerX={COL_B_CENTER} y={y} size={9.96}>
                {row.quantity.toLocaleString()} {row.unit || "Box"}
              </TCenter>
            )}
            {total != null && total > 0 && (
              <TCenter centerX={COL_C_CENTER} y={y} size={9.96}>
                {total.toLocaleString()}
              </TCenter>
            )}
          </div>
        );
      })}

      {note && (
        <T x={SPEC_X} y={ROW_TOP0 + ROW_COUNT * ROW_H + 4} size={9} width={340}>
          {note}
        </T>
      )}

      {/* 합계 행 */}
      <TCenter centerX={SUM_LABEL_CENTER} y={688.04} size={9.96}>합계</TCenter>
      <TCenter centerX={COL_B_CENTER} y={688.04} size={9.96}>{totalBox.toLocaleString()} Box</TCenter>
      <TCenter centerX={COL_C_CENTER} y={688.52} size={9.96}>{totalEa.toLocaleString()} Ea</TCenter>

      {/* 하단 도장란 */}
      <T x={102.48} y={730.4} size={9.96} bold>공급자</T>
      <TCenter centerX={(159 + 278.64) / 2} y={730.4} size={9.96}>(인)</TCenter>
      {company?.logo_wordmark_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={company.logo_wordmark_url}
          alt=""
          aria-hidden
          className="pointer-events-none opacity-90"
          style={{ position: "absolute", left: pt(158.16), top: pt(729.36), width: pt(87.36), height: pt(17.52) }}
        />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={company?.seal_image_url || "/branding/company-seal.png"}
        alt=""
        aria-hidden
        className="pointer-events-none opacity-90 mix-blend-multiply"
        style={{ position: "absolute", left: pt(243), top: pt(722.88), width: pt(33.12), height: pt(30.24) }}
      />
      <T x={319.08} y={730.4} size={9.96} bold>인수자</T>
      <TCenter centerX={(388.08 + 534.48) / 2} y={730.4} size={9.96}>(인)</TCenter>
    </div>
  );
}
