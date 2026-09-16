import type { VpsDiskUsage } from "@/lib/vps-usage";
import type { NetlifyUsageResult } from "@/lib/netlify-usage";
import { FREE_TIER_DB_LIMIT_BYTES, FREE_TIER_STORAGE_LIMIT_BYTES } from "@/lib/db-usage";

// 트리메뉴 사이드바 아래에 붙는 DB/스토리지/서버 사용량 표시 — 서버
// 컴포넌트(usage-widget-panel.tsx)에서 데이터를 가져와 렌더링만 여기서
// 한다. 순수 표시 로직이라 "use client" 없이 서버/클라이언트 어느
// 트리에서 렌더링해도 그대로 동작한다.
function formatMB(bytes: number) {
  return (bytes / (1024 * 1024)).toLocaleString(undefined, {
    maximumFractionDigits: 1,
  });
}

type UsageRow =
  | { kind: "bar"; label: string; usedBytes: number; limitBytes: number; note: string }
  | { kind: "simple"; label: string; usedBytes: number; note: string };

function UsageBar(row: UsageRow) {
  if (row.kind === "simple") {
    return (
      <div className="erp-tree-usage-row">
        <div className="erp-tree-usage-label">
          <span>{row.label}</span>
        </div>
        <div className="erp-tree-usage-sub">
          {formatMB(row.usedBytes)}MB ({row.note})
        </div>
      </div>
    );
  }

  const { label, usedBytes, limitBytes, note } = row;
  const percent = Math.min(100, Math.round((usedBytes / limitBytes) * 100));
  const level =
    percent >= 90 ? "danger" : percent >= 70 ? "warning" : "success";
  const barColor =
    level === "danger"
      ? "var(--erp-danger)"
      : level === "warning"
        ? "var(--erp-warning)"
        : "var(--erp-success)";

  return (
    <div className="erp-tree-usage-row erp-tree-usage-row-donut">
      <div
        className="erp-usage-donut"
        style={{ background: `conic-gradient(${barColor} ${percent}%, var(--erp-border) 0)` }}
      >
        <span className="erp-usage-donut-pct">{percent}%</span>
      </div>
      <div className="erp-tree-usage-donut-text">
        <div className="erp-tree-usage-label">
          <span>{label}</span>
        </div>
        <div className="erp-tree-usage-sub">
          {formatMB(usedBytes)}MB / {formatMB(limitBytes)}MB ({note})
        </div>
      </div>
    </div>
  );
}

export function UsageWidget({
  dbSizeBytes,
  storageSizeBytes,
  vpsDisk,
  netlifyUsage,
}: {
  dbSizeBytes: number | null;
  storageSizeBytes: number | null;
  vpsDisk: VpsDiskUsage | null;
  netlifyUsage: NetlifyUsageResult;
}) {
  const rows: UsageRow[] = [];
  if (dbSizeBytes != null) {
    rows.push({
      kind: "bar",
      label: "DB 용량",
      usedBytes: dbSizeBytes,
      limitBytes: FREE_TIER_DB_LIMIT_BYTES,
      note: "무료플랜",
    });
  }
  if (storageSizeBytes != null) {
    rows.push({
      kind: "bar",
      label: "파일저장",
      usedBytes: storageSizeBytes,
      limitBytes: FREE_TIER_STORAGE_LIMIT_BYTES,
      note: "무료플랜",
    });
  }
  if (vpsDisk != null) {
    rows.push({
      kind: "bar",
      label: "서버 디스크",
      usedBytes: vpsDisk.usedBytes,
      limitBytes: vpsDisk.totalBytes,
      note: "USD $5 플랜",
    });
  }
  // 넷리파이 배포본에는 실제 서버 디스크가 없어서, 대신 넷리파이 계정의
  // 대역폭(bandwidth) 사용량을 보여준다(NETLIFY_API_TOKEN 설정 시에만).
  // 2025년 9월 이후 신규 계정은 크레딧제라 고정 한도(included)가 없어서
  // (API가 null로 내려줌) 이 경우엔 퍼센트 막대 없이 사용량만 보여준다.
  //
  // 이 크레딧제에서는 대역폭뿐 아니라 배포(Production deploys)·컴퓨트
  // (Compute)·요청 수(Web requests)도 같은 크레딧 풀(무료 플랜 월 300개)을
  // 나눠쓴다 — 실측 기준 배포 1회가 약 15크레딧으로 대역폭보다 훨씬 크게
  // 소모된다. 넷리파이 공개 API(openapi 스펙 기준, 2026-08 확인)에는 계정
  // 전체 잔여 크레딧을 돌려주는 엔드포인트가 없어서(대역폭만 조회 가능),
  // 여기서는 대역폭만 보여줄 수 있다 — 전체 크레딧 잔량은 넷리파이 대시보드
  // Billing 화면에서 직접 확인해야 한다는 걸 note에 명시해 오해를 막는다.
  if (netlifyUsage.usage != null) {
    if (netlifyUsage.usage.includedBytes != null) {
      rows.push({
        kind: "bar",
        label: "넷리파이 대역폭",
        usedBytes: netlifyUsage.usage.usedBytes,
        limitBytes: netlifyUsage.usage.includedBytes,
        note: "무료플랜",
      });
    } else {
      rows.push({
        kind: "simple",
        label: "넷리파이 대역폭",
        usedBytes: netlifyUsage.usage.usedBytes,
        note: "크레딧제 - 대역폭 외 배포/컴퓨트도 크레딧 소모, 전체 잔량은 대시보드에서 확인",
      });
    }
  }

  if (!rows.length && !netlifyUsage.error) return null;

  return (
    <div className="erp-tree-usage">
      {rows.map((row) => (
        <UsageBar key={row.label} {...row} />
      ))}
      {netlifyUsage.error && (
        <div
          className="erp-tree-usage-sub"
          style={{ color: "var(--erp-danger)" }}
        >
          넷리파이 사용량 조회 실패: {netlifyUsage.error}
        </div>
      )}
    </div>
  );
}
