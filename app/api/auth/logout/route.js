// ==============================================
// app/api/auth/logout/route.js
// API Logout — Menghapus sesi pengguna
// ==============================================

import { NextResponse } from "next/server";

// Nama cookie yang harus dihapus saat logout
const COOKIE_NAME = "token";

/**
 * GET /api/auth/logout
 *
 * Menghapus cookie "token" untuk mengakhiri sesi.
 * Tidak memerlukan body request.
 *
 * Response: { success: true }
 */
export async function GET() {
  try {
    const response = NextResponse.json({ success: true });

    // Hapus cookie token dengan set maxAge ke 0
    response.cookies.set(COOKIE_NAME, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0,     // Langsung expired = terhapus
      path: "/",
    });

    return response;
  } catch (err) {
    console.error("❌ Error di logout:", err);
    return NextResponse.json(
      { success: false, message: "Terjadi kesalahan saat logout" },
      { status: 500 }
    );
  }
}
