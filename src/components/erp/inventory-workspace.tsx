"use client";

import Link from "next/link";
import { useState } from "react";
import { InventoryAdjustForm } from "@/components/inventory-adjust-form";

type InventoryRow = {
  id: string;
  productId: string;
  warehouseId: string;
  sku: string;
  name: string;
  unit: string;
  warehouseName: string;
  quantity: number;
  reorderPoint: number;
};

type Transaction = {
  id: string;
  product_id: string;
  warehouse_id: string;
  type: string;
  quantity: number;
  note: string | null;
  reference: string | null;
  created_at: string;
};

const TYPE_LABEL: Record<string, string> = {
  in: "입고",
  out: "출고",
  adjustment: "조정",
};

export function InventoryWorkspace({
  inventory,
  products,
  warehouses,
  transactions,
  filters,
}: {
  inventory: InventoryRow[];
  products: { id: string; sku: string; name: string }[];
  warehouses: { id: string; name: string }[];
  transactions: Transaction[];
  filters: { warehouseId?: string; q?: string };
}) {
  const [selectedId, setSelectedId] = useState<string | null>(inventory[0]?.id ?? null);
  const [showAdjustForm, setShowAdjustForm] = useState(false);
  const [detailTab, setDetailTab] = useState<"info" | "history">("info");

  const selected = inventory.find((r) => r.id === selectedId) ?? null;
  const history = selected
    ? transactions.filter(
        (t) => t.product_id === selected.productId && t.warehouse_id === selected.warehouseId
      )
    : [];

  return (
    <>
      <form method="get" className="erp-searchbar">
        <div className="erp-field">
          <label>창고</label>
          <select name="warehouseId" defaultValue={filters.warehouseId ?? ""}>
            <option value="">전체</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>
        <div className="erp-field">
          <label>품목명</label>
          <input type="text" name="q" defaultValue={filters.q ?? ""} style={{ width: 160 }} />
        </div>
        <div className="erp-grow" />
        <button type="submit" className="erp-btn erp-btn-primary">
          <svg className="erp-ic" viewBox="0 0 16 16">
            <circle cx="7" cy="7" r="4.5" />
            <line x1="10.3" y1="10.3" x2="14" y2="14" />
          </svg>
          조회 (F5)
        </button>
        <Link href="/inventory" className="erp-btn">
          초기화
        </Link>
      </form>

      <div className="erp-toolbar">
        <button type="button" className="erp-btn" onClick={() => setShowAdjustForm((v) => !v)}>
          <svg className="erp-ic" viewBox="0 0 16 16">
            <line x1="8" y1="2.5" x2="8" y2="13.5" />
            <line x1="2.5" y1="8" x2="13.5" y2="8" />
          </svg>
          재고조정(F2)
        </button>
      </div>

      {showAdjustForm && (
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", background: "var(--panel)" }}>
          <InventoryAdjustForm
            products={products}
            warehouses={warehouses}
            stockLevels={inventory.map((r) => ({
              product_id: r.productId,
              warehouse_id: r.warehouseId,
              quantity: r.quantity,
            }))}
          />
        </div>
      )}

      <div className="erp-grid-wrap">
        <table className="erp-grid">
          <thead>
            <tr>
              <th>품목코드</th>
              <th>품목명</th>
              <th>창고</th>
              <th className="center">단위</th>
              <th className="num">재고수량</th>
              <th className="num">안전재고</th>
              <th className="center">상태</th>
            </tr>
          </thead>
          <tbody>
            {inventory.map((row) => {
              const isLow = row.quantity <= row.reorderPoint;
              return (
                <tr
                  key={row.id}
                  className={row.id === selectedId ? "selected" : ""}
                  onClick={() => setSelectedId(row.id)}
                >
                  <td>{row.sku}</td>
                  <td>{row.name}</td>
                  <td>{row.warehouseName}</td>
                  <td className="center">{row.unit}</td>
                  <td className="num">{row.quantity.toLocaleString()}</td>
                  <td className="num">{row.reorderPoint.toLocaleString()}</td>
                  <td className="center">
                    <span
                      className={`erp-status erp-status-dot ${
                        isLow ? "erp-status-cancelled" : "erp-status-completed"
                      }`}
                    >
                      {isLow ? "재주문 필요" : "정상"}
                    </span>
                  </td>
                </tr>
              );
            })}
            {!inventory.length && (
              <tr>
                <td colSpan={7}>
                  <div className="erp-empty">
                    재고 데이터가 없습니다. 매입 등록 또는 재고 조정 후 표시됩니다.
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="erp-detail">
        <div className="erp-detail-tabs">
          <button
            className={`erp-detail-tab ${detailTab === "info" ? "active" : ""}`}
            onClick={() => setDetailTab("info")}
          >
            재고정보
          </button>
          <button
            className={`erp-detail-tab ${detailTab === "history" ? "active" : ""}`}
            onClick={() => setDetailTab("history")}
          >
            입출고이력
          </button>
        </div>
        <div className="erp-detail-body">
          {!selected ? (
            <div className="erp-empty">선택된 재고 항목이 없습니다.</div>
          ) : detailTab === "info" ? (
            <div className="erp-detail-form">
              <label>품목코드</label>
              <div className="erp-val readonly">{selected.sku}</div>
              <label>품목명</label>
              <div className="erp-val readonly">{selected.name}</div>
              <label>창고</label>
              <div className="erp-val readonly">{selected.warehouseName}</div>
              <label>단위</label>
              <div className="erp-val readonly">{selected.unit}</div>
              <label>재고수량</label>
              <div className="erp-val readonly">{selected.quantity.toLocaleString()}</div>
              <label>안전재고</label>
              <div className="erp-val readonly">{selected.reorderPoint.toLocaleString()}</div>
            </div>
          ) : (
            <div className="erp-grid-wrap" style={{ flex: 1, border: "none" }}>
              <table className="erp-grid">
                <thead>
                  <tr>
                    <th>일시</th>
                    <th className="center">구분</th>
                    <th className="num">수량</th>
                    <th>참조</th>
                    <th>비고</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((t) => (
                    <tr key={t.id}>
                      <td>{new Date(t.created_at).toLocaleString("ko-KR")}</td>
                      <td className="center">{TYPE_LABEL[t.type] ?? t.type}</td>
                      <td className="num">{t.quantity.toLocaleString()}</td>
                      <td>{t.reference || "-"}</td>
                      <td>{t.note || "-"}</td>
                    </tr>
                  ))}
                  {!history.length && (
                    <tr>
                      <td colSpan={5}>
                        <div className="erp-empty">입출고 이력이 없습니다.</div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
