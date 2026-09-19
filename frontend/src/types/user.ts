// user_info 쿠키(base64 JSON)에 담겨 오는 세션 정보
// 실제 필드는 backend `auth_token.create_jwt_token()`의 session_info와 1:1로 맞춰야 한다.
export interface UserInfo {
  auth_type: string;
  id: number;
  user_nickname: string;
  created_at: string | null;
  // 아래는 백엔드 session_info에 추가했을 때만 내려온다 (기본 템플릿에는 없음)
  email?: string;
}

// GET api/user/me 응답의 data
// 백엔드 `user_schema.UserOut`과 1:1. 백엔드가 response_model로 강제하므로
// 여기 없는 필드는 애초에 내려오지 않는다 (필드를 늘리려면 UserOut부터 고칠 것).
export interface UserDetail {
  id: number;
  email: string;
  name: string;
  profile_image: string | null;
  created_at: string | null;
}
