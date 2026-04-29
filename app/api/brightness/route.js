// ==============================================
// app/api/brightness/route.js
// API Brightness — Mengatur kecerahan LED Love Box
// Akses: admin dan user
// ==============================================

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { publishCommand } from "@/lib/mqtt";

/**
 * POST /api/brightness
 *
 * Mengirim perintah kecerahan LED ke ESP32.
 * Admin dan user boleh mengakses endpoint ini.
 *
 * Body: { nilai: number }
 *   nilai = kecerahan 0 (mati) sampai 100 (terang penuh)
 *
 * MQTT payload: { type: "brightness", data: 75 }
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
    const { nilai } = await request.json();

    // Validasi: nilai harus ada
    if (nilai === undefined || nilai === null) {
      return NextResponse.json(
        { success: false, message: "Parameter 'nilai' wajib diisi" },
        { status: 400 }
      );
    }

    // Validasi: nilai harus angka antara 0-100
    const brightness = parseInt(nilai);
    if (isNaN(brightness) || brightness < 0 || brightness > 100) {
      return NextResponse.json(
        { success: false, message: "Nilai kecerahan harus antara 0-100" },
        { status: 400 }
      );
    }

    // --- Kirim perintah ke ESP32 via MQTT ---
    const success = await publishCommand("brightness", brightness);

    if (success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json(
        { success: false, message: "Gagal mengatur kecerahan. Perangkat mungkin offline." },
        { status: 503 }
      );
    }
  } catch (err) {
    console.error("❌ Error atur kecerahan:", err);
    return NextResponse.json(
      { success: false, message: "Terjadi kesalahan server" },
      { status: 500 }
    );
  }
}
