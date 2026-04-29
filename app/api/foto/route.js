// ==============================================
// app/api/foto/route.js
// API Foto — Upload, daftar, dan hapus foto
// GET: public | POST & DELETE: admin dan user
// ==============================================

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { promises as fs } from "fs";
import path from "path";
import { v2 as cloudinary } from "cloudinary";
import { verifyToken } from "@/lib/auth";
import { publishCommand } from "@/lib/mqtt";

// --- Konfigurasi Cloudinary ---
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// --- Path ke file database foto ---
const DB_PATH = path.join(process.cwd(), "foto-db.json");

/**
 * Membaca database foto dari file JSON
 * @returns {Promise<Array>} Array data foto
 */
async function readFotoDB() {
  try {
    const data = await fs.readFile(DB_PATH, "utf-8");
    return JSON.parse(data);
  } catch {
    // Jika file belum ada atau rusak, kembalikan array kosong
    return [];
  }
}

/**
 * Menyimpan data foto ke file JSON
 * @param {Array} data - Array data foto yang akan disimpan
 */
async function writeFotoDB(data) {
  await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2), "utf-8");
}

/**
 * Helper: Verifikasi JWT dan cek role admin/user
 * Digunakan untuk POST dan DELETE yang butuh auth
 * @returns {Object|NextResponse} payload jika valid, atau error response
 */
async function verifikasiAuth() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  // Tidak ada token
  if (!token) {
    return {
      error: NextResponse.json(
        { success: false, message: "Silakan login terlebih dahulu" },
        { status: 401 }
      ),
    };
  }

  // Verifikasi token
  const payload = await verifyToken(token);
  if (!payload) {
    return {
      error: NextResponse.json(
        { success: false, message: "Token tidak valid atau sudah expired" },
        { status: 401 }
      ),
    };
  }

  // Cek role — admin dan user boleh akses
  if (payload.role !== "admin" && payload.role !== "user") {
    return {
      error: NextResponse.json(
        { success: false, message: "Akses ditolak" },
        { status: 403 }
      ),
    };
  }

  return { payload };
}

// ==============================================
// GET /api/foto
//
// Mengambil daftar semua foto dari foto-db.json.
// Endpoint ini bersifat PUBLIC (tidak perlu auth).
//
// Response: Array of { id, url, publicId, uploadedBy, createdAt }
// ==============================================
export async function GET() {
  try {
    const fotoList = await readFotoDB();
    return NextResponse.json(fotoList);
  } catch (err) {
    console.error("❌ Error ambil daftar foto:", err);
    return NextResponse.json(
      { success: false, message: "Gagal mengambil data foto" },
      { status: 500 }
    );
  }
}

// ==============================================
// POST /api/foto
//
// Upload foto baru ke Cloudinary dan simpan datanya
// ke foto-db.json. Kirim URL foto ke ESP32 via MQTT.
//
// Auth: admin dan user boleh akses
//
// Body: FormData dengan field "foto" (file gambar)
//
// Cloudinary config:
//   - Folder: lovebox/photos
//   - Transformasi: width 128, height 160, crop fill
//
// Response sukses:
//   { success: true, foto: { id, url, publicId, uploadedBy, createdAt } }
//
// Response gagal:
//   { success: false, message: "..." }
// ==============================================
export async function POST(request) {
  try {
    // --- Verifikasi autentikasi ---
    const auth = await verifikasiAuth();
    if (auth.error) return auth.error;

    // --- Ambil file dari FormData ---
    const formData = await request.formData();
    const file = formData.get("foto");

    // Validasi: file harus ada
    if (!file) {
      return NextResponse.json(
        { success: false, message: "Field 'foto' wajib diisi" },
        { status: 400 }
      );
    }

    // Validasi: harus berupa file gambar
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { success: false, message: "File harus berupa gambar (JPG, PNG, dll)" },
        { status: 400 }
      );
    }

    // Validasi: ukuran maksimal 5MB
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, message: "Ukuran foto maksimal 5MB" },
        { status: 400 }
      );
    }

    // --- Konversi file ke base64 untuk upload Cloudinary ---
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64Data = `data:${file.type};base64,${buffer.toString("base64")}`;

    // --- Upload ke Cloudinary ---
    const uploadResult = await cloudinary.uploader.upload(base64Data, {
      folder: "lovebox/photos",                  // Simpan di folder lovebox/photos
      transformation: [
        { width: 128, height: 160, crop: "fill" }, // Transformasi ukuran untuk layar ESP32
      ],
    });

    // --- Simpan data foto ke database JSON ---
    const fotoData = {
      id: Date.now().toString(),
      url: uploadResult.secure_url,              // URL foto yang sudah di-transform
      publicId: uploadResult.public_id,          // ID Cloudinary (untuk hapus nanti)
      uploadedBy: auth.payload.username,         // Siapa yang upload
      createdAt: new Date().toISOString(),        // Waktu upload
    };

    const fotoList = await readFotoDB();
    fotoList.push(fotoData);
    await writeFotoDB(fotoList);

    // --- Kirim URL foto ke ESP32 via MQTT ---
    await publishCommand("foto", uploadResult.secure_url);

    return NextResponse.json({
      success: true,
      foto: fotoData,
    });
  } catch (err) {
    console.error("❌ Error upload foto:", err);
    return NextResponse.json(
      { success: false, message: "Gagal upload foto: " + err.message },
      { status: 500 }
    );
  }
}

// ==============================================
// DELETE /api/foto
//
// Menghapus foto dari Cloudinary dan foto-db.json.
//
// Auth: admin dan user boleh akses
//
// Body: { id: string }
//   id = ID foto yang ingin dihapus (dari foto-db.json)
//
// Proses:
//   1. Cari foto di database berdasarkan ID
//   2. Hapus dari Cloudinary menggunakan publicId
//   3. Hapus dari foto-db.json
//
// Response sukses: { success: true }
// Response gagal:  { success: false, message: "..." }
// ==============================================
export async function DELETE(request) {
  try {
    // --- Verifikasi autentikasi ---
    const auth = await verifikasiAuth();
    if (auth.error) return auth.error;

    // --- Ambil ID foto dari body ---
    const { id } = await request.json();

    if (!id) {
      return NextResponse.json(
        { success: false, message: "Parameter 'id' wajib diisi" },
        { status: 400 }
      );
    }

    // --- Cari foto di database ---
    const fotoList = await readFotoDB();
    const fotoIndex = fotoList.findIndex((f) => f.id === id);

    if (fotoIndex === -1) {
      return NextResponse.json(
        { success: false, message: "Foto tidak ditemukan" },
        { status: 404 }
      );
    }

    const foto = fotoList[fotoIndex];

    // --- Hapus dari Cloudinary menggunakan publicId ---
    if (foto.publicId) {
      try {
        await cloudinary.uploader.destroy(foto.publicId);
        console.log("🗑️ Foto dihapus dari Cloudinary:", foto.publicId);
      } catch (cloudErr) {
        console.error("⚠️ Gagal hapus dari Cloudinary:", cloudErr.message);
        // Lanjutkan hapus dari database meskipun Cloudinary gagal
      }
    }

    // --- Hapus dari database JSON ---
    fotoList.splice(fotoIndex, 1);
    await writeFotoDB(fotoList);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("❌ Error hapus foto:", err);
    return NextResponse.json(
      { success: false, message: "Gagal menghapus foto: " + err.message },
      { status: 500 }
    );
  }
}
