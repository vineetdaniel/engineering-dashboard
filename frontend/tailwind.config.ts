import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        cto: {
          900: "#0f172a",
          800: "#1e293b",
          accent: "#38bdf8",
        },
      },
    },
  },
  plugins: [],
};

export default config;
