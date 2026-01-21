/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Breakpoints extendidos para pantallas grandes (TV, 4K, 8K)
      screens: {
        'sm': '640px',
        'md': '768px',
        'lg': '1024px',
        'xl': '1280px',
        '2xl': '1536px',
        '3xl': '1920px',  // Full HD / TV
        '4xl': '2560px',  // QHD / 2K
        '5xl': '3840px',  // 4K UHD
        '6xl': '5120px',  // 5K
        '8k': '7680px',   // 8K UHD
      },
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
      // Tamaños de fuente fluidos
      fontSize: {
        'fluid-xs': 'clamp(0.65rem, 0.6rem + 0.25vw, 0.875rem)',
        'fluid-sm': 'clamp(0.75rem, 0.7rem + 0.3vw, 1rem)',
        'fluid-base': 'clamp(0.875rem, 0.8rem + 0.4vw, 1.125rem)',
        'fluid-lg': 'clamp(1rem, 0.9rem + 0.5vw, 1.375rem)',
        'fluid-xl': 'clamp(1.125rem, 1rem + 0.6vw, 1.5rem)',
        'fluid-2xl': 'clamp(1.25rem, 1.1rem + 0.75vw, 1.875rem)',
        'fluid-3xl': 'clamp(1.5rem, 1.25rem + 1vw, 2.25rem)',
        'fluid-4xl': 'clamp(1.875rem, 1.5rem + 1.5vw, 3rem)',
        'fluid-5xl': 'clamp(2.25rem, 1.75rem + 2vw, 4rem)',
      },
      // Espaciado fluido
      spacing: {
        'fluid-1': 'clamp(0.2rem, 0.15rem + 0.25vw, 0.375rem)',
        'fluid-2': 'clamp(0.4rem, 0.35rem + 0.25vw, 0.625rem)',
        'fluid-3': 'clamp(0.6rem, 0.5rem + 0.5vw, 1rem)',
        'fluid-4': 'clamp(0.8rem, 0.7rem + 0.5vw, 1.25rem)',
        'fluid-5': 'clamp(1rem, 0.85rem + 0.75vw, 1.5rem)',
        'fluid-6': 'clamp(1.25rem, 1rem + 1vw, 2rem)',
        'fluid-8': 'clamp(1.5rem, 1.25rem + 1.25vw, 2.5rem)',
        'fluid-10': 'clamp(2rem, 1.5rem + 2vw, 3.5rem)',
        'fluid-12': 'clamp(2.5rem, 2rem + 2.5vw, 4.5rem)',
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
