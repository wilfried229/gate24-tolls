/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      animation: {
        'pulse-glow': 'pulse-glow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 3s linear infinite',
        'fade-in': 'fade-in 0.5s ease-in-out',
        'slide-up': 'slide-up 0.3s ease-out',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'bounce-slow': 'bounce 2s infinite',
        'float': 'float 3s ease-in-out infinite',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': {
            opacity: 1,
            transform: 'scale(1)',
          },
          '50%': {
            opacity: 0.8,
            transform: 'scale(1.05)',
          },
        },
        'fade-in': {
          '0%': {
            opacity: 0,
            transform: 'translateY(20px)',
          },
          '100%': {
            opacity: 1,
            transform: 'translateY(0)',
          },
        },
        'slide-up': {
          '0%': {
            transform: 'translateY(30px)',
            opacity: 0,
          },
          '100%': {
            transform: 'translateY(0)',
            opacity: 1,
          },
        },
        'glow': {
          '0%': {
            'box-shadow': '0 0 20px rgba(99, 102, 241, 0.5)',
          },
          '100%': {
            'box-shadow': '0 0 30px rgba(99, 102, 241, 0.8), 0 0 40px rgba(99, 102, 241, 0.4)',
          },
        },
        'float': {
          '0%, 100%': {
            transform: 'translateY(0px)',
          },
          '50%': {
            transform: 'translateY(-10px)',
          },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
}
