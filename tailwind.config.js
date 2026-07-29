/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // CourtConnect Green - primary brand color, CTAs, active states
        primary: {
          50: '#E7F6EA',
          100: '#C8ECD2',
          200: '#9FDCB1',
          300: '#6FC98C',
          400: '#2FA84A',
          500: '#0B5A2A',
          600: '#094D24',
          700: '#063F1F',
          800: '#04331A',
          900: '#032511',
        },
        // CourtConnect Navy - secondary brand color
        navy: {
          50: '#EAF1FA',
          100: '#CBDBEF',
          200: '#A3C0E0',
          300: '#729FCB',
          400: '#3D74A8',
          500: '#0E3567',
          600: '#0C2D58',
          700: '#102B4F',
          800: '#0A2039',
          900: '#061627',
        },
        secondary: {
          50: '#F8FAFC',
          100: '#F1F5F9',
          200: '#E2E8F0',
          300: '#CBD5E1',
          400: '#94A3B8',
          500: '#64748B',
          600: '#475569',
          700: '#334155',
          800: '#1E293B',
          900: '#0B1020',
          950: '#020617',
        },
        accent: {
          50: '#FFFBEB',
          100: '#FEF3C7',
          200: '#FDE68A',
          300: '#FCD34D',
          400: '#FBBF24',
          500: '#F59E0B',
          600: '#D97706',
          700: '#B45309',
          800: '#92400E',
          900: '#78350F',
        },
        // Subtle Clay Accent - tennis/court warmth, used sparingly, never
        // as a primary brand color
        clay: {
          400: '#D68A5C',
          500: '#C96C32',
          600: '#A85527',
        },
        cream: '#F6F3EA',
        gray: {
          50: '#FAFAF8',
          100: '#F4F4F1',
          200: '#E5E7EB',
          300: '#D9DDE2',
          400: '#9CA3AF',
          500: '#6B7280',
          600: '#4B5563',
          700: '#374151',
          800: '#1F2937',
          900: '#111827',
        },
      },
      fontFamily: {
        sans: ['"Instrument Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Bricolage Grotesque"', '"Instrument Sans"', 'ui-sans-serif', 'sans-serif'],
      },
      boxShadow: {
        'soft': '0 1px 2px rgba(11,16,32,0.04), 0 8px 24px -8px rgba(11,90,42,0.14)',
        'card': '0 1px 2px rgba(11,16,32,0.05), 0 6px 16px -6px rgba(14,53,103,0.10)',
        'elevated': '0 4px 10px rgba(11,16,32,0.06), 0 24px 48px -16px rgba(11,90,42,0.20)',
        'nav': '0 1px 2px rgba(11,16,32,0.04), 0 4px 12px -4px rgba(14,53,103,0.08)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'scale-in': 'scaleIn 0.3s ease-out',
        'bounce-subtle': 'bounceSubtle 2s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        bounceSubtle: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [],
};
