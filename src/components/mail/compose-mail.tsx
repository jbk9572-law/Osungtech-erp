"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { sendMailAction } from "@/app/(dashboard)/mail/actions";
import { useFormRedirect } from "@/lib/use-form-redirect";
import { FormMessage } from "@/components/form-message";
import { RichTextEditor } from "@/components/rich-text-editor-dynamic";
import { FilePickerInput } from "@/components/file-picker-input";

// 전엔 화면 중앙에 뜨는 모달이었다(사용자 지적 — "메일쓰기가 3분할 가장
// 우측에 떠야지 모달로 뜨면 디자인언어가 깨진다") — 메일함/게시판/공지
// 사항 등 다른 3분할 화면들이 전부 "작성"을 erp-split-detail 안에서
// 보여주는 것과 똑같이, 메일쓰기도 같은 자리에 렌더링한다. 이 컴포넌트가
// "use client"인 이유는 그대로다: sendMailAction은 mail/actions.ts에서
// worker-mailer(cloudflare:sockets)를 불러오므로, 서버 컴포넌트인
// mail/page.tsx가 이 모듈 그래프를 직접 끌어들이면 next build가 깨진다
// (official-documents/send-action.ts의 동일한 이유 참고) — 클라이언트
// 컴포넌트에서 서버 액션을 참조로만 쓰는 방식으로 격리한다.
export function ComposeMailForm({ closeHref }: { closeHref: string }) {
  const [state, formAction, pending] = useActionState(sendMailAction, undefined);
  useFormRedirect(state);
  // 공지사항/기안함 등 다른 작성 화면과 같은 리치텍스트 에디터
  // (RichTextEditor) — 예전엔 메일쓰기만 평문 textarea라 본문 서식을
  // 전혀 못 넣었다(사용자 지적: "제목쓰듯이 저렇게 하고... 게시판
  // 에디터랑 같은 에디터를 쓰던가"). hidden input에 HTML을 담아
  // 보내고, 발송 액션 쪽에서 SMTP 멀티파트(html+text)로 나눠 보낸다.
  const [bodyHtml, setBodyHtml] = useState("");

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="erp-field">
        <label htmlFor="cm-to">받는 사람</label>
        <input id="cm-to" name="to" autoComplete="off" required className="erp-input" placeholder="쉼표로 여러 명 구분" />
      </div>
      <div className="erp-field">
        <label htmlFor="cm-cc">참조(선택)</label>
        <input id="cm-cc" name="cc" autoComplete="off" className="erp-input" />
      </div>
      <div className="erp-field">
        <label htmlFor="cm-subject">제목</label>
        <input id="cm-subject" name="subject" autoComplete="off" required className="erp-input" />
      </div>
      <div className="erp-field">
        <label htmlFor="cm-body">내용</label>
        <input type="hidden" name="body" value={bodyHtml} />
        <RichTextEditor id="cm-body" value={bodyHtml} onChange={setBodyHtml} placeholder="내용을 입력하세요..." minHeight={260} />
      </div>
      <div className="erp-field">
        <label htmlFor="cm-attachments">첨부파일(선택)</label>
        <FilePickerInput name="attachments" multiple label="파일 선택" />
      </div>

      <FormMessage state={state} />

      <div className="flex gap-2">
        <button type="submit" className="erp-btn erp-btn-primary" disabled={pending}>
          {pending ? "보내는 중..." : "보내기"}
        </button>
        <Link href={closeHref} className="erp-btn">
          취소
        </Link>
      </div>
    </form>
  );
}
