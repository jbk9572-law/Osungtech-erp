"use client";

import { useActionState, useEffect, useState } from "react";
import { login } from "./actions";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, undefined);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberEmail, setRememberEmail] = useState(false);
  const [savedEmail, setSavedEmail] = useState("");

  useEffect(() => {
    const stored = window.localStorage.getItem("nest-erp-remember-email");
    if (stored) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from localStorage on mount
      setSavedEmail(stored);
      setRememberEmail(true);
    }
  }, []);

  function handleSubmit(formData: FormData) {
    const email = String(formData.get("email") ?? "");
    if (rememberEmail) {
      window.localStorage.setItem("nest-erp-remember-email", email);
    } else {
      window.localStorage.removeItem("nest-erp-remember-email");
    }
    formAction(formData);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#eef1f5] px-4 py-6">
      <div className="flex w-full max-w-[640px] flex-col overflow-hidden rounded-sm border border-[#e2e5eb] bg-white shadow-sm md:h-[420px] md:w-[640px] md:flex-row">
        <div className="flex flex-col justify-between bg-[#4a6fa5] p-7 text-white md:w-[260px]">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/branding/logo-mark.png"
              alt=""
              className="h-12 w-12 rounded bg-white/10 object-contain p-1"
            />
            <h1 className="mt-4 text-lg font-bold tracking-tight">NEST ERP</h1>
            <p className="mt-2 text-xs leading-relaxed text-white/80">
              Integrated Business
              <br />
              Management Platform
            </p>
          </div>
          <div className="text-[10px] text-white/60">
            <p>Version 1.0</p>
            <p className="mt-1">&copy; {new Date().getFullYear()} 오성테크</p>
          </div>
        </div>

        <div className="flex flex-1 flex-col justify-between p-7">
          <form action={handleSubmit} className="flex flex-1 flex-col justify-center gap-3">
            <div>
              <label htmlFor="email" className="mb-1 block text-xs font-medium text-[#6b7280]">
                아이디
              </label>
              <input
                id="email"
                name="email"
                type="text"
                autoComplete="username"
                required
                defaultValue={savedEmail}
                className="h-[30px] w-full rounded-sm border border-[#e2e5eb] px-2.5 text-sm focus:border-[#4a6fa5] focus:shadow-[0_0_0_3px_rgba(74,111,165,0.16)] focus:outline-none"
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
                  required
                  className="h-[30px] w-full rounded-sm border border-[#e2e5eb] px-2.5 text-sm focus:border-[#4a6fa5] focus:shadow-[0_0_0_3px_rgba(74,111,165,0.16)] focus:outline-none"
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
                checked={rememberEmail}
                onChange={(e) => setRememberEmail(e.target.checked)}
              />
              아이디 저장
            </label>

            {state?.error && <p className="text-xs text-[#c9302c]">{state.error}</p>}

            <button
              type="submit"
              disabled={pending}
              className="h-10 w-full rounded-sm bg-[#4a6fa5] text-sm font-semibold text-white hover:bg-[#35507d] disabled:opacity-50"
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
            <span>NEST ERP v1.0</span>
            <span>&copy; {new Date().getFullYear()} 오성테크</span>
          </div>
        </div>
      </div>
    </div>
  );
}
