// app/layout.jsx
// Layout utama aplikasi Love Box

import "./globals.css";

// Metadata SEO untuk Love Box
export const metadata = {
  title: "Love Box 💝 - Muflih & Suci",
  description:
    "Love Box - Kotak cinta digital untuk mengirim pesan, foto, dan kontrol LED untuk orang tersayang.",
  keywords: ["love box", "IoT", "pesan cinta", "LED", "ESP32"],
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body className="min-h-screen bg-gradient-love">
        {/* Elemen dekoratif latar belakang */}
        <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
          {/* Lingkaran dekoratif pink */}
          <div className="absolute -top-20 -right-20 w-72 h-72 bg-primary/10 rounded-full blur-3xl animate-float" />
          {/* Lingkaran dekoratif biru */}
          <div className="absolute -bottom-20 -left-20 w-72 h-72 bg-secondary/10 rounded-full blur-3xl animate-float [animation-delay:1.5s]" />
          {/* Lingkaran dekoratif aksen */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
        </div>

        {/* Konten utama */}
        <main className="relative min-h-screen">{children}</main>
      </body>
    </html>
  );
}
