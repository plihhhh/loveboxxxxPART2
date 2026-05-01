// ==============================================
// app/api/foto-upload/route.js
// Terima URL foto dari Cloudinary (sudah di-upload client-side),
// simpan ke foto-db.json, dan kirim ke ESP32 via MQTT.
// Auth: admin dan user boleh akses
// ==============================================

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { promises as fs } from "fs";
import path from "path";
import { verifyToken } from "@/lib/auth";
import { publishCommand } from "@/lib/mqtt";

const DB_PATH = path.join(process.cwd(), "foto-db.json");

async function readFotoDB() {
  try {
    const data = await fs.readFile(DB_PATH, "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function writeFotoDB(data) {
  await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2), "utf-8");
}

async function verifikasiAuth() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  if (!token) {
    return {
      error: NextResponse.json(
        { success: false, message: "Silakan login terlebih dahulu" },
        { status: 401 }
      ),
    };
  }

  const payload = await verifyToken(token);
  if (!payload) {
    return {
      error: NextResponse.json(
        { success: false, message: "Token tidak valid atau sudah expired" },
        { status: 401 }
      ),
    };
  }

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

// POST /api/foto-upload
// Body: { url: string, publicId: string }
export async function POST(request) {
  try {
    const auth = await verifikasiAuth();
    if (auth.error) return auth.error;

    const { url, publicId } = await request.json();

    if (!url) {
      return NextResponse.json(
        { success: false, message: "URL foto wajib diisi" },
        { status: 400 }
      );
    }

    // Simpan ke database
    const fotoData = {
      id: Date.now().toString(),
      url,
      publicId: publicId || null,
      uploadedBy: auth.payload.username,
      createdAt: new Date().toISOString(),
    };

    const fotoList = await readFotoDB();
    fotoList.push(fotoData);
    await writeFotoDB(fotoList);

    // Kirim URL ke ESP32 via MQTT
    await publishCommand("foto", url);

    console.log("✅ Foto disimpan & dikirim ke ESP32:", url);

    return NextResponse.json({ success: true, foto: fotoData });
  } catch (err) {
    console.error("❌ Error foto-upload:", err);
    return NextResponse.json(
      { success: false, message: "Gagal menyimpan foto: " + err.message },
      { status: 500 }
    );
  }
}
