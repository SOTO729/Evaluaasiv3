/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    screens: {
      'xs': '375px',      // iPhone SE, móviles pequeños
      'sm': '640px',      // Móviles grandes, landscape
      'md': '768px',      // Tablets
      'lg': '1024px',     // Tablets landscape, laptops pequeñas
      'xl': '1280px',     // Laptops, monitores pequeños
      '2xl': '1536px',    // Monitores medianos
      '3xl': '1920px',    // Full HD
      '4xl': '2560px',    // QHD, 2K
      '5xl': '3840px',    // 4K, TVs grandes
    },
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
        '26': '6.5rem',
        '30': '7.5rem',
        '34': '8.5rem',
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
        '5xl': ['3rem', { lineHeight: '1' }],
        '6xl': ['3.75rem', { lineHeight: '1' }],
        '7xl': ['4.5rem', { lineHeight: '1' }],
        '8xl': ['6rem', { lineHeight: '1' }],
      },
      maxWidth: {
        '8xl': '88rem',
        '9xl': '96rem',
        'screen-3xl': '1920px',
        'screen-4xl': '2560px',
      },
      animation: {
        'slide-in': 'slideIn 0.3s ease-out forwards',
        'fadeSlideIn': 'fadeSlideIn 0.3s ease-out forwards',
      },
      keyframes: {
        slideIn: {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        fadeSlideIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
