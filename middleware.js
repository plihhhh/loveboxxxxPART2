// ==============================================
// middleware.js
// Middleware Next.js untuk proteksi route
// berdasarkan role pengguna (admin/user).
//
// Aturan akses:
//   /admin/*  → hanya role "admin" yang boleh akses
//   /user/*   → role "admin" dan "user" boleh akses
//   /         → halaman publik (login), tidak diproteksi
//
// JWT token dibaca dari cookie httpOnly bernama "token".
// Jika token tidak ada atau tidak valid → redirect ke /
// ==============================================

import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";

// --- Nama cookie tempat JWT disimpan ---
const COOKIE_NAME = "token";

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  // ==========================================
  // 1. Ambil token JWT dari cookie
  // ==========================================
  const token = request.cookies.get(COOKIE_NAME)?.value;

  // ==========================================
  // 2. Jika tidak ada token → redirect ke login
  // Pengguna belum login, tidak boleh akses
  // halaman admin maupun user.
  // ==========================================
  if (!token) {
    // Untuk API route, kembalikan JSON 401
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { message: "Silakan login terlebih dahulu" },
        { status: 401 }
      );
    }
    // Untuk halaman, redirect ke halaman login
    return NextResponse.redirect(new URL("/", request.url));
  }

  // ==========================================
  // 3. Verifikasi token JWT
  // Cek apakah token valid dan belum expired
  // ==========================================
  const payload = await verifyToken(token);

  // Jika token tidak valid atau expired → redirect ke login
  if (!payload) {
    // Untuk API route, kembalikan JSON 401
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { message: "Token tidak valid atau sudah expired" },
        { status: 401 }
      );
    }
    // Untuk halaman, redirect ke login dan hapus cookie rusak
    const response = NextResponse.redirect(new URL("/", request.url));
    response.cookies.delete(COOKIE_NAME);
    return response;
  }

  // ==========================================
  // 4. Cek akses berdasarkan role
  // ==========================================

  // --- Proteksi /admin/* → hanya role "admin" ---
  if (pathname.startsWith("/admin")) {
    if (payload.role !== "admin") {
      // Role "user" mencoba akses admin → redirect ke /user
      return NextResponse.redirect(new URL("/user", request.url));
    }
  }

  // --- Proteksi /user/* → role "admin" dan "user" boleh ---
  if (pathname.startsWith("/user")) {
    // Jika admin mengakses /user → redirect ke /admin
    // (Admin punya dashboard sendiri, tidak perlu ke halaman user)
    if (payload.role === "admin") {
      return NextResponse.redirect(new URL("/admin", request.url));
    }

    // Jika role bukan "admin" dan bukan "user" → redirect ke login
    if (payload.role !== "user") {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  // ==========================================
  // 5. Akses diizinkan → lanjutkan request
  // ==========================================
  return NextResponse.next();
}

// ==========================================
// Konfigurasi Matcher
// Tentukan route mana saja yang dilindungi
// oleh middleware ini.
//
// - /admin/:path*  → semua halaman admin
// - /user/:path*   → semua halaman user
// - /api/(...)     → semua API kecuali /api/auth/login
// ==========================================
export const config = {
  matcher: [
    "/admin/:path*",
    "/user/:path*",
    "/api/((?!auth/login).*)",
  ],
};
