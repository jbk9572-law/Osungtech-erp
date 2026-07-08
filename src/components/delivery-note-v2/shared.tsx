import type { ReactNode } from "react";

// 실제 출고증 PDF들을 벡터 좌표 그대로 재현하는 캔버스 컴포넌트들이 공유하는
// 저수준 부품. 모든 좌표/치수는 원본 PDF(595.32 x 841.92pt)에서 PyMuPDF로
// 실측한 값이며 1 단위 = 1pt = 1px로 그대로 사용한다(이 프로젝트의 인쇄
// 페이지 관례).
export const PAGE_W = 595.32;
export const PAGE_H = 841.92;

export const FONT = "'Malgun Gothic', '맑은 고딕', Gulim, '굴림', sans-serif";

// 브라우저 인쇄(page.pdf) 파이프라인은 CSS px를 96dpi 기준으로 72dpi(pt)에
// 매핑해서 0.75배로 줄여버린다. 값 뒤에 "pt" 단위를 직접 붙이면 CSS가
// 물리적 포인트로 그대로 처리해 원본 PDF 좌표와 1:1로 맞는다.
export const pt = (n: number) => `${n}pt`;

// 값이 null/undefined뿐 아니라 빈 문자열("")일 때도 "-"로 보여준다.
// ??만 쓰면 실제 DB에 빈 문자열이 들어있을 때 그냥 빈칸으로 보여서
// 항목 자체가 깨진 것처럼 보이는 문제가 있었다.
export const dash = (v: string | null | undefined) => (v ? v : "-");

export type Company = {
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

export type Geom = { x: number; y: number; w: number; h: number };

export function Fill({ x, y, w, h }: Geom) {
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

export function Line({ x, y, w, h }: Geom) {
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
export function T({
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
export function TCenter({
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
export function TRight({
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
