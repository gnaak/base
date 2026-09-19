"""upload 도메인 응답 스키마."""
from pydantic import BaseModel


class UploadOut(BaseModel):
    """저장된 파일의 공개 경로. DB에는 `url` 을 그대로 넣으면 된다."""

    url: str
