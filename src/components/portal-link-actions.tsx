"use client";

import { useState } from "react";
import { copyText } from "@/lib/clipboard";

// 포털 주소 옆의 [포털 사이트 열기]·[주소 복사] — 주소는 서버(PortalLinkBar)가 계산해 넘긴다.
export function PortalLinkActions({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <span className="erp-portal-link-actions">
      <button
        type="button"
        className="erp-btn erp-btn-sm"
        onClick={async () => {
          await copyText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        }}
      >
        {copied ? "복사됨 ✓" : "주소 복사"}
      </button>
      <a className="erp-btn erp-btn-sm erp-btn-primary" href={url} target="_blank" rel="noopener noreferrer">
        포털 사이트 열기 ↗
      </a>
    </span>
  );
}
