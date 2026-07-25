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

// /me 호출 시 넘어오는 데이터
export interface UserDetail {
  name: string;
  profile_image: string;
}
