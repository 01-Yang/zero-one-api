/** @type {import('tailwindcss').Config} */
import { consolePalette } from './src/styles/palette-adapter.js'

export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Keep primary/accent as compatibility aliases for upstream components.
        primary: consolePalette.primary,
        accent: consolePalette.accent,
        // Explicit Zero One roles preserve the current skin without redefining
        // Tailwind's generic success and warning palettes for future pages.
        'zo-signal': consolePalette.signal,
        'zo-alert': consolePalette.alert,
        // 深色模式层级：页面、侧栏、表面和文字。
        dark: {
          50: '#f5f5f7',
          100: '#e5e5e7',
          200: '#d2d2d7',
          300: '#a1a1a6',
          400: '#86868b',
          500: '#636366',
          600: '#3a3a3c',
          700: '#2c2c2e',
          800: '#1c1c1e',
          900: '#141416',
          950: '#000000'
        }
      },
      fontFamily: {
        sans: [
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'PingFang SC',
          'Hiragino Sans GB',
          'Microsoft YaHei',
          'sans-serif'
        ],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace']
      },
      letterSpacing: {
        tighter: '0',
        tight: '0',
        normal: '0',
        wide: '0',
        wider: '0',
        widest: '0'
      },
      boxShadow: {
        glass: '0 1px 2px rgba(0, 0, 0, 0.04)',
        'glass-sm': '0 1px 2px rgba(0, 0, 0, 0.04)',
        glow: '0 1px 2px rgba(0, 0, 0, 0.06)',
        'glow-lg': '0 2px 6px rgba(0, 0, 0, 0.08)',
        card: '0 1px 2px rgba(0, 0, 0, 0.06)',
        'card-hover': '0 2px 6px rgba(0, 0, 0, 0.08)'
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.2s ease-out',
        'slide-down': 'slideDown 0.2s ease-out',
        'slide-in-right': 'slideInRight 0.2s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        shimmer: 'shimmer 1.5s linear infinite'
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' }
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' }
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' }
        }
      }
    }
  },
  plugins: []
}
