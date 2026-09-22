"use client";

import { Suspense, useActionState, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { login } from "./actions";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

const REMEMBER_KEY = "nest-erp-remember-login";

function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const [state, formAction, pending] = useActionState(login, undefined);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberLogin, setRememberLogin] = useState(false);
  const [savedCompanyCode, setSavedCompanyCode] = useState("");
  const [savedUsername, setSavedUsername] = useState("");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(REMEMBER_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as { companyCode?: string; username?: string };
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from localStorage on mount
        setSavedCompanyCode(parsed.companyCode ?? "");
        setSavedUsername(parsed.username ?? "");
        setRememberLogin(true);
      }
    } catch {
      // 손상된 값은 무시 — 그냥 빈 폼으로 시작한다.
    }
  }, []);

  function handleSubmit(formData: FormData) {
    const companyCode = String(formData.get("companyCode") ?? "");
    const username = String(formData.get("username") ?? "");
    if (rememberLogin) {
      window.localStorage.setItem(REMEMBER_KEY, JSON.stringify({ companyCode, username }));
    } else {
      window.localStorage.removeItem(REMEMBER_KEY);
    }
    formAction(formData);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#eef1f5] px-4 py-6">
      <div className="flex w-full max-w-[640px] flex-col overflow-hidden rounded-sm border border-[#e2e5eb] bg-white shadow-sm md:h-[460px] md:w-[640px] md:flex-row">
        <div className="flex flex-col justify-between bg-[#132944] p-7 text-white md:w-[260px]">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/branding/logo-mark.png"
              alt=""
              className="h-12 w-12 rounded bg-white object-contain p-1"
            />
            <h1 className="mt-4 text-lg font-bold tracking-tight">ELVONIX</h1>
            <p className="mt-2 text-xs leading-relaxed text-white/80">
              Integrated Business
              <br />
              Management Platform
            </p>
          </div>
          <div className="text-[10px] text-white/60">
            <p>Version 1.0</p>
            <p className="mt-1">&copy; {new Date().getFullYear()} ELVONIX</p>
          </div>
        </div>

        <div className="flex flex-1 flex-col justify-between p-7">
          <form action={handleSubmit} className="flex flex-1 flex-col justify-center gap-3">
            {next && <input type="hidden" name="next" value={next} />}
            <div>
              <label htmlFor="companyCode" className="mb-1 block text-xs font-medium text-[#6b7280]">
                회사코드
              </label>
              <input
                id="companyCode"
                name="companyCode"
                type="text"
                autoComplete="organization"
                required
                defaultValue={savedCompanyCode}
                placeholder="예: osungtech"
                className="h-[30px] w-full rounded-sm border border-[#e2e5eb] px-2.5 text-sm focus:border-[#132944] focus:shadow-[0_0_0_3px_rgba(19,41,68,0.16)] focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="username" className="mb-1 block text-xs font-medium text-[#6b7280]">
                아이디
              </label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                defaultValue={savedUsername}
                className="h-[30px] w-full rounded-sm border border-[#e2e5eb] px-2.5 text-sm focus:border-[#132944] focus:shadow-[0_0_0_3px_rgba(19,41,68,0.16)] focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="password" className="mb-1 block text-xs font-medium text-[#6b7280]">
                비밀번호
              </label>
              <div className="flex items-stretch gap-1">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  className="h-[30px] w-full rounded-sm border border-[#e2e5eb] px-2.5 text-sm focus:border-[#132944] focus:shadow-[0_0_0_3px_rgba(19,41,68,0.16)] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="shrink-0 rounded-sm border border-[#e2e5eb] px-2 text-xs text-[#6b7280] hover:bg-[#eef2f7]"
                >
                  {showPassword ? "숨김" : "표시"}
                </button>
              </div>
            </div>

            <label className="flex items-center gap-1.5 text-xs text-[#6b7280]">
              <input
                type="checkbox"
                checked={rememberLogin}
                onChange={(e) => setRememberLogin(e.target.checked)}
              />
              회사코드/아이디 저장
            </label>

            {state?.error && <p className="text-xs text-[#c9302c]">{state.error}</p>}

            <button
              type="submit"
              disabled={pending}
              className="h-10 w-full rounded-sm bg-[#132944] text-sm font-semibold text-white hover:bg-[#0d1d30] disabled:opacity-50"
            >
              {pending ? (
                <>
                  <span className="erp-spinner" aria-hidden /> 로그인 중...
                </>
              ) : (
                "로그인"
              )}
            </button>
          </form>

          <div className="flex justify-between border-t border-[#eef0f3] pt-2 text-[10px] text-[#6b7280]">
            <span>ELVONIX v1.0</span>
            <span className="flex gap-2">
              <Link href="/terms" className="underline">
                이용약관
              </Link>
              <Link href="/privacy" className="underline">
                개인정보처리방침
              </Link>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
