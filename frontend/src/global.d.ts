// src/global.d.ts
//
// TS 기본 DOM lib에 선언이 없어서 그냥 쓰면 타입 에러가 나는 브라우저 전역들을 여기서 뚫는다.
//
// ⚠️ 현재 템플릿에서는 아무 데서도 쓰지 않는다 (Web Speech API 프로젝트에서 넘어온 선언).
//    실제로 음성 인식을 붙일 때 any 대신 제대로 된 타입을 올려서 쓰거나, 안 쓸 거면 지워도 된다.
/* eslint-disable @typescript-eslint/no-explicit-any */

declare global {
  // 브라우저에 존재할 수 있는 전역 객체들
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }

  var webkitSpeechRecognition: any;
  var SpeechRecognition: any;
}

export {};
