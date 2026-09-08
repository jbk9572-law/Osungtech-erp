import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { PageGuide } from "@/components/erp/page-guide";
import { CreateRackForm } from "@/components/create-rack-form";
import { DeleteRackButton } from "@/components/delete-rack-button";

type LocationRow = { id: string; rack: string; tier: number; position: number; code: string };

export default async function InventoryLocationsPage() {
  const supabase = await createClient();

  const [locations, stockRows] = await Promise.all([
    fetchAllRows<LocationRow>((from, to) =>
      supabase.from("locations").select("id, rack, tier, position, code").order("rack").range(from, to),
    ),
    fetchAllRows<{ location_id: string }>((from, to) =>
      supabase.from("inventory_locations").select("location_id").range(from, to),
    ),
  ]);

  const countByLocation = new Map<string, number>();
  for (const row of stockRows) {
    countByLocation.set(row.location_id, (countByLocation.get(row.location_id) ?? 0) + 1);
  }

  const racks = new Map<string, LocationRow[]>();
  for (const loc of locations) {
    const list = racks.get(loc.rack) ?? [];
    list.push(loc);
    racks.set(loc.rack, list);
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-lg font-bold text-[var(--erp-text)]">재고관리 &gt; 보관 위치(랙) 관리</h1>
        <Link href="/inventory" className="erp-btn erp-btn-danger">
          ESC 재고현황으로
        </Link>
      </div>

      <PageGuide>
        랙마다 2단 × 좌우 4자리 위치가 자동으로 만들어집니다. 위치를 누르면 그 자리에 지금 보관 중인
        품목을 등록/수정할 수 있고, 랙 단위로 QR 위치 현황판(A4)을 인쇄할 수 있습니다. QR은 위치에
        고정되어 있어서 품목이나 수량이 바뀌어도 다시 인쇄할 필요가 없습니다.
      </PageGuide>

      <div className="erp-detail" style={{ marginTop: 0, marginBottom: 16 }}>
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">랙 추가</span>
        </div>
        <div className="erp-detail-body">
          <CreateRackForm />
        </div>
      </div>

      {racks.size === 0 && <p className="erp-grid-empty">아직 등록된 랙이 없습니다. 위에서 추가해주세요.</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {[...racks.entries()].map(([rack, locs]) => {
          const byKey = new Map(locs.map((l) => [`${l.tier}-${l.position}`, l]));
          const tiers = [2, 1] as const; // 2단(상단)을 위에, 1단(하단)을 아래에 보여준다.
          return (
            <div
              key={rack}
              className="erp-detail"
              style={{ marginTop: 0, marginBottom: 0 }}
            >
              <div className="erp-detail-tabs" style={{ justifyContent: "space-between" }}>
                <span className="erp-detail-tab active">{rack} 랙</span>
                <div style={{ display: "flex", gap: 8, marginRight: 8 }}>
                  <Link href={`/inventory/locations/${rack}/print`} className="erp-btn">
                    QR 현황판 인쇄 (A4)
                  </Link>
                  <DeleteRackButton rack={rack} />
                </div>
              </div>
              <div className="erp-detail-body">
                {tiers.map((tier) => (
                  <div
                    key={tier}
                    style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}
                  >
                    {[1, 2].map((position) => {
                      const loc = byKey.get(`${tier}-${position}`);
                      if (!loc) return <div key={position} />;
                      const count = countByLocation.get(loc.id) ?? 0;
                      return (
                        <Link
                          key={loc.id}
                          href={`/inventory/locations/${loc.code}`}
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 6,
                            padding: "16px 8px",
                            border: "1px solid var(--erp-border)",
                            borderRadius: 6,
                            background: "#fff",
                            textDecoration: "none",
                          }}
                        >
                          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--erp-text)" }}>
                            {loc.code}
                          </span>
                          <span
                            className={count > 0 ? "erp-badge erp-badge-info" : "erp-badge erp-badge-muted"}
                          >
                            {count > 0 ? `${count}품목 보관 중` : "미지정"}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
