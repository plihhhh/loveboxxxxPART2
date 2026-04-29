// ==============================================
// lib/mqtt.js
// Modul koneksi MQTT ke HiveMQ Cloud via WebSocket
// Untuk komunikasi antara dashboard web dan ESP32
// ==============================================

import mqtt from "mqtt";

// --- Konfigurasi MQTT dari environment variables ---
const MQTT_HOST = process.env.MQTT_HOST;           // Hostname HiveMQ Cloud
const MQTT_PORT = process.env.MQTT_PORT_WS || 8884; // Port WebSocket Secure
const MQTT_USER = process.env.MQTT_USERNAME;
const MQTT_PASS = process.env.MQTT_PASSWORD;

// --- Topik MQTT ---
const TOPIC_COMMAND = "lovebox/command";  // Topik untuk mengirim perintah ke ESP32
const TOPIC_STATUS = "lovebox/status";    // Topik untuk menerima status dari ESP32

// --- Singleton: variabel global koneksi ---
let client = null;         // Instance MQTT client (hanya satu)
let isConnected = false;   // Flag status koneksi

// --- Status terakhir yang diterima dari ESP32 ---
let lastStatus = {
  online: false,       // Apakah ESP32 terhubung
  baterai: 0,          // Level baterai (0-100)
  mode: 1,             // Mode LED aktif (1 = love, 2 = rainbow, dst)
  tema: "pastel_love", // Tema aktif pada layar TFT
  firmware: "v1.0",    // Versi firmware ESP32
  lastSeen: null,      // Timestamp terakhir ESP32 mengirim status
};

// ==============================================
// connectMQTT()
// Inisialisasi koneksi ke broker HiveMQ Cloud.
// Menggunakan singleton pattern: koneksi hanya
// dibuat sekali. Jika sudah ada, return client lama.
// Otomatis subscribe ke topik "lovebox/status".
// Reconnect otomatis setiap 5 detik jika putus.
// ==============================================
export function connectMQTT() {
  // Jika koneksi sudah ada dan masih aktif, gunakan yang lama
  if (client && isConnected) {
    return client;
  }

  // Validasi: pastikan konfigurasi MQTT sudah diisi
  if (!MQTT_HOST) {
    console.warn("⚠️  MQTT_HOST belum diisi di .env.local");
    return null;
  }

  // Buat URL koneksi WebSocket Secure (wss://)
  const brokerUrl = `wss://${MQTT_HOST}:${MQTT_PORT}/mqtt`;

  // Buat koneksi MQTT baru
  client = mqtt.connect(brokerUrl, {
    username: MQTT_USER,
    password: MQTT_PASS,
    clientId: `lovebox_web_${Date.now()}`,  // ID unik per sesi
    clean: true,                             // Mulai sesi bersih
    reconnectPeriod: 5000,                   // Reconnect otomatis setiap 5 detik
    connectTimeout: 10000,                   // Timeout koneksi 10 detik
  });

  // --- Event: Berhasil terhubung ke broker ---
  client.on("connect", () => {
    console.log("✅ MQTT terhubung ke HiveMQ Cloud");
    isConnected = true;

    // Subscribe ke topik status untuk menerima update dari ESP32
    client.subscribe(TOPIC_STATUS, { qos: 1 }, (err) => {
      if (err) {
        console.error("❌ Gagal subscribe ke", TOPIC_STATUS, err);
      } else {
        console.log("📡 Subscribed ke topik:", TOPIC_STATUS);
      }
    });
  });

  // --- Event: Menerima pesan dari ESP32 ---
  client.on("message", (topic, payload) => {
    // Hanya proses pesan dari topik status
    if (topic === TOPIC_STATUS) {
      try {
        // Parse payload JSON dari ESP32
        const data = JSON.parse(payload.toString());

        // Update variabel status terakhir
        lastStatus = {
          online: true,                          // ESP32 kirim berarti online
          baterai: data.baterai ?? lastStatus.baterai,
          mode: data.mode ?? lastStatus.mode,
          tema: data.tema ?? lastStatus.tema,
          firmware: data.firmware ?? lastStatus.firmware,
          lastSeen: new Date().toISOString(),     // Catat waktu terakhir
        };

        console.log("📥 Status ESP32 diperbarui:", lastStatus);
      } catch (err) {
        console.error("❌ Gagal parse pesan status:", err.message);
      }
    }
  });

  // --- Event: Koneksi terputus ---
  client.on("close", () => {
    console.log("🔌 MQTT koneksi terputus, akan reconnect dalam 5 detik...");
    isConnected = false;
    // Tandai ESP32 offline saat koneksi putus
    lastStatus.online = false;
  });

  // --- Event: Error koneksi ---
  client.on("error", (err) => {
    console.error("❌ MQTT error:", err.message);
    isConnected = false;
  });

  // --- Event: Sedang mencoba reconnect ---
  client.on("reconnect", () => {
    console.log("🔄 Mencoba reconnect ke MQTT broker...");
  });

  return client;
}

// ==============================================
// publishCommand(type, data)
// Mengirim perintah ke ESP32 melalui topik
// "lovebox/command" dalam format JSON.
//
// Parameter:
//   type  - Jenis perintah:
//           "mode"       → ganti mode LED
//           "theme"      → ganti tema layar TFT
//           "pesan"      → kirim pesan teks
//           "brightness" → atur kecerahan LED
//           "foto"       → kirim URL foto Cloudinary
//           "ota"        → kirim URL firmware untuk OTA
//   data  - Data perintah (bisa number, string, object, array)
//
// Contoh penggunaan:
//   publishCommand("mode", [1, 2, 3])
//   publishCommand("theme", "pastel_love")
//   publishCommand("pesan", { teks: "Aku rindu", warna: "#FF69B4", ukuran: 16 })
//   publishCommand("brightness", 75)
//   publishCommand("foto", "https://res.cloudinary.com/xxx/image.jpg")
//   publishCommand("ota", "https://server.com/firmware.bin")
//
// Return: Promise<boolean> → true jika berhasil terkirim
// ==============================================
export async function publishCommand(type, data) {
  // Pastikan koneksi sudah ada, jika belum maka inisialisasi
  const mqttClient = connectMQTT();

  if (!mqttClient) {
    console.error("❌ MQTT client tidak tersedia, perintah gagal dikirim");
    return false;
  }

  // Buat payload JSON sesuai format yang disepakati dengan ESP32
  const payload = JSON.stringify({ type, data });

  // Kirim ke topik command dengan QoS 1 (at least once delivery)
  return new Promise((resolve) => {
    mqttClient.publish(TOPIC_COMMAND, payload, { qos: 1 }, (err) => {
      if (err) {
        console.error(`❌ Gagal publish [${type}]:`, err.message);
        resolve(false);
      } else {
        console.log(`📤 Perintah terkirim [${type}]:`, data);
        resolve(true);
      }
    });
  });
}

// ==============================================
// getLastStatus()
// Mengembalikan status terakhir yang diterima
// dari ESP32 melalui topik "lovebox/status".
//
// Return: Object
//   {
//     online: boolean,       → apakah ESP32 online
//     baterai: number,       → level baterai (0-100)
//     mode: number,          → mode LED aktif
//     firmware: string,      → versi firmware
//     lastSeen: string|null  → timestamp ISO terakhir
//   }
// ==============================================
export function getLastStatus() {
  return { ...lastStatus };
}
