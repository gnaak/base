import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** 기본 화면 대신 보여줄 UI. 생략하면 내장 fallback을 쓴다. */
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * 렌더 도중 터진 에러를 잡아 화면 전체가 백지가 되는 것을 막는다.
 *
 * ⚠️ 에러 바운더리는 클래스 컴포넌트로만 만들 수 있다.
 * (`getDerivedStateFromError` / `componentDidCatch`에 대응하는 훅이 없다)
 * 프로젝트의 "function 키워드·클래스 금지" 규칙에서 예외인 유일한 파일이다.
 *
 * **잡지 못하는 것**: 이벤트 핸들러, 비동기 콜백, 서버 렌더링.
 * 그쪽은 try/catch나 React Query의 `error` 상태로 처리할 것.
 *
 * 복구는 상태 초기화(다시 시도)로만 한다. `location.reload()`는 쓰지 않는다 —
 * 세션이 원인인 에러였다면 쿠키가 그대로라 같은 에러가 무한 반복된다.
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // 실제 프로젝트에서는 여기서 Sentry 등으로 전송한다.
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    const { children, fallback } = this.props;

    if (!error) return children;
    if (fallback) return fallback;

    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-bg px-6 text-center">
        <h1 className="text-lg font-semibold text-text-main">
          문제가 발생했습니다
        </h1>
        <p className="max-w-md break-words text-sm text-text-sub">
          {error.message}
        </p>
        <button
          type="button"
          onClick={this.handleRetry}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-text-inverse hover:bg-primary-dark"
        >
          다시 시도
        </button>
      </div>
    );
  }
}

export default ErrorBoundary;
