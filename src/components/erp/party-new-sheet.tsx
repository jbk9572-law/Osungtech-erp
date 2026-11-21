import type { ReactNode } from "react";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { CloseButton } from "@/components/erp/close-button";
import { ListPageHeader, FormSection } from "@/components/erp/page-header";
import { ExcelImportForm } from "@/components/excel-import-form";
import type { FormState } from "@/components/form-message";

// 거래처·공급처 신규 등록(C형 모달 내용) — 등록 폼 + 엑셀 일괄등록. 두 화면이 같은 틀을 쓴다.
export function PartyNewSheet({
  title,
  listHref,
  tabLabel,
  form,
  importAction,
  templateHref,
  exportHref,
}: {
  title: string;
  listHref: string;
  tabLabel: string;
  form: ReactNode;
  importAction: (state: FormState, formData: FormData) => Promise<FormState>;
  templateHref: string;
  exportHref: string;
}) {
  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: listHref } }} />
      <ListPageHeader title={title} actions={<CloseButton href={listHref}>ESC 목록으로</CloseButton>} />
      <FormSection tabLabel={tabLabel}>{form}</FormSection>
      <div className="erp-u-mt-12">
        <FormSection tabLabel="엑셀 일괄등록">
          <ExcelImportForm action={importAction} templateHref={templateHref} exportHref={exportHref} />
        </FormSection>
      </div>
    </div>
  );
}
