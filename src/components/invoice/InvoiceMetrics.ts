// 거래명세표 레이아웃 수치 단일 소스.
// 여기 있는 모든 값은 0707 원본 PDF 실측/픽셀 대조를 거쳐 확정된 값이다.
// 컴포넌트(TSX)는 구조만 담당하고, 값은 전부 여기서만 바꾼다.

export const DOCUMENT = {
  baseFontSize: 13,
};

export const TITLE = {
  fontFamily: "'Malgun Gothic', '맑은 고딕', Gulim, '굴림', sans-serif",
  fontSize: 27,
  fontWeight: 700,
  letterSpacing: "0em",
};

export const HEADER = {
  rowHeight: 46,
  copyLabelFontSize: 13,
};

export const SUPPLIER = {
  row1Height: 23,
  row2Height: 28,
  row3Height: 28,
  row4Height: 28,
  labelFontSize: 15,
  labelLetterSpacing: "0.3em",
  labelPaddingLeft: 6,
  verticalLabelLineHeight: 13,
  remarkLabelFontSize: 14,
};

export const CUSTOMER = {
  verticalLabelFontSize: 11,
  verticalLabelGap: 3,
  boxTopPadding: 18,
  namePaddingLeft: 10,
  guihaTop: 18,
  guihaRight: 4,
  greetingTopPadding: 28,
};

export const TABLE = {
  headerRowHeight: 19,
  itemRowHeight: 24,
};

export const SUMMARY = {
  totalRowHeight: 27,
  memoRowHeight: 30,
};

export const FOOTER = {
  fontSize: 12,
  paddingX: 4,
  paddingTop: 3,
};

export const SEAL = {
  top: 58,
  left: "43.5%",
  size: 52,
};

export const CELL = {
  paddingX: 4,
};
