/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Geist"', '"Pretendard"', "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        mono: ['"Geist Mono"', "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
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
      },
      animation: {
        "fade-slide": "fade-slide 150ms ease-out",
        caret: "caret 1s steps(2, end) infinite",
        shimmer: "shimmer 1.6s ease-in-out infinite",
        "drawer-in": "drawer-in 180ms ease-out",
        "fade-in": "fade-in 180ms ease-out",
      },
      colors: {
        // Admin 전용 고정 색상 (legacy — kept for existing admin pages)
        main: {
          DEFAULT: "#1C1C1C",
          hover: "#262626",
          active: "#141414",
        },
        sub1: {
          DEFAULT: "#3A3A3A",
          hover: "#4A4A4A",
          active: "#2E2E2E",
        },
        sub2: {
          DEFAULT: "#F2F2F2",
          hover: "#EDEDED",
          active: "#DCDCDC",
        },

        // CSS 변수 기반 시맨틱 토큰 (라이트/다크 자동 전환)
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
      },
    },
  },
  plugins: [],
};
