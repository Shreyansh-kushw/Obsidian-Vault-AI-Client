/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: "#090d16",
        foreground: "#e6edf3",
        card: {
          DEFAULT: "#111726",
          foreground: "#e6edf3",
          border: "rgba(255, 255, 255, 0.08)",
        },
        primary: {
          DEFAULT: "#8b5cf6",
          foreground: "#ffffff",
          hover: "#7c3aed",
        },
        secondary: {
          DEFAULT: "#1e293b",
          foreground: "#94a3b8",
        },
        accent: {
          DEFAULT: "#6366f1",
          foreground: "#ffffff",
        },
        success: {
          DEFAULT: "#10b981",
          foreground: "#ffffff",
        },
        warning: {
          DEFAULT: "#f59e0b",
          foreground: "#ffffff",
        },
        danger: {
          DEFAULT: "#ef4444",
          foreground: "#ffffff",
        },
        border: "rgba(255, 255, 255, 0.08)",
        input: "rgba(255, 255, 255, 0.06)",
        ring: "#8b5cf6",
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { opacity: '1', filter: 'drop-shadow(0 0 8px rgba(139, 92, 246, 0.6))' },
          '50%': { opacity: '0.6', filter: 'drop-shadow(0 0 2px rgba(139, 92, 246, 0.2))' },
        },
        pulseGreen: {
          '0%, 100%': { opacity: '1', filter: 'drop-shadow(0 0 8px rgba(16, 185, 129, 0.7))' },
          '50%': { opacity: '0.5', filter: 'drop-shadow(0 0 2px rgba(16, 185, 129, 0.2))' },
        }
      },
      animation: {
        'pulse-glow': 'pulseGlow 2.5s infinite ease-in-out',
        'pulse-green': 'pulseGreen 2s infinite ease-in-out',
      }
    },
  },
  plugins: [],
}
