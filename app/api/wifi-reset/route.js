// ==============================================
// app/api/wifi-reset/route.js
// API WiFi Reset — Mereset kredensial WiFi di ESP32
// Akses: hanya admin
// ==============================================

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { publishCommand } from "@/lib/mqtt";

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

    // Hanya Admin yang boleh reset WiFi
    if (payload.role !== "admin") {
      return NextResponse.json(
        { success: false, message: "Akses ditolak. Fitur ini hanya untuk admin." },
        { status: 403 }
      );
    }

    // --- Kirim perintah ke ESP32 via MQTT ---
    const success = await publishCommand("wifi_reset", true);

    if (success) {
      return NextResponse.json({ 
        success: true, 
        message: "Perintah reset WiFi dikirim"
      });
    } else {
      return NextResponse.json(
        { success: false, message: "Gagal mengirim perintah reset WiFi ke perangkat" },
        { status: 503 }
      );
    }
  } catch (err) {
    console.error("❌ Error reset WiFi:", err);
    return NextResponse.json(
      { success: false, message: "Terjadi kesalahan server" },
      { status: 500 }
    );
  }
}
