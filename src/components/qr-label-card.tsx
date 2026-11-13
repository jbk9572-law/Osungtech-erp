"use client";

import { useEffect, useState, useTransition } from "react";
import QRCode from "qrcode";
import { setProductLabelDirection } from "@/app/(dashboard)/inventory/qr-labels/actions";

// 2단랙에서 품목마다 원래 두는 칸(위/아래)이 다르고 인쇄할 때마다 섞여서
// 나오기 때문에, 페이지 전체에 한 방향을 적용하는 대신 라벨 하나하나
// 직접 위/아래를 골라서 인쇄한다. 처음엔 화면에서만 유지하고 저장하지
// 않았는데, 새로고침마다 다시 골라야 하는 게 번거롭다는 피드백으로
// 품목 레코드에 저장해 다음에 열어도 유지되게 바꿨다 — 등록 시
// 카테고리 기준(Filter는 아래, 나머지는 위) 기본값이 들어가고, 여기서
// 바꾸면 그 값이 새 기본값이 된다.
export function QrLabelCard({
  productId,
  sku,
  name,
  spec,
  initialDir,
}: {
  productId: string;
  sku: string;
  name: string;
  spec: string | null;
  initialDir: "up" | "down";
}) {
  const [dir, setDir] = useState<"up" | "down">(initialDir);
  const [, startTransition] = useTransition();
  // QR SVG는 각자 브라우저에서 만든다 — 예전엔 서버에서 품목 전체(수백 개)
  // 분량을 한 요청 안에서 전부 만들어 보냈는데(toDataURL PNG 시절), SVG로
  // 바꾼 뒤로도 여전히 "요청 하나가 라벨 수백 장을 다 만든다"는 구조
  // 자체는 그대로라 품목이 많아지면 Cloudflare Workers 요청당 CPU 한도를
  // 넘길 수 있었다 — 각 카드가 자기 SKU 하나만 클라이언트에서 만들면
  // 서버 요청은 순수 데이터만 내려주면 되고, 카드 수백 장의 QR 생성
  // 비용은 서버가 아니라 보고 있는 사람 브라우저에 나눠진다.
  const [qrSvg, setQrSvg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toString(sku, { type: "svg", width: 110, margin: 1 }).then((svg) => {
      if (!cancelled) setQrSvg(svg);
    });
    return () => {
      cancelled = true;
    };
  }, [sku]);

  function choose(next: "up" | "down") {
    setDir(next);
    startTransition(() => {
      setProductLabelDirection(productId, next);
    });
  }

  return (
    <div className="erp-u-text-center erp-u-radius-0 erp-u-overflow-hidden"
      style={{ border: "1px solid #000", breakInside: "avoid", color: "#000" }}
    >
      <div className="erp-u-text-lg"
        style={{ background: "#000", color: "#fff", fontWeight: 800, letterSpacing: 1, padding: "4px 0" }}
      >
        {dir === "up" ? "▲ 위" : "▼ 아래"}
      </div>
      <div className="erp-u-p-8">
        <div className="erp-u-mx-auto"
          role="img"
          aria-label={sku}
          style={{ width: 110, height: 110 }}
          dangerouslySetInnerHTML={qrSvg ? { __html: qrSvg } : undefined}
        />
        <div className="erp-u-bold erp-u-text-compact erp-u-mt-4">{sku}</div>
        <div className="erp-u-text-caption" style={{ lineHeight: 1.3 }}>{name}</div>
        {spec && <div style={{ fontSize: 10, color: "#444" }}>{spec}</div>}
        <div
          className="print:hidden erp-u-flex erp-u-gap-4 erp-u-justify-center erp-u-mt-6"
        >
          <button
            type="button"
            onClick={() => choose("up")}
            className="erp-btn erp-btn-xs erp-u-minw-0 erp-u-text-caption"
            style={{ ...(dir === "up" ? { background: "var(--erp-selected)" } : {}) }}
          >
            ▲ 위
          </button>
          <button
            type="button"
            onClick={() => choose("down")}
            className="erp-btn erp-btn-xs erp-u-minw-0 erp-u-text-caption"
            style={{ ...(dir === "down" ? { background: "var(--erp-selected)" } : {}) }}
          >
            ▼ 아래
          </button>
        </div>
      </div>
    </div>
  );
}
