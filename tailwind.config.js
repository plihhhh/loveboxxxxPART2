/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Warna kustom untuk Love Box
        primary: "#F8B4C8",       // Pink lembut
        secondary: "#B4D4F8",     // Biru lembut
        accent: "#F8D4B4",        // Oranye lembut
        background: "#FFF5F7",    // Latar belakang pink muda
        "text-dark": "#4A4A4A",   // Teks gelap
      },
      fontFamily: {
        poppins: ["Poppins", "sans-serif"],
      },
      keyframes: {
        // Animasi fade-in untuk transisi halaman
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        // Animasi shake untuk login gagal
        shake: {
          "0%, 100%": { transform: "translateX(0)" },
          "10%, 30%, 50%, 70%, 90%": { transform: "translateX(-5px)" },
          "20%, 40%, 60%, 80%": { transform: "translateX(5px)" },
        },
        // Animasi pulse glow untuk efek romantis
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 5px rgba(248, 180, 200, 0.5)" },
          "50%": { boxShadow: "0 0 20px rgba(248, 180, 200, 0.8)" },
        },
        // Animasi float untuk elemen dekoratif
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.5s ease-out forwards",
        shake: "shake 0.5s ease-in-out",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        float: "float 3s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
