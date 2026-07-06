"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deletePurchase, updatePurchaseStatus } from "@/app/(dashboard)/purchases/actions";
import {
  ORDER_STATUSES,
  ORDER_STATUS_CLASS,
  ORDER_STATUS_LABEL,
  isOrderStatus,
  type OrderStatus,
} from "@/lib/order-status";

type Item = {
  id: string;
  productName: string;
  unit: string;
  quantity: number;
  unitCost: number;
  amount: number;
};

type Order = {
  id: string;
  purchaseDate: string;
  status: string;
  memo: string | null;
  supplierName: string;
  contactName: string;
  phone: string;
  address: string;
  warehouseName: string;
  supplyAmount: number;
  taxAmount: number;
  totalAmount: number;
  items: Item[];
};

type Supplier = { id: string; name: string };

function orderNo(id: string) {
  return `PO-${id.slice(0, 8).toUpperCase()}`;
}

function StatusBadge({ status }: { status: string }) {
  const s = isOrderStatus(status) ? status : "completed";
  return (
    <span className={`erp-status erp-status-dot ${ORDER_STATUS_CLASS[s]}`}>
      {ORDER_STATUS_LABEL[s]}
    </span>
  );
}

export function PurchasesWorkspace({
  orders,
  suppliers,
  filters,
}: {
  orders: Order[];
  suppliers: Supplier[];
  filters: { from?: string; to?: string; supplierId?: string; status?: string };
}) {
  const [selectedId, setSelectedId] = useState<string | null>(orders[0]?.id ?? null);
  const [detailTab, setDetailTab] = useState<"info" | "items" | "memo">("info");
  const [, startTransition] = useTransition();
  const router = useRouter();

  const selected = orders.find((o) => o.id === selectedId) ?? null;

  function changeStatus(id: string, status: OrderStatus) {
    const fd = new FormData();
    fd.set("id", id);
    fd.set("status", status);
    startTransition(() => {
      updatePurchaseStatus(fd);
    });
  }

  return (
    <>
      <form method="get" className="erp-searchbar">
        <div className="erp-field">
          <label>조회기간</label>
          <input type="date" name="from" defaultValue={filters.from ?? ""} />
          <span className="erp-to">~</span>
          <input type="date" name="to" defaultValue={filters.to ?? ""} />
        </div>
        <div className="erp-field">
          <label>공급업체</label>
          <select name="supplierId" defaultValue={filters.supplierId ?? ""}>
            <option value="">전체</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="erp-field">
          <label>진행상태</label>
          <select name="status" defaultValue={filters.status ?? ""}>
            <option value="">전체</option>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {ORDER_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="erp-grow" />
        <button type="submit" className="erp-btn erp-btn-primary">
          <svg className="erp-ic" viewBox="0 0 16 16">
            <circle cx="7" cy="7" r="4.5" />
            <line x1="10.3" y1="10.3" x2="14" y2="14" />
          </svg>
          조회 (F5)
        </button>
        <Link href="/purchases" className="erp-btn">
          초기화
        </Link>
      </form>

      <div className="erp-toolbar">
        <Link href="/purchases/new" className="erp-btn">
          <svg className="erp-ic" viewBox="0 0 16 16">
            <line x1="8" y1="2.5" x2="8" y2="13.5" />
            <line x1="2.5" y1="8" x2="13.5" y2="8" />
          </svg>
          신규(F2)
        </Link>
        <Link
          href={selected ? `/purchases/${selected.id}` : "#"}
          aria-disabled={!selected}
          className="erp-btn"
          onClick={(e) => !selected && e.preventDefault()}
        >
          상세(F3)
        </Link>
        <Link
          href={selected ? `/purchases/${selected.id}/edit` : "#"}
          aria-disabled={!selected}
          className="erp-btn"
          onClick={(e) => !selected && e.preventDefault()}
        >
          수정(F4)
        </Link>
        <button
          type="button"
          disabled={!selected}
          className="erp-btn erp-btn-danger"
          onClick={() => {
            if (!selected) return;
            if (!confirm("이 발주 건을 삭제하시겠습니까? 재고 수량이 자동으로 되돌아갑니다.")) return;
            const fd = new FormData();
            fd.set("id", selected.id);
            startTransition(async () => {
              await deletePurchase(undefined, fd);
              router.refresh();
            });
          }}
        >
          삭제(F6)
        </button>
      </div>

      <div className="erp-grid-wrap">
        <table className="erp-grid">
          <thead>
            <tr>
              <th>발주번호</th>
              <th>발주일자</th>
              <th>공급업체명</th>
              <th>담당자</th>
              <th>창고</th>
              <th>진행상태</th>
              <th className="num">공급가액</th>
              <th className="num">세액</th>
              <th className="num">합계금액</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr
                key={order.id}
                className={order.id === selectedId ? "selected" : ""}
                onClick={() => setSelectedId(order.id)}
              >
                <td>{orderNo(order.id)}</td>
                <td>{new Date(order.purchaseDate).toLocaleDateString("ko-KR")}</td>
                <td>{order.supplierName}</td>
                <td>{order.contactName}</td>
                <td>{order.warehouseName}</td>
                <td>
                  <StatusBadge status={order.status} />
                </td>
                <td className="num">{order.supplyAmount.toLocaleString()}</td>
                <td className="num">{order.taxAmount.toLocaleString()}</td>
                <td className="num">{order.totalAmount.toLocaleString()}</td>
              </tr>
            ))}
            {!orders.length && (
              <tr>
                <td colSpan={9}>
                  <div className="erp-empty">조건에 맞는 발주 건이 없습니다.</div>
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
            발주정보
          </button>
          <button
            className={`erp-detail-tab ${detailTab === "items" ? "active" : ""}`}
            onClick={() => setDetailTab("items")}
          >
            품목정보
          </button>
          <button
            className={`erp-detail-tab ${detailTab === "memo" ? "active" : ""}`}
            onClick={() => setDetailTab("memo")}
          >
            비고
          </button>
        </div>
        <div className="erp-detail-body">
          {!selected ? (
            <div className="erp-empty">선택된 발주 건이 없습니다.</div>
          ) : (
            <>
              {detailTab === "info" && (
                <div className="erp-detail-form">
                  <label>발주번호</label>
                  <div className="erp-val readonly">{orderNo(selected.id)}</div>
                  <label>발주일자</label>
                  <div className="erp-val readonly">
                    {new Date(selected.purchaseDate).toLocaleDateString("ko-KR")}
                  </div>
                  <label>공급업체</label>
                  <div className="erp-val">{selected.supplierName}</div>
                  <label>담당자</label>
                  <div className="erp-val">{selected.contactName}</div>
                  <label>연락처</label>
                  <div className="erp-val">{selected.phone}</div>
                  <label>창고</label>
                  <div className="erp-val">{selected.warehouseName}</div>
                  <label>진행상태</label>
                  <div className="erp-val" style={{ padding: 0 }}>
                    <select
                      value={isOrderStatus(selected.status) ? selected.status : "completed"}
                      onChange={(e) => changeStatus(selected.id, e.target.value as OrderStatus)}
                      style={{
                        width: "100%",
                        height: "100%",
                        border: "none",
                        background: "transparent",
                        padding: "0 6px",
                      }}
                    >
                      {ORDER_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {ORDER_STATUS_LABEL[s]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <label>주소</label>
                  <div className="erp-val wide">{selected.address}</div>
                </div>
              )}
              {detailTab === "items" && (
                <div className="erp-grid-wrap" style={{ flex: 1, border: "none" }}>
                  <table className="erp-grid">
                    <thead>
                      <tr>
                        <th>품목명</th>
                        <th>단위</th>
                        <th className="num">수량</th>
                        <th className="num">매입단가</th>
                        <th className="num">금액</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.items.map((item) => (
                        <tr key={item.id}>
                          <td>{item.productName}</td>
                          <td className="center">{item.unit}</td>
                          <td className="num">{item.quantity.toLocaleString()}</td>
                          <td className="num">{item.unitCost.toLocaleString()}</td>
                          <td className="num">{item.amount.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {detailTab === "memo" && (
                <div className="erp-detail-form">
                  <label>비고</label>
                  <div className="erp-val wide">{selected.memo || "-"}</div>
                </div>
              )}
              <div className="erp-detail-summary">
                <h4>금액정보</h4>
                <div className="erp-sum-row">
                  <span>공급가액</span>
                  <span className="v">{selected.supplyAmount.toLocaleString()}</span>
                </div>
                <div className="erp-sum-row">
                  <span>세액</span>
                  <span className="v">{selected.taxAmount.toLocaleString()}</span>
                </div>
                <div className="erp-sum-row total">
                  <span>합계금액</span>
                  <span className="v">{selected.totalAmount.toLocaleString()}</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
