"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteProduct } from "@/app/(dashboard)/products/actions";

type Product = {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  categoryName: string;
  supplierName: string;
  unit: string;
  price: number;
  cost: number;
  reorderPoint: number;
  isActive: boolean;
  stock: { total: number; byWarehouse: { name: string; quantity: number }[] };
};

type Category = { id: string; name: string };

export function ProductsWorkspace({
  products,
  categories,
  filters,
}: {
  products: Product[];
  categories: Category[];
  filters: { categoryId?: string; q?: string };
}) {
  const [selectedId, setSelectedId] = useState<string | null>(products[0]?.id ?? null);
  const [detailTab, setDetailTab] = useState<"info" | "stock">("info");
  const [, startTransition] = useTransition();
  const router = useRouter();

  const selected = products.find((p) => p.id === selectedId) ?? null;

  return (
    <>
      <form method="get" className="erp-searchbar">
        <div className="erp-field">
          <label>품목분류</label>
          <select name="categoryId" defaultValue={filters.categoryId ?? ""}>
            <option value="">전체</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
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
        <Link href="/products" className="erp-btn">
          초기화
        </Link>
      </form>

      <div className="erp-toolbar">
        <Link href="/products/new" className="erp-btn">
          <svg className="erp-ic" viewBox="0 0 16 16">
            <line x1="8" y1="2.5" x2="8" y2="13.5" />
            <line x1="2.5" y1="8" x2="13.5" y2="8" />
          </svg>
          신규(F2)
        </Link>
        <Link
          href={selected ? `/products/${selected.id}` : "#"}
          aria-disabled={!selected}
          className="erp-btn"
          onClick={(e) => !selected && e.preventDefault()}
        >
          <svg className="erp-ic" viewBox="0 0 16 16">
            <path d="M11 2.5 13.5 5 5.5 13 2.5 13.5 3 10.5Z" />
          </svg>
          수정(F4)
        </Link>
        <button
          type="button"
          disabled={!selected}
          className="erp-btn erp-btn-danger"
          onClick={() => {
            if (!selected) return;
            if (!confirm("이 품목을 삭제하시겠습니까? 관련 매입/매출 내역이 있으면 삭제되지 않습니다.")) return;
            const fd = new FormData();
            fd.set("id", selected.id);
            startTransition(async () => {
              await deleteProduct(undefined, fd);
              router.refresh();
            });
          }}
        >
          <svg className="erp-ic" viewBox="0 0 16 16">
            <line x1="3" y1="4.5" x2="13" y2="4.5" />
            <path d="M5 4.5V3h6v1.5M4.5 4.5 5 13h6l.5-8.5" />
          </svg>
          삭제(F6)
        </button>
      </div>

      <div className="erp-grid-wrap">
        <table className="erp-grid">
          <thead>
            <tr>
              <th>품목코드</th>
              <th>품목명</th>
              <th>규격/설명</th>
              <th>분류</th>
              <th>공급업체</th>
              <th className="center">단위</th>
              <th className="num">판매가</th>
              <th className="num">재고수량</th>
              <th className="num">안전재고</th>
              <th className="center">사용여부</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr
                key={p.id}
                className={p.id === selectedId ? "selected" : ""}
                onClick={() => setSelectedId(p.id)}
              >
                <td>{p.sku}</td>
                <td>{p.name}</td>
                <td>{p.description || "-"}</td>
                <td>{p.categoryName}</td>
                <td>{p.supplierName}</td>
                <td className="center">{p.unit}</td>
                <td className="num">{p.price.toLocaleString()}</td>
                <td className={`num ${p.stock.total <= p.reorderPoint ? "erp-status-cancelled erp-status" : ""}`}>
                  {p.stock.total.toLocaleString()}
                </td>
                <td className="num">{p.reorderPoint.toLocaleString()}</td>
                <td className="center">{p.isActive ? "사용" : "미사용"}</td>
              </tr>
            ))}
            {!products.length && (
              <tr>
                <td colSpan={10}>
                  <div className="erp-empty">등록된 품목이 없습니다.</div>
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
            기본정보
          </button>
          <button
            className={`erp-detail-tab ${detailTab === "stock" ? "active" : ""}`}
            onClick={() => setDetailTab("stock")}
          >
            재고현황
          </button>
        </div>
        <div className="erp-detail-body">
          {!selected ? (
            <div className="erp-empty">선택된 품목이 없습니다.</div>
          ) : detailTab === "info" ? (
            <>
              <div className="erp-detail-form">
                <label>품목코드</label>
                <div className="erp-val readonly">{selected.sku}</div>
                <label>품목명</label>
                <div className="erp-val readonly">{selected.name}</div>
                <label>품목분류</label>
                <div className="erp-val readonly">{selected.categoryName}</div>
                <label>공급업체</label>
                <div className="erp-val readonly">{selected.supplierName}</div>
                <label>단위</label>
                <div className="erp-val readonly">{selected.unit}</div>
                <label>사용여부</label>
                <div className="erp-val readonly">{selected.isActive ? "사용" : "미사용"}</div>
                <label>판매가</label>
                <div className="erp-val readonly">{selected.price.toLocaleString()}</div>
                <label>원가</label>
                <div className="erp-val readonly">{selected.cost.toLocaleString()}</div>
                <label>안전재고</label>
                <div className="erp-val readonly">{selected.reorderPoint.toLocaleString()}</div>
                <label>재고수량</label>
                <div className="erp-val readonly">{selected.stock.total.toLocaleString()}</div>
                <label>규격/설명</label>
                <div className="erp-val wide readonly">{selected.description || "-"}</div>
              </div>
              <div className="erp-detail-photo">
                <h4>품목이미지</h4>
                <div className="erp-photo-box">No Image</div>
              </div>
            </>
          ) : (
            <div className="erp-grid-wrap" style={{ flex: 1, border: "none" }}>
              <table className="erp-grid">
                <thead>
                  <tr>
                    <th>창고</th>
                    <th className="num">재고수량</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.stock.byWarehouse.map((w, i) => (
                    <tr key={i}>
                      <td>{w.name}</td>
                      <td className="num">{w.quantity.toLocaleString()}</td>
                    </tr>
                  ))}
                  {!selected.stock.byWarehouse.length && (
                    <tr>
                      <td colSpan={2}>
                        <div className="erp-empty">창고별 재고 데이터가 없습니다.</div>
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
