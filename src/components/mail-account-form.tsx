"use client";

import { useActionState, useRef, useState } from "react";
import { saveMailAccount, deleteMailAccount, testMailConnection } from "@/app/(dashboard)/settings/mail/actions";
import { FormMessage } from "@/components/form-message";
import { useKeyShortcut } from "@/lib/use-key-shortcut";

type MailAccount = {
  email_address: string;
  display_name: string | null;
  imap_host: string;
  imap_port: number;
  smtp_host: string;
  smtp_port: number;
  username: string;
  last_synced_at: string | null;
  last_sync_error: string | null;
} | null;

export function MailAccountForm({ account }: { account: MailAccount }) {
  const [saveState, saveAction, savePending] = useActionState(saveMailAccount, undefined);
  const [testState, testAction, testPending] = useActionState(testMailConnection, undefined);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteMailAccount, undefined);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const saveRef = useRef<HTMLButtonElement>(null);
  useKeyShortcut("F7", saveRef);

  return (
    <div className="flex flex-col gap-4" style={{ maxWidth: 480 }}>
      <form action={saveAction} className="flex flex-col gap-3">
        <div className="erp-field">
          <label htmlFor="ma-email">이메일 주소</label>
          <input
            id="ma-email"
            name="email_address"
            type="email"
            autoComplete="off"
            defaultValue={account?.email_address ?? ""}
            placeholder="me@company.co.kr"
            required
            className="erp-input"
          />
        </div>
        <div className="erp-field">
          <label htmlFor="ma-display-name">표시 이름(선택)</label>
          <input
            id="ma-display-name"
            name="display_name"
            autoComplete="off"
            defaultValue={account?.display_name ?? ""}
            placeholder="예: 홍길동"
            className="erp-input"
          />
        </div>
        <div className="erp-field">
          <label htmlFor="ma-username">다음 아이디</label>
          <input
            id="ma-username"
            name="username"
            autoComplete="off"
            defaultValue={account?.username ?? ""}
            required
            className="erp-input"
          />
        </div>
        <div className="erp-field">
          <label htmlFor="ma-app-password">앱 비밀번호</label>
          <input
            id="ma-app-password"
            name="app_password"
            type="password"
            autoComplete="new-password"
            placeholder={account ? "변경하지 않으려면 비워두세요" : ""}
            className="erp-input"
          />
        </div>

        <button
          type="button"
          className="erp-btn"
          style={{ alignSelf: "flex-start" }}
          onClick={() => setShowAdvanced((v) => !v)}
        >
          {showAdvanced ? "고급 설정 숨기기 ▲" : "고급 설정(서버 주소) ▼"}
        </button>

        {showAdvanced && (
          <div className="grid grid-cols-2 gap-3">
            <div className="erp-field">
              <label htmlFor="ma-imap-host">IMAP 서버</label>
              <input
                id="ma-imap-host"
                name="imap_host"
                autoComplete="off"
                defaultValue={account?.imap_host ?? "imap.daum.net"}
                className="erp-input"
              />
            </div>
            <div className="erp-field">
              <label htmlFor="ma-imap-port">IMAP 포트</label>
              <input
                id="ma-imap-port"
                name="imap_port"
                type="number"
                autoComplete="off"
                defaultValue={account?.imap_port ?? 993}
                className="erp-input"
              />
            </div>
            <div className="erp-field">
              <label htmlFor="ma-smtp-host">SMTP 서버</label>
              <input
                id="ma-smtp-host"
                name="smtp_host"
                autoComplete="off"
                defaultValue={account?.smtp_host ?? "smtp.daum.net"}
                className="erp-input"
              />
            </div>
            <div className="erp-field">
              <label htmlFor="ma-smtp-port">SMTP 포트</label>
              <input
                id="ma-smtp-port"
                name="smtp_port"
                type="number"
                autoComplete="off"
                defaultValue={account?.smtp_port ?? 465}
                className="erp-input"
              />
            </div>
          </div>
        )}

        <FormMessage state={saveState} />
        <FormMessage state={testState} />

        <div className="flex gap-2">
          <button ref={saveRef} type="submit" className="erp-btn erp-btn-primary" disabled={savePending}>
            {savePending ? "저장 중..." : "F7 저장"}
          </button>
          <button
            type="submit"
            formAction={testAction}
            className="erp-btn"
            disabled={testPending}
          >
            {testPending ? "연결 확인 중..." : "연결 테스트"}
          </button>
        </div>
      </form>

      {account && (
        <div className="rounded-sm border border-[var(--erp-divider)] p-3 text-xs" style={{ color: "var(--erp-text-muted)" }}>
          {account.last_synced_at ? (
            <p>마지막 동기화: {new Date(account.last_synced_at).toLocaleString("ko-KR")}</p>
          ) : (
            <p>아직 동기화한 적이 없습니다. 메일함 화면에서 새로고침해주세요.</p>
          )}
          {account.last_sync_error && (
            <p className="mt-1" style={{ color: "var(--erp-danger)" }}>
              마지막 동기화 오류: {account.last_sync_error}
            </p>
          )}
          <form action={deleteAction} className="mt-2">
            <button type="submit" className="erp-btn erp-btn-danger" disabled={deletePending}>
              {deletePending ? "해제하는 중..." : "연동 해제"}
            </button>
          </form>
          <FormMessage state={deleteState} />
        </div>
      )}
    </div>
  );
}
