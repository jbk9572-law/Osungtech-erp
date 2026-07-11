// 신규 판매 등록 화면에는 아직 sales_order_id가 없어서 모조지 계산을 바로
// 저장할 수 없다. 계산 화면(paper-calc-client)이 이 키로 결과를
// localStorage에 잠깐 담아두면, 판매 등록 폼(new-sale-form)이 주문을
// 등록할 때 같은 키로 읽어서 서버 액션에 같이 넘긴다. 두 컴포넌트가 서로
// 무거운 코드를 끌어오지 않도록 문자열 상수만 따로 뺐다.
export const PENDING_PAPER_CALC_KEY = "paper-calc-pending-attach";
