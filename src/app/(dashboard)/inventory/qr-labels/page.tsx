import Link from "next/link";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { matchesSearch } from "@/lib/search-match";
import { PrintButton } from "@/components/print-button";

// 라벨 하나에 넣는 QR은 SKU 문자열 그대로를 인코딩한다 — 관리번호처럼
// 대문자/무공백 규칙이 있는 값이 아니라 이미 유일성이 보장된 SKU라서
// 별도 정규화 없이 그대로 쓴다. QR 자동실사 화면(qr-count-scan.ts)이
// 스캔한 문자열을 SKU로 그대로 조회하므로 여기서 인코딩하는 값과
// 정확히 같아야 한다.
export default async function InventoryQrLabelsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supabase = await createClient();

  const products = await fetchAllRows<{
    id: string;
    sku: string;
    name: string;
    spec: string | null;
    categories: { name: string } | null;
  }>((from, to) =>
    supabase
      .from("products")
      .select("id, sku, name, spec, categories(name)")
      .order("name")
      .range(from, to),
  );

  const keyword = q?.trim().toLowerCase();
  const filtered = keyword
    ? products.filter((p) => matchesSearch(keyword, p.sku, p.name, p.spec, p.categories?.name))
    : products;

  const labels = await Promise.all(
    filtered.map(async (p) => ({
      ...p,
      qrDataUrl: await QRCode.toDataURL(p.sku, { width: 160, margin: 1 }),
    })),
  );

  return (
    <div>
      <div className="mb-3 flex items-center justify-between print:hidden">
        <h1 className="text-lg font-bold text-[var(--erp-text)]">재고관리 &gt; QR 라벨 인쇄</h1>
      </div>
      <p className="mb-4 text-xs text-[var(--erp-text-muted)] print:hidden">
        아래 라벨을 인쇄해서 품목/박스에 붙이면, QR 자동실사 화면에서 스캔으로 바로 인식됩니다.
      </p>

      <form method="get" className="erp-search print:hidden">
        <div className="erp-field" style={{ minWidth: 220, flex: 1 }}>
          <label htmlFor="search-q">품목 검색 (비워두면 전체 품목)</label>
          <input
            id="search-q"
            type="text"
            name="q"
            autoComplete="off"
            defaultValue={q ?? ""}
            placeholder="상품명, SKU, 규격, 카테고리"
            className="erp-input"
            style={{ width: "100%" }}
          />
        </div>
        <button type="submit" className="erp-btn erp-btn-primary">
          조회
        </button>
        {q && (
          <Link href="/inventory/qr-labels" className="erp-btn">
            초기화
          </Link>
        )}
      </form>

      <div className="erp-toolbar print:hidden">
        <PrintButton autoPrint={false} />
        <Link href="/inventory/count/scan" className="erp-btn">
          QR 자동실사 화면으로
        </Link>
        <Link href="/inventory" className="erp-btn erp-btn-danger">
          ESC 목록으로
        </Link>
      </div>

      {!labels.length && (
        <p className="erp-grid-empty" style={{ marginTop: 12 }}>
          조건에 맞는 품목이 없습니다.
        </p>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 10,
          marginTop: 12,
        }}
      >
        {labels.map((label) => (
          <div
            key={label.id}
            style={{
              border: "1px solid #000",
              borderRadius: 4,
              padding: 8,
              textAlign: "center",
              breakInside: "avoid",
              color: "#000",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- data: URL, next/image 최적화 대상이 아님 */}
            <img
              src={label.qrDataUrl}
              alt={label.sku}
              width={110}
              height={110}
              style={{ margin: "0 auto" }}
            />
            <div style={{ fontSize: 12, fontWeight: 700, marginTop: 4 }}>{label.sku}</div>
            <div style={{ fontSize: 11, lineHeight: 1.3 }}>{label.name}</div>
            {label.spec && (
              <div style={{ fontSize: 10, color: "#444" }}>{label.spec}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
