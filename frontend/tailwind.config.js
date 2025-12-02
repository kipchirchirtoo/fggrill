/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './src/pages/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
    './src/app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        // iOS System Colors
        ios: {
          blue: {
            light: '#007AFF',
            dark: '#0A84FF',
          },
          green: {
            light: '#34C759',
            dark: '#30D158',
          },
          indigo: {
            light: '#5856D6',
            dark: '#5E5CE6',
          },
          orange: {
            light: '#FF9500',
            dark: '#FF9F0A',
          },
          pink: {
            light: '#FF2D55',
            dark: '#FF375F',
          },
          purple: {
            light: '#AF52DE',
            dark: '#BF5AF2',
          },
          red: {
            light: '#FF3B30',
            dark: '#FF453A',
          },
          teal: {
            light: '#5AC8FA',
            dark: '#64D2FF',
          },
          yellow: {
            light: '#FFCC00',
            dark: '#FFD60A',
          },
          // iOS Gray Colors
          gray: {
            1: '#8E8E93',
            2: '#AEAEB2',
            3: '#C7C7CC',
            4: '#D1D1D6',
            5: '#E5E5EA',
            6: '#F2F2F7',
          },
          // iOS UI Elements
          background: {
            light: '#FFFFFF',
            dark: '#000000',
          },
          secondaryBackground: {
            light: '#F2F2F7',
            dark: '#1C1C1E',
          },
          groupedBackground: {
            light: '#F2F2F7',
            dark: '#1C1C1E',
          },
          separator: {
            light: 'rgba(60, 60, 67, 0.29)',
            dark: 'rgba(84, 84, 88, 0.6)',
          },
        },
        // Keep compatibility with existing system
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        // iOS specific border radii
        'ios-sm': '6px',
        'ios-md': '10px',  
        'ios-lg': '14px',
        'ios-xl': '20px',
        'ios-2xl': '24px',
        'ios-full': '9999px', // Fully rounded pill shape
        // Keep compatibility with existing system
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        'ios-sm': '0 1px 3px rgba(0, 0, 0, 0.1)',
        'ios-md': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        'ios-lg': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
      },
      fontFamily: {
        'sf-pro': ['SF Pro Text', 'system-ui', 'sans-serif'],
        'sf-pro-display': ['SF Pro Display', 'system-ui', 'sans-serif'],
        'sf-mono': ['SF Mono', 'ui-monospace', 'monospace'],
      },
      keyframes: {
        "accordion-down": {
          from: { height: 0 },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: 0 },
        },
        // iOS specific animations
        "ios-fade-in": {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        "ios-slide-up": {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        "ios-scale": {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "ios-fade-in": "ios-fade-in 0.3s ease-out",
        "ios-slide-up": "ios-slide-up 0.3s ease-out",
        "ios-scale": "ios-scale 0.3s ease-out",
      },
      backdropBlur: {
        'ios': '20px',
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
