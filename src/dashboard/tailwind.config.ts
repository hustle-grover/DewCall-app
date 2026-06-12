import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'dew-bg':       '#FDFAF6',
        'dew-surface':  '#FFFFFF',
        'dew-primary':  '#4A7C6F',
        'dew-accent':   '#E8956D',
        'dew-text':     '#2D2D2D',
        'dew-muted':    '#717171',
        'dew-border':   '#EDE8E0',
        'dew-flag-bg':    '#FEF3EC',
        'dew-flag-text':  '#C4521A',
        'dew-chip-bg':    '#EEF3F1',
        'dew-primary-dk': '#3D6B60',
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        body:    ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card:   '12px',
        button: '8px',
        modal:  '16px',
        pill:   '20px',
      },
      boxShadow: {
        card:       '0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)',
        'card-hover': '0 2px 8px rgba(0,0,0,0.08), 0 8px 24px rgba(0,0,0,0.06)',
      },
      maxWidth: {
        content: '680px',
      },
    },
  },
  plugins: [],
}

export default config
