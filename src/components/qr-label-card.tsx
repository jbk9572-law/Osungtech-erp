"use client";

import { useState } from "react";

// 2단랙에서 품목마다 원래 두는 칸(위/아래)이 다르고 인쇄할 때마다 섞여서
// 나오기 때문에, 페이지 전체에 한 방향을 적용하는 대신 라벨 하나하나
// 직접 위/아래를 골라서 인쇄한다. 선택 상태는 저장하지 않고(매번 새로
// 고름) 화면에서만 유지한다.
export function QrLabelCard({
  sku,
  name,
  spec,
  qrSvg,
}: {
  sku: string;
  name: string;
  spec: string | null;
  qrSvg: string;
}) {
  const [dir, setDir] = useState<"up" | "down">("up");

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
            onClick={() => setDir("up")}
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
            onClick={() => setDir("down")}
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
