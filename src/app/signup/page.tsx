"use client";

import { useActionState, useState } from "react";
import Script from "next/script";
import Link from "next/link";
import { signupTenant } from "./actions";
import { useFormRedirect } from "@/lib/use-form-redirect";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

export default function SignupPage() {
  const [state, formAction, pending] = useActionState(signupTenant, undefined);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [password, setPassword] = useState("");
  const [confirmTouched, setConfirmTouched] = useState(false);

  useFormRedirect(state);

  const passwordMismatch = confirmTouched && password.length > 0 && password !== passwordConfirm;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#eef1f5] px-4 py-6">
      {TURNSTILE_SITE_KEY && (
        <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />
      )}
      <div className="flex w-full max-w-[420px] flex-col overflow-hidden rounded-sm border border-[#e2e5eb] bg-white shadow-sm">
        <div className="bg-[#132944] p-6 text-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/branding/logo-mark.png"
            alt=""
            className="h-10 w-10 rounded bg-white object-contain p-1"
          />
          <h1 className="mt-3 text-lg font-bold tracking-tight">회원가입</h1>
          <p className="mt-1 text-xs leading-relaxed text-white/80">
            엘보닉스(ELVONIX) 계정을 만들고 바로 시작하세요.
          </p>
        </div>

        <form
          action={(formData) => {
            if (password !== passwordConfirm) {
              setConfirmTouched(true);
              return;
            }
            formAction(formData);
          }}
          className="flex flex-col gap-3 p-6"
        >
          {/* 허니팟 — 화면에는 안 보이고, 사람은 절대 채우지 않는 입력칸.
              자동가입 봇 중 상당수가 눈에 보이는 필드는 전부 채우려 하므로
              이 값이 채워지면 봇으로 간주한다. */}
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
          />

          <Field label="회사명" name="companyName" placeholder="예: 오성테크" required autoComplete="organization" />
          <Field
            label="회사코드"
            name="slug"
            placeholder="예: osungtech (영문 소문자/숫자/하이픈)"
            required
            pattern="[a-z0-9-]{2,32}"
            autoComplete="off"
            hint="로그인할 때 아이디 앞에 붙는 회사 식별자입니다. 나중에 바꿀 수 없으니 신중하게 정해주세요."
          />
          <Field label="관리자 아이디" name="username" placeholder="로그인에 사용할 아이디" required autoComplete="username" />
          <Field label="이름" name="fullName" placeholder="담당자 성함" required autoComplete="name" />

          <div>
            <label htmlFor="password" className="mb-1 block text-xs font-medium text-[#6b7280]">
              비밀번호
            </label>
            <div className="flex items-stretch gap-1">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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

          <div>
            <label htmlFor="passwordConfirm" className="mb-1 block text-xs font-medium text-[#6b7280]">
              비밀번호 확인
            </label>
            <input
              id="passwordConfirm"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              onBlur={() => setConfirmTouched(true)}
              className="h-[30px] w-full rounded-sm border border-[#e2e5eb] px-2.5 text-sm focus:border-[#132944] focus:shadow-[0_0_0_3px_rgba(19,41,68,0.16)] focus:outline-none"
            />
            {passwordMismatch && <p className="mt-1 text-[11px] text-[#c9302c]">비밀번호가 일치하지 않습니다.</p>}
          </div>

          <Field
            label="연락처 이메일"
            name="contactEmail"
            type="email"
            placeholder="공지/청구 안내를 받을 이메일"
            required
            autoComplete="email"
            hint="로그인에는 쓰이지 않습니다 — 회사코드/아이디로 로그인합니다."
          />

          {TURNSTILE_SITE_KEY && <div className="cf-turnstile" data-sitekey={TURNSTILE_SITE_KEY} />}

          {state?.error && <p className="text-xs text-[#c9302c]">{state.error}</p>}

          <button
            type="submit"
            disabled={pending}
            className="mt-1 h-10 w-full rounded-sm bg-[#132944] text-sm font-semibold text-white hover:bg-[#0d1d30] disabled:opacity-50"
          >
            {pending ? (
              <>
                <span className="erp-spinner" aria-hidden /> 가입 처리 중...
              </>
            ) : (
              "가입하기"
            )}
          </button>

          <p className="text-center text-[11px] text-[#6b7280]">
            가입 시{" "}
            <Link href="/terms" className="underline">
              이용약관
            </Link>
            {" "}및{" "}
            <Link href="/privacy" className="underline">
              개인정보처리방침
            </Link>
            에 동의하는 것으로 간주됩니다.
          </p>

          <p className="text-center text-xs text-[#6b7280]">
            이미 계정이 있으신가요?{" "}
            <Link href="/login" className="font-medium text-[#132944] underline">
              로그인
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  placeholder,
  required,
  type = "text",
  pattern,
  autoComplete,
  hint,
}: {
  label: string;
  name: string;
  placeholder?: string;
  required?: boolean;
  type?: string;
  pattern?: string;
  autoComplete?: string;
  hint?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="mb-1 block text-xs font-medium text-[#6b7280]">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        pattern={pattern}
        autoComplete={autoComplete}
        className="h-[30px] w-full rounded-sm border border-[#e2e5eb] px-2.5 text-sm focus:border-[#132944] focus:shadow-[0_0_0_3px_rgba(19,41,68,0.16)] focus:outline-none"
      />
      {hint && <p className="mt-1 text-[11px] text-[#9aa2b1]">{hint}</p>}
    </div>
  );
}
