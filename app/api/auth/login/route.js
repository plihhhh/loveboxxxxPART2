// ==============================================
// app/api/auth/login/route.js
// API Login — Memproses autentikasi pengguna
// ==============================================

import { NextResponse } from "next/server";
import { generateToken } from "@/lib/auth";

// Nama cookie untuk menyimpan JWT token
const COOKIE_NAME = "token";

/**
 * POST /api/auth/login
 *
 * Menerima username dan password, validasi terhadap
 * kredensial di .env.local. Jika valid, buat JWT token
 * dan simpan ke cookie httpOnly.
 *
 * Body: { username: string, password: string }
 *
 * Response sukses:
 *   { success: true, role: "admin" | "user" }
 *
 * Response gagal:
 *   401 { success: false, message: "Username atau password salah" }
 */
export async function POST(request) {
  try {
    const { username, password } = await request.json();

    // --- Validasi input ---
    if (!username || !password) {
      return NextResponse.json(
        { success: false, message: "Username dan password wajib diisi" },
        { status: 400 }
      );
    }

    // --- Cek kredensial terhadap .env.local ---
    let role = null;

    // Cek akun admin (Muflih)
    if (
      username === process.env.ADMIN_USERNAME &&
      password === process.env.ADMIN_PASSWORD
    ) {
      role = "admin";
    }

    // Cek akun user (Suci)
    if (
      username === process.env.USER_USERNAME &&
      password === process.env.USER_PASSWORD
    ) {
      role = "user";
    }

    // --- Jika kredensial tidak cocok → tolak ---
    if (!role) {
      return NextResponse.json(
        { success: false, message: "Username atau password salah" },
        { status: 401 }
      );
    }

    // --- Buat JWT token ---
    const token = await generateToken(username, role);

    // --- Buat response dan set cookie httpOnly ---
    const response = NextResponse.json({
      success: true,
      role,
    });

    // Set cookie httpOnly bernama "token", expire 7 hari
    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,                                  // Tidak bisa diakses dari JS client
      secure: process.env.NODE_ENV === "production",   // HTTPS only di production
      sameSite: "lax",                                 // Proteksi CSRF dasar
      maxAge: 60 * 60 * 24 * 7,                        // 7 hari dalam detik
      path: "/",                                       // Berlaku untuk semua path
    });

    return response;
  } catch (err) {
    console.error("❌ Error di login:", err);
    return NextResponse.json(
      { success: false, message: "Terjadi kesalahan server" },
      { status: 500 }
    );
  }
}
