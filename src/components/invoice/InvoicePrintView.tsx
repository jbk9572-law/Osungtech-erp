"use client";

import { useState, type ComponentProps } from "react";
import { useRouter } from "next/navigation";
import { PrintToolbar } from "@/components/erp/print-toolbar";
import type { PrintOptionGroup } from "@/components/print-option-bar";
import { buildPrintOptionHref, type PrintOptionParams } from "@/lib/print-options";
import { InvoicePage, type InvoiceCopies, type InvoiceLayout } from "./InvoicePage";
import type { InvoiceForm } from "./types";

// 명세표(매출·매입) 인쇄 화면 — 서식·출력·용지 버튼을 눌러도 서버에 다시 묻지 않고 화면 안에서 바로 바꾼다.
// 예전엔 버튼마다 페이지 전체를 서버에서 다시 만들어(DB 5~6번 조회) 누를 때마다 한참 걸렸다 — 서식·출력·용지는 모양만 바꾸는 것이라 이미 받은 데이터로 충분하다.
// 주소(?form=&copies=&layout=)는 history.replaceState 로 같이 갱신해서 새로고침·주소 공유에도 그대로 남는다.
// 잔액 표기(미수금·미지급금)만은 DB에서 값을 가져와야 하므로 예전처럼 서버 이동(router.replace)으로 처리한다.
const FORM_BY_PARAM: Record<string, InvoiceForm> = { n: "N", nb: "NB", b: "B", a: "A" };
const PARAM_BY_FORM: Record<string, string> = { N: "n", NB: "nb", B: "b", A: "a" };

type InvoiceProps = Omit<ComponentProps<typeof InvoicePage>, "copies" | "layout" | "form" | "balance">;

export function InvoicePrintView({
  basePath,
  params,
  closeHref,
  title,
  balanceLabel,
  formGroup,
  initial,
  balance,
  invoice,
}: {
  basePath: string;
  params: PrintOptionParams;
  closeHref: string;
  title: string;
  /** 잔액 줄 이름("미수금"/"미지급금") */
  balanceLabel: string;
  formGroup: PrintOptionGroup | null;
  initial: { form: InvoiceForm; copies: InvoiceCopies; layout: InvoiceLayout; showBalance: boolean };
  /** 서버가 읽어 온 잔액(잔액 표기를 켠 경우에만 있음) */
  balance?: number;
  invoice: InvoiceProps;
}) {
  const router = useRouter();
  const [form, setForm] = useState<InvoiceForm>(initial.form);
  const [copies, setCopies] = useState<InvoiceCopies>(initial.copies);
  const [layout, setLayout] = useState<InvoiceLayout>(initial.layout);

  // 지금 화면의 선택값을 모두 담은 주소 재료 — 한 옵션만 바꿔도 나머지 선택이 사라지지 않게 한다.
  const current = (): PrintOptionParams => ({ ...params, form: PARAM_BY_FORM[form], copies, layout });
  const hrefFor = (key: string, value: string) => buildPrintOptionHref(basePath, current(), key, value);

  function choose(key: string, value: string) {
    if (key === "balance") {
      router.replace(hrefFor(key, value), { scroll: false });
      return;
    }
    if (key === "form") setForm(FORM_BY_PARAM[value] ?? form);
    else if (key === "copies") setCopies(value as InvoiceCopies);
    else if (key === "layout") setLayout(value as InvoiceLayout);
    window.history.replaceState(window.history.state, "", hrefFor(key, value));
  }

  const groups: PrintOptionGroup[] = [
    ...(formGroup ? [{ ...formGroup, current: PARAM_BY_FORM[form] }] : []),
    {
      key: "copies",
      label: "출력",
      current: copies,
      options: [
        { value: "both", label: "양쪽 다" },
        { value: "receiver", label: "공급받는자만" },
        { value: "supplier", label: "공급자만" },
      ],
    },
    {
      key: "layout",
      label: "용지",
      current: layout,
      options: [
        { value: "half", label: "2연식" },
        { value: "full", label: "전지" },
      ],
    },
    {
      key: "balance",
      label: balanceLabel,
      current: initial.showBalance ? "show" : "hide",
      options: [
        { value: "hide", label: "표기 안함" },
        { value: "show", label: "표기" },
      ],
    },
  ];

  return (
    <div className={`erp-print-sheet${layout === "half" ? " print-page-wrapper" : ""}`}>
      <PrintToolbar closeHref={closeHref} title={title} autoPrint={false} />
      <div className="erp-optbar print:hidden" role="group" aria-label="인쇄 옵션">
        {groups.map((g) => (
          <div key={g.key} className="erp-optbar-group">
            <span className="erp-optbar-label">{g.label}</span>
            <div className="erp-seg" role="group" aria-label={g.label}>
              {g.options.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => choose(g.key, o.value)}
                  aria-current={g.current === o.value ? "true" : undefined}
                  className={`erp-seg-btn${g.current === o.value ? " active" : ""}`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <InvoicePage {...invoice} copies={copies} layout={layout} form={form} balance={initial.showBalance ? balance : undefined} />
    </div>
  );
}
