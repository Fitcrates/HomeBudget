const { fontFamily } = require("tailwindcss/defaultTheme");

module.exports = {
  mode: "jit",
  purge: ["./index.html", "./src/**/*.{vue,js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Nunito", ...fontFamily.sans],
        heading: ["Poppins", ...fontFamily.sans],
      },
      colors: {
        brand: {
          light: "var(--color-light)",
          top: "var(--color-app-top)",
          dark: "var(--color-dark)",
          accent: "var(--accent)",
          "accent-dark": "var(--accent-dark)",
          "accent-light": "var(--accent-light)",
        },
        text: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          muted: "var(--text-muted)",
          faint: "var(--text-faint)",
        },
        surface: {
          card: "var(--surface-card)",
          "card-inner": "var(--surface-card-inner)",
          input: "var(--surface-input)",
          warm: "var(--surface-warm)",
        },
        status: {
          success: "var(--color-success)",
          warning: "var(--color-warning)",
          danger: "var(--color-danger)",
        },
      },
      borderRadius: {
        DEFAULT: "var(--radius-sm)",
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        "2xl": "var(--radius-2xl)",
      },
      boxShadow: {
        card: "var(--shadow-card)",
        "card-hover": "var(--shadow-card-hover)",
        "card-sm": "var(--shadow-card-sm)",
        cta: "var(--shadow-cta)",
        "cta-hover": "var(--shadow-cta-hover)",
        tab: "var(--shadow-tab)",
        soft: "var(--shadow-soft)",
        "input-focus": "var(--shadow-input-focus)",
      },
      spacing: {
        "form-field": "16px",
        section: "32px",
      },
    },
  },
  variants: {
    extend: {
      boxShadow: ["hover", "active", "focus"],
    },
  },
};
