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
        // Espaciados fluidos como extensión
        'fluid-1': 'var(--space-1)',
        'fluid-2': 'var(--space-2)',
        'fluid-3': 'var(--space-3)',
        'fluid-4': 'var(--space-4)',
        'fluid-5': 'var(--space-5)',
        'fluid-6': 'var(--space-6)',
        'fluid-8': 'var(--space-8)',
        'fluid-10': 'var(--space-10)',
        'fluid-12': 'var(--space-12)',
        'fluid-16': 'var(--space-16)',
        'fluid-20': 'var(--space-20)',
        'fluid-24': 'var(--space-24)',
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
        '5xl': ['3rem', { lineHeight: '1' }],
        '6xl': ['3.75rem', { lineHeight: '1' }],
        '7xl': ['4.5rem', { lineHeight: '1' }],
        '8xl': ['6rem', { lineHeight: '1' }],
        // Tamaños de fuente fluidos
        'fluid-2xs': ['var(--text-2xs)', { lineHeight: '1.4' }],
        'fluid-xs': ['var(--text-xs)', { lineHeight: '1.4' }],
        'fluid-sm': ['var(--text-sm)', { lineHeight: '1.5' }],
        'fluid-base': ['var(--text-base)', { lineHeight: '1.5' }],
        'fluid-lg': ['var(--text-lg)', { lineHeight: '1.5' }],
        'fluid-xl': ['var(--text-xl)', { lineHeight: '1.4' }],
        'fluid-2xl': ['var(--text-2xl)', { lineHeight: '1.3' }],
        'fluid-3xl': ['var(--text-3xl)', { lineHeight: '1.2' }],
        'fluid-4xl': ['var(--text-4xl)', { lineHeight: '1.1' }],
        'fluid-5xl': ['var(--text-5xl)', { lineHeight: '1' }],
        'fluid-6xl': ['var(--text-6xl)', { lineHeight: '1' }],
      },
      maxWidth: {
        '8xl': '88rem',
        '9xl': '96rem',
        'screen-3xl': '1920px',
        'screen-4xl': '2560px',
        // Contenedores fluidos
        'fluid-sm': 'var(--container-sm)',
        'fluid-md': 'var(--container-md)',
        'fluid-lg': 'var(--container-lg)',
        'fluid-xl': 'var(--container-xl)',
        'fluid-2xl': 'var(--container-2xl)',
        'fluid-full': 'var(--container-full)',
      },
      borderRadius: {
        'fluid-sm': 'var(--border-radius-sm)',
        'fluid': 'var(--border-radius)',
        'fluid-md': 'var(--border-radius-md)',
        'fluid-lg': 'var(--border-radius-lg)',
        'fluid-xl': 'var(--border-radius-xl)',
        'fluid-2xl': 'var(--border-radius-2xl)',
      },
      height: {
        'fluid-header': 'var(--header-height)',
        'fluid-btn-sm': 'var(--btn-height-sm)',
        'fluid-btn': 'var(--btn-height)',
        'fluid-btn-lg': 'var(--btn-height-lg)',
        'fluid-input': 'var(--input-height)',
      },
      width: {
        'fluid-icon-xs': 'var(--icon-xs)',
        'fluid-icon-sm': 'var(--icon-sm)',
        'fluid-icon': 'var(--icon-base)',
        'fluid-icon-lg': 'var(--icon-lg)',
        'fluid-icon-xl': 'var(--icon-xl)',
        'fluid-icon-2xl': 'var(--icon-2xl)',
        'fluid-icon-3xl': 'var(--icon-3xl)',
      },
      gap: {
        'fluid-1': 'var(--space-1)',
        'fluid-2': 'var(--space-2)',
        'fluid-3': 'var(--space-3)',
        'fluid-4': 'var(--space-4)',
        'fluid-5': 'var(--space-5)',
        'fluid-6': 'var(--space-6)',
        'fluid-8': 'var(--space-8)',
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
