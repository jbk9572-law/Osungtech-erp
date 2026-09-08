import Link from "next/link";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { matchesSearch } from "@/lib/search-match";
import { PrintButton } from "@/components/print-button";
import { PageGuide } from "@/components/erp/page-guide";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { QrLabelCard } from "@/components/qr-label-card";

// 라벨 하나에 넣는 QR은 SKU 문자열 그대로를 인코딩한다 — 관리번호처럼
// 대문자/무공백 규칙이 있는 값이 아니라 이미 유일성이 보장된 SKU라서
// 별도 정규화 없이 그대로 쓴다. QR 자동실사 화면(qr-count-scan.ts)이
// 스캔한 문자열을 SKU로 그대로 조회하므로 여기서 인코딩하는 값과
// 정확히 같아야 한다.
export default async function InventoryQrLabelsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; hideZero?: string }>;
}) {
  const { q, hideZero: hideZeroRaw } = await searchParams;
  const hideZero = hideZeroRaw === "1";
  const supabase = await createClient();

  const products = await fetchAllRows<{
    id: string;
    sku: string;
    name: string;
    spec: string | null;
    label_direction: string;
    categories: { name: string } | null;
    inventory: { quantity: number }[];
  }>((from, to) =>
    supabase
      .from("products")
      .select("id, sku, name, spec, label_direction, categories(name), inventory(quantity)")
      .order("name")
      .range(from, to),
  );

  const keyword = q?.trim().toLowerCase();
  const filtered = products
    .filter((p) => !keyword || matchesSearch(keyword, p.sku, p.name, p.spec, p.categories?.name))
    // 매입 즉시 그 자리에서 매출로 나가고 창고에 안 들어오는 품목이
    // 절반 이상이라, 그런 품목까지 매번 라벨 인쇄 목록에 다 뜨면 실제로
    // 붙일 실물이 없는 라벨을 골라내는 게 더 번거롭다 — 현재 재고가
    // 0인 품목은 체크박스로 숨길 수 있게 한다.
    .filter((p) => !hideZero || (p.inventory?.[0]?.quantity ?? 0) > 0);

  // PNG(toDataURL)는 픽셀을 래스터화하고 다시 압축 인코딩하는 과정이 있어
  // 품목이 많아지면(수백 개) 요청 하나당 CPU 사용량이 급격히 늘어난다 —
  // 넷리파이에서는 문제없었지만 클라우드플레어 Workers는 요청당 CPU 시간
  // 상한이 훨씬 빡빡해서 "Worker exceeded resource limits"로 죽었다. SVG는
  // QR 매트릭스를 그대로 벡터 도형으로만 뽑아내 훨씬 가볍다.
  const labels = await Promise.all(
    filtered.map(async (p) => ({
      ...p,
      qrSvg: await QRCode.toString(p.sku, { type: "svg", width: 110, margin: 1 }),
    })),
  );

  return (
    <div className="print-page-margin">
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/inventory" } }} />
      <div className="mb-3 flex items-center justify-between print:hidden">
        <h1 className="text-lg font-bold text-[var(--erp-text)]">재고관리 &gt; QR 라벨 인쇄</h1>
      </div>
      <PageGuide className="print:hidden">
        아래 라벨을 인쇄해서 품목/박스에 붙이면, QR 자동실사 화면에서 스캔으로 바로 인식됩니다.
      </PageGuide>

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
        <div className="erp-field" style={{ justifyContent: "flex-end" }}>
          <label aria-hidden="true">&nbsp;</label>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              height: 34,
              fontSize: 12.5,
              cursor: "pointer",
            }}
          >
            <input type="checkbox" name="hideZero" value="1" defaultChecked={hideZero} />
            0건인 품목은 보지 않기
          </label>
        </div>
        <button type="submit" className="erp-btn erp-btn-primary">
          조회
        </button>
        {(q || hideZero) && (
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
        <Link href="/inventory/locations" className="erp-btn">
          보관 위치 QR 관리
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
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 16,
          marginTop: 12,
        }}
      >
        {labels.map((label) => (
          <QrLabelCard
            key={label.id}
            productId={label.id}
            sku={label.sku}
            name={label.name}
            spec={label.spec}
            qrSvg={label.qrSvg}
            initialDir={label.label_direction === "down" ? "down" : "up"}
          />
        ))}
      </div>
    </div>
  );
}
