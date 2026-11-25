"use client";

import { MIN_PASSWORD_LENGTH } from "@/lib/password-policy";
import { useActionState, useEffect, useRef } from "react";
import { changePassword } from "@/app/(dashboard)/settings/password/actions";
import { FormMessage } from "@/components/form-message";
import { SettingsPage, SettingsSaveBar, SettingsSection } from "@/components/erp/settings-section";
import { useKeyShortcut } from "@/lib/use-key-shortcut";

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changePassword, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const submitRef = useRef<HTMLButtonElement>(null);
  useKeyShortcut("F7", submitRef);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction}>
      <SettingsPage>
        <SettingsSection title="비밀번호 변경" hint={`본인 계정의 로그인 비밀번호를 바꿉니다 · ${MIN_PASSWORD_LENGTH}자 이상`}>
          <div className="erp-field erp-span-4">
            <label htmlFor="cp-current">현재 비밀번호</label>
            <input id="cp-current" name="currentPassword" type="password" required className="erp-input" />
          </div>
          <div className="erp-field erp-span-4">
            <label htmlFor="cp-new">새 비밀번호</label>
            <input id="cp-new" name="newPassword" type="password" required minLength={MIN_PASSWORD_LENGTH} className="erp-input" />
          </div>
          <div className="erp-field erp-span-4">
            <label htmlFor="cp-confirm">새 비밀번호 확인</label>
            <input id="cp-confirm" name="confirmPassword" type="password" required minLength={MIN_PASSWORD_LENGTH} className="erp-input" />
          </div>
        </SettingsSection>
        <SettingsSaveBar>
          <button ref={submitRef} type="submit" className="erp-btn erp-btn-primary" disabled={pending}>
            {pending ? "변경 중..." : "F7 비밀번호 변경"}
          </button>
          <FormMessage state={state} />
        </SettingsSaveBar>
      </SettingsPage>
    </form>
  );
}
