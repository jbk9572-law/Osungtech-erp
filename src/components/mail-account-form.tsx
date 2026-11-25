"use client";

import { formatKstDateTime } from "@/lib/kst-date";
import { useActionState, useRef, useState } from "react";
import { saveMailAccount, deleteMailAccount, testMailConnection } from "@/app/(dashboard)/settings/mail/actions";
import { FormMessage } from "@/components/form-message";
import { useKeyShortcut } from "@/lib/use-key-shortcut";
import { SettingsPage, SettingsSaveBar, SettingsSection } from "@/components/erp/settings-section";

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
    <>
      <form action={saveAction}>
        <SettingsPage>
          <SettingsSection title="계정" hint="다음 스마트워크 계정 — 앱 비밀번호는 암호화되어 저장됩니다">
          <div className="erp-field erp-span-6">
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
          <div className="erp-field erp-span-6">
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
          <div className="erp-field erp-span-6">
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
          <div className="erp-field erp-span-6">
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
          </SettingsSection>

          <SettingsSection title="서버 주소" hint="기본값(다음 서버)을 바꿀 때만 엽니다">
            <div className="erp-field erp-span-12">
              <button type="button" className="erp-btn erp-u-self-start" onClick={() => setShowAdvanced((v) => !v)}>
                {showAdvanced ? "고급 설정 숨기기 ▲" : "고급 설정(서버 주소) ▼"}
              </button>
            </div>
            {showAdvanced && (
              <>
          <div className="erp-field erp-span-8">
            <label htmlFor="ma-imap-host">IMAP 서버</label>
            <input
              id="ma-imap-host"
              name="imap_host"
              autoComplete="off"
              defaultValue={account?.imap_host ?? "imap.daum.net"}
              className="erp-input"
            />
          </div>
          <div className="erp-field erp-span-4">
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
          <div className="erp-field erp-span-8">
            <label htmlFor="ma-smtp-host">SMTP 서버</label>
            <input
              id="ma-smtp-host"
              name="smtp_host"
              autoComplete="off"
              defaultValue={account?.smtp_host ?? "smtp.daum.net"}
              className="erp-input"
            />
          </div>
          <div className="erp-field erp-span-4">
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
              </>
            )}
          </SettingsSection>

          <SettingsSaveBar>
            <button ref={saveRef} type="submit" className="erp-btn erp-btn-primary" disabled={savePending}>
              {savePending ? "저장 중..." : "F7 저장"}
            </button>
            <button type="submit" formAction={testAction} className="erp-btn" disabled={testPending}>
              {testPending ? "연결 확인 중..." : "연결 테스트"}
            </button>
            <FormMessage state={saveState} />
            <FormMessage state={testState} />
          </SettingsSaveBar>
        </SettingsPage>
      </form>

      {account && (
        <SettingsPage>
          <SettingsSection title="연동 상태" hint="마지막 동기화 결과">
            <div className="erp-field erp-span-12">
              {account.last_synced_at ? (
                <p className="erp-u-text-sm">마지막 동기화: {formatKstDateTime(account.last_synced_at)}</p>
              ) : (
                <p className="erp-u-text-sm">아직 동기화한 적이 없습니다. 메일함 화면에서 새로고침해주세요.</p>
              )}
              {account.last_sync_error && <p className="erp-u-danger erp-u-text-sm">마지막 동기화 오류: {account.last_sync_error}</p>}
            </div>
          </SettingsSection>
          <SettingsSection title="연동 해제" hint="연동을 끊으면 메일함 동기화가 멈춥니다" danger>
            <div className="erp-field erp-span-12">
              <form action={deleteAction}>
                <button type="submit" className="erp-btn erp-btn-danger" disabled={deletePending}>
                  {deletePending ? "해제하는 중..." : "연동 해제"}
                </button>
              </form>
              <FormMessage state={deleteState} />
            </div>
          </SettingsSection>
        </SettingsPage>
      )}
    </>
  );
}
