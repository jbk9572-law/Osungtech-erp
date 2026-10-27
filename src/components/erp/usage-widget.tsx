import type { VpsDiskUsage } from "@/lib/vps-usage";
import type { NetlifyUsageResult } from "@/lib/netlify-usage";
import {
  FREE_TIER_DB_LIMIT_BYTES,
  FREE_TIER_STORAGE_LIMIT_BYTES,
  FREE_TIER_R2_STORAGE_LIMIT_BYTES,
  R2_STORAGE_OVERAGE_USD_PER_GB,
  R2_FREE_CLASS_A_OPS_PER_MONTH,
  R2_FREE_CLASS_B_OPS_PER_MONTH,
} from "@/lib/db-usage";
import { formatMB } from "@/lib/format-bytes";
import { formatNumber } from "@/lib/format-number";

// 트리메뉴 사이드바 아래에 붙는 DB/스토리지/서버 사용량 표시 — 서버
// 컴포넌트(usage-widget-panel.tsx)에서 데이터를 가져와 렌더링만 여기서
// 한다. 순수 표시 로직이라 "use client" 없이 서버/클라이언트 어느
// 트리에서 렌더링해도 그대로 동작한다.

// tenant-usage-widget.tsx(테넌트 자신의 쿼터 위젯)가 같은 도넛/막대
// 그리기 로직을 재사용할 수 있게 export한다 — 마크업을 복붙하는 대신
// 공용화(개발헌법 3번).
export type UsageRow =
  | { kind: "bar"; label: string; usedBytes: number; limitBytes: number; note: string }
  | { kind: "count-bar"; label: string; usedCount: number; limitCount: number; note: string }
  | { kind: "simple"; label: string; usedBytes: number; note: string };

function barLevelColor(percent: number) {
  const level = percent >= 90 ? "danger" : percent >= 70 ? "warning" : "success";
  return level === "danger" ? "var(--erp-danger)" : level === "warning" ? "var(--erp-warning)" : "var(--erp-success)";
}

export function UsageBar(row: UsageRow) {
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

  // 바이트 단위(DB/파일/R2 저장소)와 횟수 단위(R2 쓰기 호출)가 막대
  // 그리기 로직은 완전히 같고 숫자 포맷(MB vs 회)만 다르다 — 복붙하는
  // 대신 포맷 함수만 분기한다.
  if (row.kind === "count-bar") {
    const { label, usedCount, limitCount, note } = row;
    const percent = Math.min(100, Math.round((usedCount / limitCount) * 100));
    return (
      <div className="erp-tree-usage-row erp-tree-usage-row-bar">
        <div className="erp-tree-usage-label">
          <span>{label}</span>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>{percent}%</span>
        </div>
        <div className="erp-usage-bar-track">
          <div className="erp-usage-bar-fill" style={{ width: `${percent}%`, background: barLevelColor(percent) }} />
        </div>
        <div className="erp-tree-usage-sub">
          {formatNumber(usedCount)}회 / {formatNumber(limitCount)}회 ({note})
        </div>
      </div>
    );
  }

  const { label, usedBytes, limitBytes, note } = row;
  const percent = Math.min(100, Math.round((usedBytes / limitBytes) * 100));

  return (
    <div className="erp-tree-usage-row erp-tree-usage-row-bar">
      <div className="erp-tree-usage-label">
        <span>{label}</span>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>{percent}%</span>
      </div>
      <div className="erp-usage-bar-track">
        <div className="erp-usage-bar-fill" style={{ width: `${percent}%`, background: barLevelColor(percent) }} />
      </div>
      <div className="erp-tree-usage-sub">
        {formatMB(usedBytes)}MB / {formatMB(limitBytes)}MB ({note})
      </div>
    </div>
  );
}

export function UsageWidget({
  dbSizeBytes,
  storageSizeBytes,
  vpsDisk,
  netlifyUsage,
  r2TotalBytes,
  r2ClassAOps,
}: {
  dbSizeBytes: number | null;
  storageSizeBytes: number | null;
  vpsDisk: VpsDiskUsage | null;
  netlifyUsage: NetlifyUsageResult;
  // R2가 연결 안 된 배포(이 값을 아예 안 넘기는 호출부 포함)에서는 행
  // 자체를 숨긴다 — TenantUsageWidget(고객용) 쪽은 이 prop을 아예 안 쓴다.
  r2TotalBytes?: number | null;
  // 쓰기(Class A) 호출횟수 — 업로드/리스트 지점에서 실제로 집계한 이번
  // 달 값(migration 193). 읽기(Class B)는 Presigned URL로 브라우저가
  // R2에 직접 접속해 받아 이 서버를 거치지 않으므로 집계 불가 — 아래
  // 참고 텍스트로만 안내한다.
  r2ClassAOps?: number | null;
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
  if (r2TotalBytes != null) {
    rows.push({
      kind: "bar",
      label: "R2 파일 저장소",
      usedBytes: r2TotalBytes,
      limitBytes: FREE_TIER_R2_STORAGE_LIMIT_BYTES,
      note: `10GB 초과 시 GB당 $${R2_STORAGE_OVERAGE_USD_PER_GB}`,
    });
  }
  if (r2ClassAOps != null) {
    rows.push({
      kind: "count-bar",
      label: "R2 쓰기 호출(Class A)",
      usedCount: r2ClassAOps,
      limitCount: R2_FREE_CLASS_A_OPS_PER_MONTH,
      note: "무료 한도 · 이번 달",
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
      {r2TotalBytes != null && (
        // 읽기(Class B)는 Presigned URL로 브라우저가 R2에 직접 접속해
        // 받는 구조라(src/lib/r2/client.ts의 getR2DownloadUrl) 이 서버를
        // 거치지 않아 실제 호출 횟수를 집계할 방법이 없다 — 막대로
        // 보여주면 "0%"처럼 실제 쓰지도 않은 값을 보여주는 셈이라, 무료
        // 한도만 참고용 텍스트로 보여준다(숫자를 지어내지 않음). 쓰기
        // (Class A)는 위에 실제 집계된 막대로 따로 보여준다.
        <div className="erp-tree-usage-sub">
          R2 읽기(Class B) 무료 한도(참고): 월 {formatNumber(R2_FREE_CLASS_B_OPS_PER_MONTH)}회 — 서명된 URL로 R2에 직접
          접속해 받는 구조라 실제 호출 횟수는 집계할 수 없습니다.
        </div>
      )}
    </div>
  );
}
