// ==============================================
// app/api/ota/route.js
// API OTA — Upload firmware dan kirim ke ESP32
// Akses: HANYA admin
// ==============================================

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { v2 as cloudinary } from "cloudinary";
import { verifyToken } from "@/lib/auth";
import { publishCommand } from "@/lib/mqtt";

// --- Konfigurasi Cloudinary ---
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * POST /api/ota
 *
 * Upload file firmware (.bin) ke Cloudinary sebagai
 * raw file, lalu kirim URL ke ESP32 via MQTT agar
 * ESP32 bisa mengunduh dan memperbarui firmware-nya.
 *
 * Auth: HANYA admin yang boleh akses endpoint ini.
 *       User biasa akan mendapat 403 Forbidden.
 *
 * Body: FormData dengan field "firmware" (file .bin)
 *
 * Cloudinary config:
 *   - Folder: lovebox/firmware
 *   - Resource type: raw (bukan image)
 *
 * MQTT payload: { type: "ota", data: "https://...firmware.bin" }
 *
 * Response sukses: { success: true, url: "https://..." }
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

    // --- Cek role: HANYA admin yang boleh akses OTA ---
    if (payload.role !== "admin") {
      return NextResponse.json(
        { success: false, message: "Hanya admin yang boleh melakukan OTA update" },
        { status: 403 }
      );
    }

    // --- Ambil file firmware dari FormData ---
    const formData = await request.formData();
    const file = formData.get("firmware");

    // Validasi: file harus ada
    if (!file) {
      return NextResponse.json(
        { success: false, message: "Field 'firmware' wajib diisi" },
        { status: 400 }
      );
    }

    // Validasi: file harus berekstensi .bin
    if (!file.name.endsWith(".bin")) {
      return NextResponse.json(
        { success: false, message: "File firmware harus berformat .bin" },
        { status: 400 }
      );
    }

    // Validasi: ukuran maksimal 2MB (firmware ESP32 biasanya < 2MB)
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, message: "Ukuran firmware maksimal 2MB" },
        { status: 400 }
      );
    }

    // --- Konversi file ke base64 ---
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64Data = `data:application/octet-stream;base64,${buffer.toString("base64")}`;

    // --- Upload ke Cloudinary sebagai raw file ---
    const uploadResult = await cloudinary.uploader.upload(base64Data, {
      folder: "lovebox/firmware",          // Simpan di folder lovebox/firmware
      resource_type: "raw",                 // Tipe: raw file (bukan image)
      public_id: `firmware_${Date.now()}`,  // Nama unik berdasarkan timestamp
    });

    const firmwareUrl = uploadResult.secure_url;

    // --- Kirim URL firmware ke ESP32 via MQTT ---
    const mqttSuccess = await publishCommand("ota", firmwareUrl);

    if (!mqttSuccess) {
      console.warn("⚠️ Firmware terupload tapi gagal kirim ke ESP32 via MQTT");
    }

    return NextResponse.json({
      success: true,
      url: firmwareUrl,
    });
  } catch (err) {
    console.error("❌ Error OTA update:", err);
    return NextResponse.json(
      { success: false, message: "Gagal upload firmware: " + err.message },
      { status: 500 }
    );
  }
}
