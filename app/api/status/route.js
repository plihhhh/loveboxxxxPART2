import { NextResponse } from "next/server";
import { promises as fs } from "fs";

const STATUS_FILE = "/tmp/lovebox_status.json";

const DEFAULT_STATUS = {
  online: false,
  baterai: 0,
  mode: 1,
  tema: "pastel_love",
  firmware: "v1.0",
  lastSeen: null,
};

async function readStatus() {
  try {
    const data = await fs.readFile(STATUS_FILE, "utf-8");
    const status = JSON.parse(data);

    if (status.lastSeen) {
      const lastSeen = new Date(status.lastSeen);
      const now = new Date();
      const diffMenit = (now - lastSeen) / 1000 / 60;
      if (diffMenit > 2) {
        status.online = false;
      }
    }

    return status;
  } catch {
    return DEFAULT_STATUS;
  }
}

async function writeStatus(data) {
  await fs.writeFile(STATUS_FILE, JSON.stringify(data), "utf-8");
}

export async function GET() {
  try {
    const status = await readStatus();
    return NextResponse.json(status);
  } catch (err) {
    console.error("Error ambil status:", err);
    return NextResponse.json(DEFAULT_STATUS, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();

    const status = {
      online: body.online ?? true,
      baterai: body.baterai ?? 0,
      mode: body.mode ?? 1,
      tema: body.tema ?? "pastel_love",
      firmware: body.firmware ?? "v1.0",
      lastSeen: new Date().toISOString(),
    };

    await writeStatus(status);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error terima status:", err);
    return NextResponse.json(
      { success: false, message: "Gagal simpan status" },
      { status: 500 }
    );
  }
}