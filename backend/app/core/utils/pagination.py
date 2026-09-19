"""목록 응답의 공통 규약.

프론트 `component/admin/ui/pagination.tsx`가 기대하는 모양과 1:1이다.
도메인마다 `{items, total, page, size}` 를 손으로 조립하면 키 이름이 갈라진다.

```python
@router.get("/users", response_model=BaseResponse[Page[UserOut]])
async def list_users(p: AdminProvider, page: int = 1, size: int = 20):
    return success(await p.user_service.list_users(page, size))
```

```python
# service
async def list_users(self, page: int, size: int) -> Page[UserOut]:
    stmt = select(User).where(User.deleted_at.is_(None)).order_by(User.id.desc())
    rows, total = await paginate(self.user_repo.db, stmt, page, size)
    return Page.of([UserOut.model_validate(r) for r in rows], total, page, size)
```
"""
from typing import Generic, TypeVar

from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import Select

T = TypeVar("T")

#: 한 페이지 최대 개수. 클라이언트가 `size=100000`으로 DB를 통째로 긁는 것을 막는다.
MAX_PAGE_SIZE = 100
DEFAULT_PAGE_SIZE = 20


class Page(BaseModel, Generic[T]):
    """목록 응답 본문. `BaseResponse[Page[XxxOut]]` 형태로 감싸서 내보낸다."""

    items: list[T]
    total: int          # 필터를 적용한 전체 개수 (현재 페이지 개수가 아니다)
    page: int           # 1부터 시작
    size: int
    total_pages: int

    @classmethod
    def of(cls, items: list[T], total: int, page: int, size: int) -> "Page[T]":
        return cls(
            items=items,
            total=total,
            page=page,
            size=size,
            # 0건일 때 0페이지가 아니라 1페이지로 둔다 — 프론트 페이지네이션이
            # 페이지 수 0을 다루기 번거롭고, "빈 1페이지"가 화면과도 맞는다
            total_pages=max(1, -(-total // size)) if size > 0 else 1,
        )


def clamp_page(page: int, size: int) -> tuple[int, int]:
    """쿼리 파라미터를 안전한 범위로 자른다."""
    page = max(1, page)
    size = min(max(1, size), MAX_PAGE_SIZE)
    return page, size


async def paginate(db: AsyncSession, stmt: Select, page: int, size: int) -> tuple[list, int]:
    """`(행 목록, 전체 개수)`를 돌려준다.

    개수 쿼리는 원본 `stmt`에서 정렬을 떼고 서브쿼리로 감싼다 —
    정렬이 붙은 채로 COUNT 하면 MySQL이 불필요한 정렬을 수행한다.
    """
    page, size = clamp_page(page, size)

    count_stmt = select(func.count()).select_from(stmt.order_by(None).subquery())
    total = (await db.execute(count_stmt)).scalar_one()

    rows = (await db.execute(stmt.offset((page - 1) * size).limit(size))).scalars().all()
    return list(rows), total
