"use client";

import { forwardRef, useEffect, useImperativeHandle } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";

export type RichTextEditorHandle = {
  // 병합필드 삽입 버튼처럼, 외부에서 지금 커서 위치에 텍스트를 끼워
  // 넣어야 할 때 쓴다(document-template-form.tsx의 "자동 필드 삽입"
  // 버튼 참고).
  insertText: (text: string) => void;
};

type Props = {
  id?: string;
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
};

// 문서 양식(document_templates.body)/공문 본문(official_documents.body)을
// 순수 텍스트가 아니라 실제 서식(굵게/제목/목록 등)이 있는 문서처럼
// 작성할 수 있게 하는 공용 리치텍스트 에디터. Tiptap(ProseMirror
// 기반)을 쓴다 — 에디터가 만들어내는 HTML이 자체 스키마로 제한돼 있어
// (임의 <script> 태그 등을 붙여넣거나 입력할 방법이 없음) 직접
// contentEditable/innerHTML을 다루는 것보다 안전하다.
//
// 값은 HTML 문자열로 오간다(editor.getHTML()) — {{field_name}} 같은
// 병합필드 토큰은 그냥 일반 텍스트로 취급되므로 lib/document-template.ts의
// 정규식 기반 추출/치환 로직이 그대로 동작한다(HTML 태그에 둘러싸여
// 있어도 정규식 매칭에는 영향 없음).
export const RichTextEditor = forwardRef<RichTextEditorHandle, Props>(function RichTextEditor(
  { id, value, onChange, placeholder, minHeight = 220 },
  ref,
) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Placeholder.configure({ placeholder: placeholder ?? "" }),
    ],
    content: value,
    // Next.js는 클라이언트 컴포넌트도 서버에서 먼저 렌더링하는데,
    // Tiptap은 그 시점에 에디터를 즉시 만들면 하이드레이션 결과가
    // 어긋난다고 경고한다 — 마운트 후에만 만들게 한다.
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: "erp-richtext-content",
        ...(id ? { id } : {}),
      },
    },
  });

  // 저장 성공 후 폼이 리셋되거나, 병합필드 값이 바뀌어 상위에서 body를
  // 다시 계산해 넘기는 경우(official-document-form.tsx의 템플릿 미리보기)
  // 등, 사용자가 직접 타이핑한 게 아닌 외부 변경을 에디터에도 반영한다.
  useEffect(() => {
    if (!editor) return;
    if (editor.getHTML() !== value) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [value, editor]);

  useImperativeHandle(
    ref,
    () => ({
      insertText: (text: string) => {
        editor?.chain().focus().insertContent(text).run();
      },
    }),
    [editor],
  );

  if (!editor) {
    return <div className="erp-richtext-content" style={{ minHeight }} />;
  }

  function ToolbarButton({
    active,
    onClick,
    label,
    title,
  }: {
    active?: boolean;
    onClick: () => void;
    label: string;
    title: string;
  }) {
    return (
      <button
        type="button"
        title={title}
        onClick={onClick}
        className="erp-richtext-toolbar-btn"
        data-active={active ? "1" : undefined}
      >
        {label}
      </button>
    );
  }

  return (
    <div className="erp-richtext">
      <div className="erp-richtext-toolbar">
        <ToolbarButton
          label="굵게"
          title="굵게 (Ctrl+B)"
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        />
        <ToolbarButton
          label="기울임"
          title="기울임 (Ctrl+I)"
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        />
        <ToolbarButton
          label="밑줄"
          title="밑줄 (Ctrl+U)"
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        />
        <span className="erp-richtext-toolbar-sep" />
        <ToolbarButton
          label="제목1"
          title="제목 1"
          active={editor.isActive("heading", { level: 1 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        />
        <ToolbarButton
          label="제목2"
          title="제목 2"
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        />
        <span className="erp-richtext-toolbar-sep" />
        <ToolbarButton
          label="글머리"
          title="글머리 기호 목록"
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        />
        <ToolbarButton
          label="번호"
          title="번호 매기기 목록"
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        />
      </div>
      <EditorContent editor={editor} style={{ minHeight }} />
    </div>
  );
});
