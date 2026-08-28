import Link from "next/link";
import { requireAdmin } from "@/lib/require-admin";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { BackupRestoreForm } from "@/components/backup-restore-form";

export default async function BackupSettingsPage() {
  const { isAdmin } = await requireAdmin();

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/dashboard" } }} />
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-lg font-bold text-[var(--erp-text)]">환경설정 &gt; 백업 / 복원</h1>
        <Link href="/dashboard" className="erp-btn erp-btn-danger">
          ESC 닫기
        </Link>
      </div>

      {!isAdmin ? (
        <p className="erp-grid-empty" style={{ marginTop: 24 }}>
          관리자만 접근할 수 있습니다.
        </p>
      ) : (
        <>
          <div className="erp-detail" style={{ marginTop: 12 }}>
            <div className="erp-detail-tabs">
              <span className="erp-detail-tab active">백업하기</span>
            </div>
            <div className="erp-detail-body">
              <p className="mb-3 text-xs" style={{ color: "var(--erp-text-muted)" }}>
                거래처·품목·매출·매입·재고·할일·공지 등 업무 데이터 전체를 JSON 파일 하나로
                내려받습니다. 이 파일은 아래 &ldquo;복원하기&rdquo;에 다시 업로드해 데이터를
                되살리는 용도로 씁니다 — 잘 보관해두세요 (거래처 정보 등 민감한 내용이
                포함되니 공유 금지).
              </p>
              <a href="/api/backup/export" className="erp-btn erp-btn-primary">
                📥 지금 백업 다운로드
              </a>
            </div>
          </div>

          <div className="erp-detail">
            <div className="erp-detail-tabs">
              <span className="erp-detail-tab active">복원하기</span>
            </div>
            <div className="erp-detail-body">
              <p
                className="mb-3 rounded-sm p-2 text-xs"
                style={{
                  background: "var(--erp-info-bg)",
                  color: "var(--erp-info-text)",
                  border: "1px solid var(--erp-info-border)",
                }}
              >
                <strong>안전한 복원입니다.</strong> 백업 파일 안의 데이터 중 지금 DB에 없는
                것만 다시 채워넣습니다 — 실수로 지운 거래처/매출/할일 등을 되살릴 때 쓰세요.
                백업 이후 새로 등록했거나 수정한 데이터는 절대 지워지거나 덮어써지지 않습니다.
              </p>
              <p className="mb-3 text-xs" style={{ color: "var(--erp-text-muted)" }}>
                (DB 전체가 완전히 사라진 재해 상황처럼 백업 시점 그대로 통째로 되돌려야 한다면
                이 기능이 아니라{" "}
                <code style={{ fontSize: 11 }}>docs/db-backup-restore.md</code>의 절차를 씁니다.)
              </p>
              <BackupRestoreForm />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
