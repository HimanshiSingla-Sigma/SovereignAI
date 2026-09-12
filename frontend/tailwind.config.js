/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Themeable SCADA industrial palette via CSS variables
        base: 'rgb(var(--color-base) / <alpha-value>)',
        card: 'rgb(var(--color-card) / <alpha-value>)',
        sidebar: 'rgb(var(--color-sidebar) / <alpha-value>)',
        hairline: 'rgb(var(--color-hairline) / <alpha-value>)',
        raised: 'rgb(var(--color-raised) / <alpha-value>)',
        ink: 'rgb(var(--color-ink) / <alpha-value>)',
        muted: 'rgb(var(--color-muted) / <alpha-value>)',
        accent: 'rgb(var(--color-accent) / <alpha-value>)',
        ok: 'rgb(var(--color-ok) / <alpha-value>)',
        warn: 'rgb(var(--color-warn) / <alpha-value>)',
        crit: 'rgb(var(--color-crit) / <alpha-value>)',
        info: 'rgb(var(--color-info) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      borderRadius: { card: '12px', ctl: '10px' },
      boxShadow: {
        panel: '0 1px 0 0 rgba(255,255,255,0.03) inset, 0 8px 24px -12px rgba(0,0,0,0.8)',
        glowok: '0 0 12px rgba(63,185,80,0.55)',
        glowwarn: '0 0 14px rgba(210,153,34,0.65)',
        glowcrit: '0 0 18px rgba(248,81,73,0.75)',
        glowaccent: '0 0 14px rgba(245,166,35,0.5)',
      },
      keyframes: {
        beaconBlink: { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.15' } },
        beaconStrobe: {
          '0%,100%': { opacity: '1', transform: 'scale(1)' },
          '45%': { opacity: '0.1', transform: 'scale(0.82)' },
          '55%': { opacity: '1', transform: 'scale(1.12)' },
        },
        hazardPulse: { '0%,100%': { opacity: '0.35' }, '50%': { opacity: '0.95' } },
        hazardSlide: { '0%': { backgroundPosition: '0 0' }, '100%': { backgroundPosition: '64px 0' } },
        nodePulse: {
          '0%,100%': { filter: 'drop-shadow(0 0 3px currentColor)' },
          '50%': { filter: 'drop-shadow(0 0 12px currentColor)' },
        },
        scanSweep: { '0%': { transform: 'translateY(-100%)' }, '100%': { transform: 'translateY(600%)' } },
        fadeUp: { '0%': { opacity: '0', transform: 'translateY(6px)' }, '100%': { opacity: '1', transform: 'none' } },
      },
      animation: {
        'beacon-blink': 'beaconBlink 1.1s ease-in-out infinite',
        'beacon-strobe': 'beaconStrobe 0.5s steps(2,end) infinite',
        'hazard-pulse': 'hazardPulse 1.05s ease-in-out infinite',
        'hazard-slide': 'hazardSlide 1.2s linear infinite',
        'node-pulse': 'nodePulse 1.4s ease-in-out infinite',
        'scan-sweep': 'scanSweep 2.4s ease-in-out infinite',
        'fade-up': 'fadeUp 0.18s ease-out',
      },
    },
  },
  plugins: [],
}
