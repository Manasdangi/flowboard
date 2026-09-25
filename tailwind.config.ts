import type { Config } from 'tailwindcss';
import defaultTheme from 'tailwindcss/defaultTheme';

/**
 * Flowboard design tokens. Components only use these semantic names
 * (brand / ink / canvas / surface / line) plus the stock Tailwind palette for
 * status + priority hues, which are centralised in src/ui/tokens.ts.
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f0fe',
          100: '#e3e3fc',
          200: '#cacaf8',
          300: '#a8a7f2',
          400: '#8584ea',
          500: '#6b69e0',
          600: '#5b5bd6',
          700: '#4a47b8',
          800: '#3d3b94',
          900: '#353476',
        },
        ink: {
          DEFAULT: '#16161d',
          muted: '#565666',
          subtle: '#858594',
          faint: '#b3b3bf',
        },
        canvas: '#f6f6f8',
        surface: {
          DEFAULT: '#ffffff',
          muted: '#f3f3f6',
          sunken: '#eeeef2',
        },
        line: {
          DEFAULT: '#e6e6ec',
          strong: '#d3d3dc',
        },
      },
      fontFamily: {
        sans: ['Inter', ...defaultTheme.fontFamily.sans],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      borderRadius: {
        control: '0.4375rem',
        card: '0.625rem',
        panel: '0.875rem',
      },
      boxShadow: {
        card: '0 1px 2px rgba(22,22,29,0.05), 0 0 0 1px rgba(22,22,29,0.06)',
        'card-hover': '0 4px 12px -2px rgba(22,22,29,0.10), 0 0 0 1px rgba(22,22,29,0.09)',
        drag: '0 18px 32px -8px rgba(22,22,29,0.28), 0 0 0 1.5px rgba(91,91,214,0.55)',
        pop: '0 10px 30px -6px rgba(22,22,29,0.20), 0 0 0 1px rgba(22,22,29,0.07)',
        drawer: '-24px 0 48px -12px rgba(22,22,29,0.18)',
        focus: '0 0 0 3px rgba(91,91,214,0.25)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-in-right': {
          from: { transform: 'translateX(24px)', opacity: '0' },
          to: { transform: 'translateX(0)', opacity: '1' },
        },
        'toast-in': {
          from: { transform: 'translateY(8px) scale(0.98)', opacity: '0' },
          to: { transform: 'translateY(0) scale(1)', opacity: '1' },
        },
        'pop-in': {
          from: { transform: 'scale(0.97)', opacity: '0' },
          to: { transform: 'scale(1)', opacity: '1' },
        },
      },
      animation: {
        'fade-in': 'fade-in 150ms ease-out',
        'slide-in-right': 'slide-in-right 200ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        'toast-in': 'toast-in 180ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        'pop-in': 'pop-in 140ms ease-out',
      },
    },
  },
  plugins: [],
} satisfies Config;
