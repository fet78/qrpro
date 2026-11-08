import type { Config } from "tailwindcss";

/** Les couleurs sont des variables CSS (globals.css) : la palette vit à un seul endroit. */
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: token("ink"),
        muted: token("muted"),
        faint: token("faint"),
        line: token("line"),
        canvas: token("canvas"),
        surface: token("surface"),
        brand: { DEFAULT: token("brand"), strong: token("brand-strong"), soft: token("brand-soft") },
        success: { DEFAULT: token("success"), soft: token("success-soft") },
        warn: { DEFAULT: token("warn"), soft: token("warn-soft") },
        danger: { DEFAULT: token("danger"), soft: token("danger-soft") },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgb(15 23 42 / 0.04), 0 1px 3px rgb(15 23 42 / 0.06)",
        lift: "0 1px 2px rgb(15 23 42 / 0.04), 0 12px 32px -8px rgb(15 23 42 / 0.16)",
        ring: "0 0 0 4px rgb(var(--brand) / 0.14)",
      },
      borderRadius: { xl: "14px", "2xl": "18px" },
      keyframes: {
        "fade-up": { from: { opacity: "0", transform: "translateY(6px)" }, to: { opacity: "1", transform: "none" } },
      },
      animation: { "fade-up": "fade-up .35s cubic-bezier(.2,.8,.2,1) both" },
    },
  },
  plugins: [],
};

export default config;
