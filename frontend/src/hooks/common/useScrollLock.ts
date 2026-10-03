import { useEffect } from "react";

// 여러 모달이 겹쳐 열려도(모달 위 확인 창) 마지막 하나가 닫힐 때만 스크롤을 푼다
let lockCount = 0;
let savedOverflow = "";

/**
 * `active` 인 동안 뒤 페이지(body) 스크롤을 막는다. 고객 화면 모달·바텀시트가 쓴다.
 *
 * 모바일에서 시트를 끌다가 뒤 페이지가 같이 스크롤되는 걸 막는다.
 */
export const useScrollLock = (active: boolean) => {
  useEffect(() => {
    if (!active) return;
    if (lockCount === 0) {
      savedOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    lockCount += 1;
    return () => {
      lockCount -= 1;
      if (lockCount === 0) document.body.style.overflow = savedOverflow;
    };
  }, [active]);
};
