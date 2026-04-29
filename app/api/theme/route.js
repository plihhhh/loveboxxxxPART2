// ==============================================
// app/api/theme/route.js
// API Theme — Mengganti tema layar TFT 1.8" Love Box
// Akses: admin dan user
// ==============================================

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { publishCommand } from "@/lib/mqtt";

/**
 * POST /api/theme
 *
 * Mengirim perintah ganti tema UI layar TCT ke ESP32.
 * Admin dan user boleh mengakses endpoint ini.
 *
 * Body: { theme: "nama_tema" }
 *   theme = string id tema yang ingin diaktifkan (contoh: 'pastel_love', 'classic_dark')
 *
 * MQTT payload: { type: "theme", data: "nama_tema" }
 *
 * Response sukses: { success: true }
 * Response gagal:  { success: false, message: "..." }
 */
export async function POST(request) {
  try {
    // --- Verifikasi JWT dari cookie ---
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, message: "Silakan login terlebih dahulu" },
        { status: 401 }
      );
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        { success: false, message: "Token tidak valid atau sudah expired" },
        { status: 401 }
      );
    }

    // Admin dan user keduanya boleh akses
    if (payload.role !== "admin" && payload.role !== "user") {
      return NextResponse.json(
        { success: false, message: "Akses ditolak" },
        { status: 403 }
      );
    }

    // --- Ambil data dari body request ---
    const { theme } = await request.json();

    // Validasi input
    if (!theme || typeof theme !== "string") {
      return NextResponse.json(
        { success: false, message: "Parameter 'theme' harus diisi." },
        { status: 400 }
      );
    }

    // --- Kirim perintah ke ESP32 via MQTT ---
    const success = await publishCommand("theme", theme);

    if (success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json(
        { success: false, message: "Gagal mengirim perintah tema ke Love Box" },
        { status: 503 }
      );
    }
  } catch (err) {
    console.error("❌ Error ganti tema:", err);
    return NextResponse.json(
      { success: false, message: "Terjadi kesalahan server" },
      { status: 500 }
    );
  }
}
