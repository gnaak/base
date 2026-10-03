/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Geist"', '"Pretendard"', "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        mono: ['"Geist Mono"', "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
        // 고객 화면 글꼴 — 테마가 --font-client 를 덮어쓰면 바뀐다 (index.css)
        client: "var(--font-client)",
      },
      // 고객 화면 킷의 컨트롤 높이 — 테마가 --control-h-* 를 덮어쓰면 바뀐다. 정사각 아이콘 버튼 때문에 width 도 둔다
      height: {
        "control-sm": "var(--control-h-sm)",
        "control-md": "var(--control-h-md)",
        "control-lg": "var(--control-h-lg)",
      },
      minHeight: {
        "control-sm": "var(--control-h-sm)",
        "control-md": "var(--control-h-md)",
        "control-lg": "var(--control-h-lg)",
      },
      width: {
        "control-sm": "var(--control-h-sm)",
        "control-md": "var(--control-h-md)",
        "control-lg": "var(--control-h-lg)",
      },
      minWidth: {
        "control-sm": "var(--control-h-sm)",
        "control-md": "var(--control-h-md)",
        "control-lg": "var(--control-h-lg)",
      },
      letterSpacing: {
        // Vercel display compression
        display: "-0.06em", // ~ -2.88px @ 48px
        heading: "-0.04em", // ~ -1.28px @ 32px
        title: "-0.04em", // ~ -0.96px @ 24px
        tight: "-0.02em", // ~ -0.32px @ 16px
      },
      borderRadius: {
        // Vercel scale
        micro: "2px",
        subtle: "4px",
        DEFAULT: "6px",
        comfy: "8px",
        image: "12px",
        tab: "64px",
        "nav-pill": "100px",
        // 고객 화면 킷 — 값은 index.css 의 변수라 테마가 모양을 바꿀 수 있다 (위 고정값들은 관리자용)
        control: "var(--radius-control)",
        card: "var(--radius-card)",
        sheet: "var(--radius-sheet)",
      },
      boxShadow: {
        // Shadow-as-border (the signature) — index.css 의 --shadow-border 로 테마 전환
        border: "var(--shadow-border)",
        "border-light": "rgb(235, 235, 235) 0px 0px 0px 1px",
        "border-dark": "rgba(255, 255, 255, 0.1) 0px 0px 0px 1px",
        // Subtle elevation
        subtle: "rgba(0, 0, 0, 0.04) 0px 2px 2px",
        // Multi-layer card stack (signature Vercel card)
        card: [
          "rgba(0, 0, 0, 0.08) 0px 0px 0px 1px",
          "rgba(0, 0, 0, 0.04) 0px 2px 2px",
          "rgba(0, 0, 0, 0.04) 0px 8px 8px -8px",
          "#fafafa 0px 0px 0px 1px",
        ].join(", "),
        "card-dark": [
          "rgba(255, 255, 255, 0.08) 0px 0px 0px 1px",
          "rgba(0, 0, 0, 0.5) 0px 2px 2px",
          "rgba(0, 0, 0, 0.5) 0px 8px 8px -8px",
        ].join(", "),
        // Focus ring
        focus: "0 0 0 2px rgb(var(--bg)), 0 0 0 4px hsla(212, 100%, 48%, 1)",
      },
      keyframes: {
        "fade-slide": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        caret: {
          "0%, 50%": { opacity: "1" },
          "50.01%, 100%": { opacity: "0" },
        },
        // 스켈레톤 위를 지나가는 광택. 부모의 overflow-hidden 안에서만 보인다.
        shimmer: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        // 모바일 내비 드로어. 왼쪽에서 밀려 들어온다.
        "drawer-in": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        // Loading 의 막대들이 차례로 옅어진다 (막대마다 animationDelay 가 다르다)
        "needle-fade": {
          "0%": { opacity: "1" },
          "100%": { opacity: "0.15" },
        },
        // 고객 화면 바텀시트 — 모바일에서 아래에서 올라온다 (sm 이상은 가운데 모달이라 fade-slide)
        "sheet-up": {
          "0%": { transform: "translateY(100%)" },
          "100%": { transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-slide": "fade-slide 150ms ease-out",
        caret: "caret 1s steps(2, end) infinite",
        shimmer: "shimmer 1.6s ease-in-out infinite",
        "drawer-in": "drawer-in 180ms ease-out",
        "fade-in": "fade-in 180ms ease-out",
        "needle-fade": "needle-fade 1.2s linear infinite",
        "sheet-up": "sheet-up 180ms ease-out",
      },
      colors: {
        // CSS 변수 기반 시맨틱 토큰 (라이트/다크 자동 전환).
        // 예전의 고정색 main/sub1/sub2 는 지웠다 — 남아 있으면 다시 쓰이고, 다크모드·테마가 닿지 않는다.
        primary: {
          DEFAULT: "rgb(var(--primary) / <alpha-value>)",
          light: "rgb(var(--primary-light) / <alpha-value>)",
          dark: "rgb(var(--primary-dark) / <alpha-value>)",
        },
        bg: {
          DEFAULT: "rgb(var(--bg) / <alpha-value>)",
          card: "rgb(var(--bg-card) / <alpha-value>)",
          sub: "rgb(var(--bg-sub) / <alpha-value>)",
          hover: "rgb(var(--bg-hover) / <alpha-value>)",
          active: "rgb(var(--bg-active) / <alpha-value>)",
          disabled: "rgb(var(--bg-disabled) / <alpha-value>)",
        },
        text: {
          main: "rgb(var(--text-main) / <alpha-value>)",
          sub: "rgb(var(--text-sub) / <alpha-value>)",
          disabled: "rgb(var(--text-disabled) / <alpha-value>)",
          placeholder: "rgb(var(--text-placeholder) / <alpha-value>)",
          inverse: "rgb(var(--text-inverse) / <alpha-value>)",
        },
        line: {
          DEFAULT: "rgb(var(--border) / <alpha-value>)",
          strong: "rgb(var(--border-strong) / <alpha-value>)",
          focus: "rgb(var(--border-focus) / <alpha-value>)",
        },
        input: {
          bg: "rgb(var(--input-bg) / <alpha-value>)",
          border: "rgb(var(--input-border) / <alpha-value>)",
        },
        point: {
          green: "rgb(var(--point-green) / <alpha-value>)",
          red: "rgb(var(--point-red) / <alpha-value>)",
          amber: "rgb(var(--point-amber) / <alpha-value>)",
          blue: "rgb(var(--point-blue) / <alpha-value>)",
        },
        success: {
          DEFAULT: "rgb(var(--point-green) / <alpha-value>)",
          bg: "rgb(var(--success-bg) / <alpha-value>)",
        },
        error: {
          DEFAULT: "rgb(var(--point-red) / <alpha-value>)",
          bg: "rgb(var(--error-bg) / <alpha-value>)",
        },
        warning: {
          DEFAULT: "rgb(var(--point-amber) / <alpha-value>)",
          bg: "rgb(var(--warning-bg) / <alpha-value>)",
        },
        info: {
          DEFAULT: "rgb(var(--point-blue) / <alpha-value>)",
          bg: "rgb(var(--info-bg) / <alpha-value>)",
        },
        overlay: "rgb(var(--overlay) / <alpha-value>)",
        surface: { raised: "rgb(var(--surface-raised) / <alpha-value>)" },
        skeleton: {
          base: "rgb(var(--skeleton-base) / <alpha-value>)",
          shine: "rgb(var(--skeleton-shine) / <alpha-value>)",
        },
        // Vercel workflow accents
        ship: "rgb(var(--ship) / <alpha-value>)",
        preview: "rgb(var(--preview) / <alpha-value>)",
        develop: "rgb(var(--develop) / <alpha-value>)",

        // 브랜드가 정한 고정색 — 토큰이 아니라서 다크모드·테마에서도 바뀌지 않는다.
        // 각 사 로그인 버튼 가이드가 색을 정해 두었기 때문이다. 이 두 묶음 말고는 고정색을 쓰지 않는다.
        kakao: { DEFAULT: "#FEE500", hover: "#FDD835", text: "#191919" },
        google: { DEFAULT: "#FFFFFF", hover: "#F8F9FA", border: "#747775", text: "#1F1F1F" },
      },
    },
  },
  plugins: [],
};
