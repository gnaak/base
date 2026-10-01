import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { AuthProvider } from "./context/AuthProvider";
import { ThemeProvider } from "./context/ThemeProvider";
import { PrivateRoute } from "./hooks/auth/privateRoute";
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
      <ThemeProvider>
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
                  {/* 404 도 고객 레이아웃 안에 둔다 — 밖에 있으면 고객 화면 테마(.theme-client)가 안 걸린다 */}
                  <Route path="*" element={<NotFoundPage />} />
                </Route>

                <Route path="/admin/login" element={<AdminLogin />} />
                {/* 관리자 가드는 PrivateRoute 한 곳에만 둔다.
                    AdminLayout은 레이아웃만 담당하고 인증은 알지 못한다. */}
                <Route
                  element={
                    <PrivateRoute authType="admin">
                      <AdminLayout />
                    </PrivateRoute>
                  }
                >
                  <Route path="/admin" element={<AdminMain />} />
                  {/* 없는 관리자 경로는 사이드바가 있는 채로 404 — 고객 화면으로 튕기지 않는다 */}
                  <Route path="/admin/*" element={<NotFoundPage homePath="/admin" />} />
                </Route>
              </Routes>
            </AuthProvider>
          </BrowserRouter>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
