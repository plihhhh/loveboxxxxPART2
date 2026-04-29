// ==============================================
// app/api/mode/route.js
// API Mode — Mengganti mode LED Love Box
// Akses: admin dan user
// ==============================================

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { publishCommand } from "@/lib/mqtt";

/**
 * POST /api/mode
 *
 * Mengirim perintah ganti mode LED ke ESP32.
 * Admin dan user boleh mengakses endpoint ini.
 *
 * Body: { modes: [1, 2, 3] }
 *   modes = array angka mode LED yang ingin diaktifkan
 *
 * MQTT payload: { type: "mode", data: [1, 2, 3] }
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
    const { modes } = await request.json();

    // Validasi: modes harus berupa array
    if (!modes || !Array.isArray(modes)) {
      return NextResponse.json(
        { success: false, message: "Parameter 'modes' harus berupa array" },
        { status: 400 }
      );
    }

    // --- Kirim perintah ke ESP32 via MQTT ---
    const success = await publishCommand("mode", modes);

    if (success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json(
        { success: false, message: "Gagal mengirim perintah ke Love Box" },
        { status: 503 }
      );
    }
  } catch (err) {
    console.error("❌ Error ganti mode:", err);
    return NextResponse.json(
      { success: false, message: "Terjadi kesalahan server" },
      { status: 500 }
    );
  }
}
