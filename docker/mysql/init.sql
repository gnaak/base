-- MySQL 컨테이너 최초 기동 시 1회 실행된다 (볼륨이 비어 있을 때만).
-- 이미 만든 뒤 이 파일을 고쳤다면 `docker compose down -v` 로 볼륨을 지우고 다시 올릴 것.
--
-- 이름은 backend/.env.example 의 local_mysql_db / test_mysql_db 와 맞춰져 있다.

-- 개발용 DB (MYSQL_DATABASE 로도 만들어지지만, 문자셋을 명시하려고 여기서도 선언한다)
CREATE DATABASE IF NOT EXISTS db_example
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- pytest 전용 DB.
-- 테스트가 매 세션 테이블을 drop 하므로 개발용과 반드시 분리돼 있어야 한다
-- (같은 이름이면 tests/conftest.py 가 기동 시점에 막는다).
CREATE DATABASE IF NOT EXISTS db_base_test
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
