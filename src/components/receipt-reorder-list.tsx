"use client";

import { useState, useTransition } from "react";
import { reorderPaymentRequestReceipts } from "@/app/(dashboard)/reports/payment-requests/actions";
import { ReceiptDeleteForm } from "@/components/receipt-delete-form";

type Receipt = { id: string; file_url: string };

// 이미 업로드된 영수증 목록(수정 화면 전용). 화살표로 스테이플러 순서를
// 바꾸고 바로 서버에 저장한다 — 낙관적으로 화면부터 바꾼 뒤 저장한다.
// receipts prop이 실제로 바뀌면(추가/삭제로 새로고침됐을 때) 그때만
// 로컬 순서를 다시 맞춘다(그 사이의 사용자 재정렬은 그대로 유지).
export function ReceiptReorderList({
  paymentRequestId,
  receipts,
}: {
  paymentRequestId: string;
  receipts: Receipt[];
}) {
  const [order, setOrder] = useState(receipts);
  const [knownKey, setKnownKey] = useState(() => receipts.map((r) => r.id).join(","));
  const [isPending, startTransition] = useTransition();

  const receiptsKey = receipts.map((r) => r.id).join(",");
  if (receiptsKey !== knownKey) {
    setKnownKey(receiptsKey);
    setOrder(receipts);
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    setOrder(next);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("payment_request_id", paymentRequestId);
      formData.set("order", JSON.stringify(next.map((r) => r.id)));
      await reorderPaymentRequestReceipts(undefined, formData);
    });
  }

  if (!order.length) return null;

  return (
    <ul className="mb-3 flex flex-wrap gap-3">
      {order.map((receipt, index) => (
        <li
          key={receipt.id}
          className="flex flex-col items-center gap-1 rounded-sm border p-2"
          style={{ borderColor: "var(--erp-border)", width: 108 }}
        >
          <a href={receipt.file_url} target="_blank" rel="noopener noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={receipt.file_url}
              alt={`영수증 ${index + 1}`}
              style={{ width: 88, height: 88, objectFit: "cover", borderRadius: 4 }}
            />
          </a>
          <span className="text-[11px]" style={{ color: "var(--erp-text-muted)" }}>
            #{index + 1}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => move(index, -1)}
              disabled={index === 0 || isPending}
              className="erp-btn"
              style={{ minWidth: 0, height: 22, padding: "1px 6px", fontSize: 11 }}
            >
              ▲
            </button>
            <button
              type="button"
              onClick={() => move(index, 1)}
              disabled={index === order.length - 1 || isPending}
              className="erp-btn"
              style={{ minWidth: 0, height: 22, padding: "1px 6px", fontSize: 11 }}
            >
              ▼
            </button>
          </div>
          <ReceiptDeleteForm id={receipt.id} paymentRequestId={paymentRequestId} />
        </li>
      ))}
    </ul>
  );
}
