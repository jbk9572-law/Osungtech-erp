import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SpecLotUnitCells } from "./order-form-row-cells";

type Props = Parameters<typeof SpecLotUnitCells>[0];
const base: Props = {
  spec: "1 * 500",
  manualSpec: false,
  hasProduct: true,
  productSpec: "1 * 500",
  lotNumber: "L-1",
  unit: "EA",
  onPatch: () => {},
};
const render = (props: Partial<Props>) =>
  renderToStaticMarkup(createElement("table", null, createElement("tbody", null, createElement("tr", null, createElement(SpecLotUnitCells, { ...base, ...props })))));

describe("SpecLotUnitCells", () => {
  it("규격·관리번호·단위 세 칸을 그린다", () => {
    expect((render({}).match(/<td/g) ?? []).length).toBe(3);
  });
  it("품목이 골라진 줄에서만 '직접입력' 체크박스가 나온다", () => {
    expect(render({ hasProduct: true })).toContain("직접입력");
    expect(render({ hasProduct: false })).not.toContain("직접입력");
  });
  it("직접입력이 꺼져 있으면 규격 입력칸이 잠긴다", () => {
    expect(render({ manualSpec: false })).toContain('disabled=""');
    expect(render({ manualSpec: true })).not.toContain('disabled=""');
  });
  it("단위가 없으면 '-'를 보여준다", () => {
    expect(render({ unit: null })).toContain(">-</td>");
    expect(render({ unit: "ROLL" })).toContain(">ROLL</td>");
  });
});

import { RemarkActionCells } from "./order-form-row-cells";

describe("RemarkActionCells", () => {
  const renderCells = (canRemove: boolean) =>
    renderToStaticMarkup(
      createElement(
        "table",
        null,
        createElement(
          "tbody",
          null,
          createElement(
            "tr",
            null,
            createElement(RemarkActionCells, { remark: "메모", onRemarkChange: () => {}, onInsert: () => {}, onRemove: () => {}, canRemove }),
          ),
        ),
      ),
    );
  it("비고 입력칸과 삽입/삭제 버튼 두 칸을 그린다", () => {
    const html = renderCells(true);
    expect((html.match(/<td/g) ?? []).length).toBe(2);
    expect(html).toContain("+ 삽입");
    expect(html).toContain("삭제");
  });
  it("줄이 하나뿐이면 삭제 버튼이 잠긴다", () => {
    expect(renderCells(false)).toContain('disabled=""');
    expect(renderCells(true)).not.toContain('disabled=""');
  });
});
