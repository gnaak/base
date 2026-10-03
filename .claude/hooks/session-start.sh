#!/bin/sh
# SessionStart 훅 — 막 받은 템플릿이면 Claude 에게 "첫 메시지부터 /start 흐름으로" 를 알려 준다.
#
# 대화 화면에서는 Claude 가 먼저 말을 걸 수 없다 (initialUserMessage 는 `claude -p` 에서만 된다).
# 그래서 첫 메시지가 "안녕" 이든 아이디어든 /start 를 친 것처럼 이어 가게 한다 — 사용자가 명령을 몰라도 된다.
#
# Node 가 없는 PC(처음 쓰는 사람)에서도 돌아야 해서 sh 로 쓴다. 출력은 그대로 Claude 의 맥락이 된다.
# 조용히 지나가는 경우: PROJECT.md 가 있다(기획 끝) · backend/.env 가 있다(이미 셋업한 저장소 — 템플릿을 고치는 원본 포함)

root="${CLAUDE_PROJECT_DIR:-.}"

[ -f "$root/PROJECT.md" ] && exit 0

brief="$root/PRD/00_brief.md"
if [ -f "$brief" ] && grep -q '/start 인터뷰' "$brief" 2>/dev/null; then
  cat <<'EOF'
[처음 쓰는 프로젝트 — /start 가 중간에 멈춰 있다]
PRD/00_brief.md 는 있는데 PROJECT.md 가 없다. 사용자의 첫 메시지에 답할 때, 지난번 준비를 이어서 할지 한 줄로 묻고
"예" 면 .claude/commands/start.md 의 0 단계부터(했던 단계는 건너뛰며) 이어서 한다. 사용자가 다른 일을 분명히 원하면 그걸 한다.
EOF
  exit 0
fi

[ -f "$root/backend/.env" ] && exit 0

cat <<'EOF'
[처음 연 템플릿 — 아직 아무것도 정하지 않았다]
이 폴더는 막 받은 템플릿이다 (PROJECT.md · backend/.env 가 없다). 사용자는 개발자가 아닐 수 있고 /start 를 모를 수 있다.
사용자의 첫 메시지가 무엇이든(인사 · 아이디어 · 고객과 나눈 대화나 계약서를 붙여넣은 긴 글 · "뭐부터 해?") **/start 를 친 것처럼**
.claude/commands/start.md 를 읽고 그 순서로 시작한다 — 첫 메시지에 아이디어나 자료가 있으면 그걸 $ARGUMENTS 로 보고,
없으면 AskUserQuestion 으로 "무엇을 만들까요?" 를 묻는다 (선택지 · 직접 입력 — start.md 1단계). 새 프로젝트인지는 묻지 않는다.
사람의 답이 필요한 곳은 전부 AskUserQuestion 이다 — Remote Control 로 볼 때 그래야 휴대폰 알림이 간다.
첫 답의 맨 앞에 한 줄로 알린다: "처음이시네요 — 만들 것을 같이 정하고, 이 PC 에서 돌아가게 준비한 뒤, 기획까지 갈게요."
단, 사용자가 다른 일(템플릿 자체를 고치기 · 질문)을 분명히 원하면 그걸 하고, /start 는 원할 때 하자고만 말한다.
EOF
