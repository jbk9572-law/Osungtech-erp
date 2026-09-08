"use client";

import { useState, useTransition } from "react";
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
  qrSvg,
  initialDir,
}: {
  productId: string;
  sku: string;
  name: string;
  spec: string | null;
  qrSvg: string;
  initialDir: "up" | "down";
}) {
  const [dir, setDir] = useState<"up" | "down">(initialDir);
  const [, startTransition] = useTransition();

  function choose(next: "up" | "down") {
    setDir(next);
    startTransition(() => {
      setProductLabelDirection(productId, next);
    });
  }

  return (
    <div
      style={{
        border: "1px solid #000",
        borderRadius: 4,
        overflow: "hidden",
        textAlign: "center",
        breakInside: "avoid",
        color: "#000",
      }}
    >
      <div
        style={{
          background: "#000",
          color: "#fff",
          fontWeight: 800,
          fontSize: 14,
          letterSpacing: 1,
          padding: "4px 0",
        }}
      >
        {dir === "up" ? "▲ 위" : "▼ 아래"}
      </div>
      <div style={{ padding: 8 }}>
        <div
          role="img"
          aria-label={sku}
          style={{ width: 110, height: 110, margin: "0 auto" }}
          dangerouslySetInnerHTML={{ __html: qrSvg }}
        />
        <div style={{ fontSize: 12, fontWeight: 700, marginTop: 4 }}>{sku}</div>
        <div style={{ fontSize: 11, lineHeight: 1.3 }}>{name}</div>
        {spec && <div style={{ fontSize: 10, color: "#444" }}>{spec}</div>}
        <div
          className="print:hidden"
          style={{ display: "flex", gap: 4, justifyContent: "center", marginTop: 6 }}
        >
          <button
            type="button"
            onClick={() => choose("up")}
            className="erp-btn"
            style={{
              minWidth: 0,
              height: 24,
              padding: "0 8px",
              fontSize: 11,
              ...(dir === "up" ? { background: "var(--erp-selected)" } : {}),
            }}
          >
            ▲ 위
          </button>
          <button
            type="button"
            onClick={() => choose("down")}
            className="erp-btn"
            style={{
              minWidth: 0,
              height: 24,
              padding: "0 8px",
              fontSize: 11,
              ...(dir === "down" ? { background: "var(--erp-selected)" } : {}),
            }}
          >
            ▼ 아래
          </button>
        </div>
      </div>
    </div>
  );
}
