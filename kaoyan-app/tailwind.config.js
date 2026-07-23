/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // 纸张层（RGB 通道格式，支持 Tailwind 透明度修饰符 + 暗色模式切换）
        paper: 'rgb(var(--color-paper) / <alpha-value>)',
        'paper-deep': 'rgb(var(--color-paper-deep) / <alpha-value>)',
        'paper-dark': 'rgb(var(--color-paper-dark) / <alpha-value>)',
        // 墨色层
        ink: 'rgb(var(--color-ink) / <alpha-value>)',
        'ink-soft': 'rgb(var(--color-ink-soft) / <alpha-value>)',
        'ink-muted': 'rgb(var(--color-ink-muted) / <alpha-value>)',
        // 赭石主色
        ochre: 'rgb(var(--color-ochre) / <alpha-value>)',
        'ochre-dark': 'rgb(var(--color-ochre-dark) / <alpha-value>)',
        'ochre-light': 'rgb(var(--color-ochre-light) / <alpha-value>)',
        'ochre-pale': 'rgb(var(--color-ochre-pale) / <alpha-value>)',
        // 印章红（强调）
        seal: 'rgb(var(--color-seal) / <alpha-value>)',
        'seal-dark': 'rgb(var(--color-seal-dark) / <alpha-value>)',
        // 分割线
        line: 'rgb(var(--color-line) / <alpha-value>)',
        'line-soft': 'rgb(var(--color-line-soft) / <alpha-value>)',
      },
      fontFamily: {
        serif: ['"Source Serif Pro"', '"Noto Serif SC"', 'Georgia', 'serif'],
        sans: ['"Noto Sans SC"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
        display: ['"Source Serif Pro"', '"Noto Serif SC"', 'serif'],
      },
      fontSize: {
        // 文章阅读字号档位
        'article-xs': ['14px', { lineHeight: '1.85' }],
        'article-sm': ['16px', { lineHeight: '1.85' }],
        'article-base': ['18px', { lineHeight: '1.9' }],
        'article-lg': ['20px', { lineHeight: '1.9' }],
        'article-xl': ['22px', { lineHeight: '1.95' }],
      },
      boxShadow: {
        paper: '0 1px 2px rgba(26, 22, 17, 0.04), 0 2px 8px rgba(26, 22, 17, 0.06)',
        'paper-hover': '0 4px 12px rgba(26, 22, 17, 0.08), 0 8px 24px rgba(184, 115, 51, 0.08)',
        stamp: '0 2px 6px rgba(169, 50, 38, 0.2)',
        inset: 'inset 0 1px 3px rgba(26, 22, 17, 0.06)',
      },
      backgroundImage: {
        'paper-fold':
          'linear-gradient(to right, transparent 0%, rgba(232, 223, 200, 0.4) 50%, transparent 100%)',
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'pop-in': 'popIn 0.2s ease-out',
        'stamp-in': 'stampIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(12px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        popIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        stampIn: {
          '0%': { opacity: '0', transform: 'scale(1.4) rotate(-12deg)' },
          '60%': { opacity: '1', transform: 'scale(0.92) rotate(2deg)' },
          '100%': { opacity: '1', transform: 'scale(1) rotate(0deg)' },
        },
      },
    },
  },
  plugins: [],
}
