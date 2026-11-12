"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { shouldAllowNavigation } from "@/lib/nav-guard";

// 목록 화면의 "F2 신규" 같은 이동 버튼. 빠른 더블클릭으로 같은 주소 이동이 겹쳐 시작되는 것을
// 막는다(lib/nav-guard.ts 참고). F2 키(KeyboardShortcuts)와 같은 보호 장치를 공유한다.
export function GuardedLink({ href, onClick, ...rest }: ComponentProps<typeof Link>) {
  return (
    <Link
      href={href}
      onClick={(e) => {
        if (typeof href === "string" && !shouldAllowNavigation(href)) {
          e.preventDefault();
          return;
        }
        onClick?.(e);
      }}
      {...rest}
    />
  );
}
