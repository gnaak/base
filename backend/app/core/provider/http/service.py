from dataclasses import dataclass

from fastapi import Request


@dataclass(frozen=True)
class Auth:
    """로그인한 주체. `provider("user"|"admin")`가 토큰을 검증해서 채운다.

    비로그인 라우트에서는 `p.auth`가 None이다 (예전의 "guest_user" 같은 가짜 값 없음).
    """

    user_id: int
    auth_type: str


class ServiceProvider:
    """라우터가 받는 단 하나의 손잡이.

    서비스/리포지토리를 lazy property로 들고 있어서, 라우터는 `p.user_service` 처럼
    쓰기만 하면 된다. 실제 주입은 `deps.py`의 `provider()`가 한다.

    새 서비스를 추가할 때는 **두 군데**를 고친다:
      1. __init__ 에 캐시 슬롯 추가 (`self._my_service = None`)
      2. 아래에 property 추가

    import은 반드시 property **안에서** 한다. `app.module`이 라우터를 통해 이 모듈을
    끌어오기 때문에, 최상단에 두면 로딩 순서에 따라 순환 import로 깨진다.
    """

    def __init__(self, request: Request, db):
        self.request = request
        self.db = db
        self.auth: Auth | None = None
        self._redis_service = None
        self._user_repo = None
        self._admin_repo = None
        self._user_service = None
        self._auth_service = None
        self._admin_service = None
        self._gpt_service = None
        self._kakao_service = None
        self._google_service = None

    @property
    def user_repo(self):
        if not self._user_repo:
            from app.module.user.user_repository import UserRepository
            self._user_repo = UserRepository(self.db)
        return self._user_repo

    @property
    def admin_repo(self):
        if not self._admin_repo:
            from app.module.admin.admin_repository import AdminRepository
            self._admin_repo = AdminRepository(self.db)
        return self._admin_repo

    @property
    def user_service(self):
        if not self._user_service:
            from app.module.user.user_service import UserService
            self._user_service = UserService(self.user_repo)
        return self._user_service

    @property
    def admin_service(self):
        if not self._admin_service:
            from app.module.admin.admin_service import AdminService
            self._admin_service = AdminService(self.admin_repo)
        return self._admin_service

    @property
    def auth_service(self):
        if not self._auth_service:
            from app.module.auth.auth_service import AuthService
            self._auth_service = AuthService(self.user_repo, self.admin_repo)
        return self._auth_service

    @property
    def redis_service(self):
        if not self._redis_service:
            from app.module.infra.redis.redis_service import RedisService

            self._redis_service = RedisService()
        return self._redis_service

    @property
    def gpt_service(self):
        if not self._gpt_service:
            from app.module.infra.gpt.gpt_service import GPTService
            self._gpt_service = GPTService(self.redis_service)
        return self._gpt_service

    @property
    def google_service(self):
        if not self._google_service:
            from app.module.infra.google.google_service import GoogleService
            self._google_service = GoogleService(self.user_repo)
        return self._google_service

    @property
    def kakao_service(self):
        if not self._kakao_service:
            from app.module.infra.kakao.kakao_service import KakaoService
            self._kakao_service = KakaoService(self.user_repo)
        return self._kakao_service
