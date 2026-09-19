from fastapi import APIRouter, File, UploadFile

from app.core.provider.http.deps import UserProvider
from app.core.utils.rate_limit import rate_limit
from app.core.utils.response import BaseResponse, success
from app.core.utils.upload import IMAGE_EXTENSIONS, save_upload
from app.module.upload.upload_schema import UploadOut

router = APIRouter()

#: 업로드는 디스크·대역폭을 쓰므로 제한 대상이다 (rate_limit.py 의 판단 기준 참고)
UPLOAD_LIMIT = rate_limit("upload", limit=20, window=60)


@router.post("/image", dependencies=[UPLOAD_LIMIT], response_model=BaseResponse[UploadOut])
async def upload_image(p: UserProvider, file: UploadFile = File(...)):
    """이미지 업로드 → `/media/image/...` 경로 반환.

    - 로그인 필수 (`UserProvider`)
    - 확장자 화이트리스트 + 10MB 제한은 `save_upload`가 강제한다
    - `subdir`을 **상수로** 넘기는 게 중요하다. 클라이언트가 정하게 하면 경로 조작이 된다
    """
    url = await save_upload(file, "image", allowed=IMAGE_EXTENSIONS)
    return success(UploadOut(url=url))
