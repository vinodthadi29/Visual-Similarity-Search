/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./components/**/*.{js,ts,jsx,tsx,mdx}",
        "./app/**/*.{js,ts,jsx,tsx,mdx}",
        "./templates/**/*.html",
    ],
    theme: {
        extend: {
            colors: {
                primary: {
                    DEFAULT: "hsl(var(--primary))",
                    foreground: "hsl(var(--primary-foreground))",
                },
                background: "hsl(var(--background))",
                foreground: "hsl(var(--foreground))",
            },
            keyframes: {
                "pulse-slow": {
                    '0%, 100%': {
                        transform: 'translateX(-100%)',
                    },
                    '50%': {
                        transform: 'translateX(100%)',
                    },
                },
            },
            animation: {
                "pulse-slow": "pulse-slow 3s ease-in-out infinite",
            },
        },
    },
    plugins: [],
}
