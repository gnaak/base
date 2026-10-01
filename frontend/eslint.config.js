import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tailwind from 'eslint-plugin-tailwindcss'
import tseslint from 'typescript-eslint'

// ── 디자인 린트 ─────────────────────────────────────────────
// 둘 다 "에러 없이 조용히 틀리는" 것을 잡는다. 사람이 화면을 안 보는 무인 개발에서 특히 필요하다.
//
// 1) 고정색 — bg-white·gray-*·[#hex] 는 다크모드·고객 화면 테마가 닿지 않는다 (DESIGN.md "색").
//    예외는 tailwind.config.js 의 브랜드 토큰(bg-kakao·bg-google)뿐이라 여기 목록에 없다.
//    esquery 정규식 안에는 '/' 를 쓸 수 없어서 \x2F 로 적는다.
const PALETTE =
  'white|black|gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose'
const COLOR_UTILS =
  'bg|text|border|ring|from|to|via|fill|stroke|divide|outline|placeholder|accent|caret|decoration|shadow'
const FIXED_COLOR = `(^|[\\s:])(${COLOR_UTILS})-(${PALETTE})(-\\d{2,3})?(\\x2F\\d+)?(?=$|\\s)|-\\[#[0-9a-fA-F]{3,8}\\]`
const FIXED_COLOR_MESSAGE =
  '고정색 금지 — 시맨틱 토큰(bg-bg-card · text-text-main · border-line · text-text-inverse …)을 쓴다. DESIGN.md "색"'

// 2) 없는 클래스 — tailwind.config.js 에 없는 클래스는 빌드 에러 없이 조용히 무시된다
//    (예전 bg-adminMain, Skeleton 의 rounded-DEFAULT, InputBox 의 errorColor). index.css 에 정의한 클래스는 cssFiles 로 읽는다.
//    config 는 절대 경로로 준다 — 플러그인이 그 폴더를 기준으로 tailwindcss 패키지를 찾는다 (상대 경로면 못 찾는다)
const FRONTEND_DIR = dirname(fileURLToPath(import.meta.url))
//    플러그인은 `rounded-DEFAULT` 처럼 설정의 DEFAULT 키를 그대로 쓴 이름을 통과시킨다 — Tailwind 는 `rounded` 만 만든다.
//    그래서 이 패턴은 따로 막는다
const DEFAULT_SUFFIX = '(^|[\\s:])[a-z][a-z0-9-]*-DEFAULT(?=$|\\s)'
const DEFAULT_SUFFIX_MESSAGE =
  '`-DEFAULT` 클래스는 생성되지 않는다 — 접미사를 뺀다 (`rounded-DEFAULT` → `rounded`, `bg-primary-DEFAULT` → `bg-primary`)'

export default tseslint.config(
  { ignores: ['dist'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      tailwindcss: tailwind,
    },
    settings: {
      tailwindcss: {
        config: resolve(FRONTEND_DIR, 'tailwind.config.js'),
        cssFiles: ['src/**/*.css'],
        callees: ['clsx', 'cn', 'classnames'],
      },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      'tailwindcss/no-custom-classname': [
        'error',
        {
          // 런타임에 붙이는 범위 클래스 (index.css 가 아니라 프로젝트마다 phase 1 에서 정의)
          whitelist: ['theme-client'],
        },
      ],
      'no-restricted-syntax': [
        'error',
        { selector: `Literal[value=/${FIXED_COLOR}/]`, message: FIXED_COLOR_MESSAGE },
        { selector: `TemplateElement[value.raw=/${FIXED_COLOR}/]`, message: FIXED_COLOR_MESSAGE },
        { selector: `Literal[value=/${DEFAULT_SUFFIX}/]`, message: DEFAULT_SUFFIX_MESSAGE },
        { selector: `TemplateElement[value.raw=/${DEFAULT_SUFFIX}/]`, message: DEFAULT_SUFFIX_MESSAGE },
      ],
    },
  },
)
