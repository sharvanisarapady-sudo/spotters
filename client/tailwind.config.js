/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#0a1128',
          900: '#0d1b3e',
          800: '#122552',
          700: '#1a3266',
        },
        spotter: {
          blue: '#2f6fed',
          'blue-dark': '#1e4fc2',
          'blue-light': '#5b8dff',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      keyframes: {
        scan: {
          '0%': { transform: 'translateY(-6%)' },
          '50%': { transform: 'translateY(106%)' },
          '100%': { transform: 'translateY(-6%)' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(14px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        blink: {
          '0%, 49%': { opacity: '1' },
          '50%, 100%': { opacity: '0' },
        },
      },
      animation: {
        scan: 'scan 4.5s ease-in-out infinite',
        'fade-up': 'fade-up 0.6s ease-out both',
        blink: 'blink 1s step-end infinite',
      },
    },
  },
  plugins: [],
};
