import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { AuthProvider } from "./context/AuthProvider";
import ErrorBoundary from "./component/common/errorBoundary";
import NotFoundPage from "./container/notfound";
import AdminLogin from "./container/admin/login";
import AdminLayout from "./container/admin/layout";
import AdminMain from "./container/admin/main";
import ClientLayOut from "./container/client/layout";
import ClientMain from "./container/client/main";
import Google from "./container/client/auth/google";
import Kakao from "./container/client/auth/kakao";

// 컴포넌트 밖에서 한 번만 만든다.
// 안에서 만들면 App이 리렌더될 때마다 새 인스턴스가 생겨 캐시가 통째로 날아간다.
const queryClient = new QueryClient();

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        {/* AuthProvider가 Router 안에 있어야 인증 로직에서 navigate를 쓸 수 있다 */}
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route element={<ClientLayOut />}>
                <Route path="/" element={<ClientMain />} />
                <Route path="/kakao/login" element={<Kakao />} />
                <Route path="/google/login" element={<Google />} />
                {/* 로그인이 필요한 페이지는 PrivateRoute로 감싼다:
                    <Route
                      path="/mypage"
                      element={<PrivateRoute><MyPage /></PrivateRoute>}
                    /> */}
              </Route>

              <Route path="/admin/login" element={<AdminLogin />} />
              <Route element={<AdminLayout />}>
                <Route path="/admin" element={<AdminMain />} />
              </Route>
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
