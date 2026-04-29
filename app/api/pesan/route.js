// ==============================================
// app/api/pesan/route.js
// API Pesan — Mengirim pesan cinta ke Love Box
// Akses: admin dan user
// ==============================================

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { publishCommand } from "@/lib/mqtt";

// Batas maksimal karakter pesan
const MAX_TEKS_LENGTH = 100;

/**
 * POST /api/pesan
 *
 * Mengirim pesan teks ke ESP32 untuk ditampilkan
 * pada layar Love Box.
 * Admin dan user boleh mengakses endpoint ini.
 *
 * Body: { teks: string, warna: string, ukuran: number }
 *   teks   = isi pesan (max 100 karakter)
 *   warna  = warna teks dalam hex (contoh: "#FF69B4")
 *   ukuran = ukuran font dalam pixel (contoh: 16)
 *
 * MQTT payload:
 *   { type: "pesan", data: { teks, warna, ukuran, font } }
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
    const { teks, pesan, warna, ukuran, font } = await request.json();
    const finalTeks = teks || pesan;

    // Validasi: teks tidak boleh kosong
    if (!finalTeks || !finalTeks.trim()) {
      return NextResponse.json(
        { success: false, message: "Pesan tidak boleh kosong" },
        { status: 400 }
      );
    }

    // Validasi: teks maksimal 100 karakter
    if (finalTeks.length > MAX_TEKS_LENGTH) {
      return NextResponse.json(
        {
          success: false,
          message: `Pesan maksimal ${MAX_TEKS_LENGTH} karakter`,
        },
        { status: 400 }
      );
    }

    // --- Kirim pesan ke ESP32 via MQTT ---
    const success = await publishCommand("pesan", {
      teks: finalTeks.trim(),
      warna: warna || "#FF69B4",   // Default: hot pink
      ukuran: ukuran || 16,         // Default: 16px
      font: font || "Sans-serif"    // Default: Sans-serif
    });

    if (success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json(
        { success: false, message: "Gagal mengirim pesan. Perangkat mungkin offline." },
        { status: 503 }
      );
    }
  } catch (err) {
    console.error("❌ Error kirim pesan:", err);
    return NextResponse.json(
      { success: false, message: "Terjadi kesalahan server" },
      { status: 500 }
    );
  }
}
