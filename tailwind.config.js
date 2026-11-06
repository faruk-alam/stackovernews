/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './templates/**/*.html',
    './build.js',
    './static/js/**/*.js',
    './dist/**/*.html'
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto',
          'Helvetica Neue', 'Arial', 'Noto Sans', 'sans-serif'
        ],
        serif: ['ui-serif', 'Georgia', 'Cambria', 'Times New Roman', 'Times', 'serif']
      },
      colors: {
        brand: {
          50: '#fff1f1',
          100: '#ffe0e0',
          500: '#dc2626',
          600: '#b91c1c',
          700: '#991b1b'
        }
      },
      typography: (theme) => ({
        DEFAULT: {
          css: {
            maxWidth: 'none',
            a: { color: theme('colors.brand.600'), textDecoration: 'underline', textUnderlineOffset: '3px' },
            'a:hover': { color: theme('colors.brand.700') },
            img: { borderRadius: theme('borderRadius.lg') }
          }
        },
        invert: {
          css: {
            a: { color: '#f87171' },
            'a:hover': { color: '#fca5a5' }
          }
        }
      })
    }
  },
  plugins: [require('@tailwindcss/typography')]
};
