"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import mqtt from "mqtt";
import toast, { Toaster } from "react-hot-toast";

// ─── Konfigurasi MQTT ──────────────────────────────────────────────
const MQTT_BROKER = "wss://f2cc4b70efa34a2db1687f4fd304f428.s1.eu.hivemq.cloud:8884/mqtt";
const MQTT_OPTIONS = {
  username: "Plihhh",
  password: "Guagakbegokali12",
  clientId: "lovebox_web_" + Math.random().toString(36).substring(2, 10),
  reconnectPeriod: 3000,
  connectTimeout: 10000,
  clean: true,
};
const TOPIC_STATUS = "lovebox/status";
const TOPIC_COMMAND = "lovebox/command";

// ─── Konfigurasi Mode & Tema ───────────────────────────────────────
const DISPLAY_MODES = [
  { id: 1, label: "Jam", emoji: "🕐" },
  { id: 2, label: "Tanggal", emoji: "📅" },
  { id: 3, label: "Foto", emoji: "🖼️" },
  { id: 4, label: "Pesan", emoji: "💬" },
  { id: 5, label: "Cuaca", emoji: "🌤️" },
];

const THEMES = [
  {
    id: "pastel_love",
    name: "Pastel Love",
    emoji: "🌸",
    gradient: "from-pink-300 via-rose-200 to-pink-100",
    border: "border-pink-300",
    ring: "ring-pink-400",
    bg: "bg-pink-50",
    text: "text-pink-700",
    dot: "bg-pink-400",
  },
  {
    id: "classic_dark",
    name: "Classic Dark",
    emoji: "🌙",
    gradient: "from-gray-800 via-gray-700 to-gray-600",
    border: "border-gray-600",
    ring: "ring-gray-500",
    bg: "bg-gray-900",
    text: "text-gray-100",
    dot: "bg-gray-400",
  },
  {
    id: "sunset",
    name: "Sunset",
    emoji: "🌅",
    gradient: "from-orange-400 via-rose-400 to-pink-500",
    border: "border-orange-300",
    ring: "ring-orange-400",
    bg: "bg-orange-50",
    text: "text-orange-700",
    dot: "bg-orange-400",
  },
  {
    id: "ocean",
    name: "Ocean",
    emoji: "🌊",
    gradient: "from-cyan-400 via-blue-400 to-indigo-500",
    border: "border-blue-300",
    ring: "ring-blue-400",
    bg: "bg-blue-50",
    text: "text-blue-700",
    dot: "bg-blue-400",
  },
];

// ─── Komponen Utama ────────────────────────────────────────────────
export default function AdminDashboard() {
  // State: status perangkat dari ESP32
  const [deviceStatus, setDeviceStatus] = useState({
    online: false,
    baterai: 0,
    mode: 1,
    tema: "pastel_love",
    firmware: "",
  });

  // State: mode yang sedang aktif (array of numbers)
  const [selectedModes, setSelectedModes] = useState([]);

  // State: tema yang dipilih
  const [selectedTheme, setSelectedTheme] = useState("pastel_love");

  // State: MQTT connection & UI
  const [mqttConnected, setMqttConnected] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Ref untuk MQTT client
  const clientRef = useRef(null);

  // ─── MQTT Connection ──────────────────────────────────────────────
  useEffect(() => {
    const client = mqtt.connect(MQTT_BROKER, MQTT_OPTIONS);
    clientRef.current = client;

    client.on("connect", () => {
      console.log("✅ MQTT connected");
      setMqttConnected(true);

      // Subscribe ke topik status
      client.subscribe(TOPIC_STATUS, (err) => {
        if (err) {
          console.error("❌ Gagal subscribe:", err);
          toast.error("Gagal subscribe ke status device");
        } else {
          console.log(`📡 Subscribed ke ${TOPIC_STATUS}`);
        }
      });
    });

    client.on("message", (topic, message) => {
      if (topic === TOPIC_STATUS) {
        try {
          const data = JSON.parse(message.toString());
          setDeviceStatus({
            online: data.online ?? true,
            baterai: data.baterai ?? 0,
            mode: data.mode ?? 1,
            tema: data.tema ?? "pastel_love",
            firmware: data.firmware ?? "",
          });
        } catch (e) {
          console.error("❌ Gagal parse status:", e);
        }
      }
    });

    client.on("error", (err) => {
      console.error("❌ MQTT error:", err);
      setMqttConnected(false);
    });

    client.on("close", () => {
      console.log("🔌 MQTT disconnected");
      setMqttConnected(false);
    });

    client.on("reconnect", () => {
      console.log("🔄 MQTT reconnecting...");
    });

    // Cleanup: disconnect saat komponen unmount
    return () => {
      if (client) {
        client.end(true);
      }
    };
  }, []);

  // ─── Toggle Mode ──────────────────────────────────────────────────
  const handleToggleMode = useCallback((modeId) => {
    setSelectedModes((prev) => {
      if (prev.includes(modeId)) {
        return prev.filter((id) => id !== modeId);
      }
      return [...prev, modeId];
    });
  }, []);

  // ─── Simpan Perubahan (Publish ke MQTT) ────────────────────────────
  const handleSave = useCallback(() => {
    const client = clientRef.current;
    if (!client || !client.connected) {
      toast.error("MQTT belum terhubung. Tidak bisa mengirim perintah.");
      return;
    }

    setIsSaving(true);
    setSaveSuccess(false);

    // Siapkan payload mode (array diurutkan, maksimal 5 elemen)
    const sortedModes = [...selectedModes].sort((a, b) => a - b).slice(0, 5);
    const payloadMode = JSON.stringify({
      type: "mode",
      data: sortedModes,
    });

    // Siapkan payload tema
    const payloadTheme = JSON.stringify({
      type: "theme",
      data: selectedTheme,
    });

    // Publish sekuensial: mode dulu, lalu tema
    client.publish(TOPIC_COMMAND, payloadMode, { qos: 1 }, (errMode) => {
      if (errMode) {
        console.error("❌ Gagal publish mode:", errMode);
        toast.error("Gagal mengirim data mode");
        setIsSaving(false);
        return;
      }

      client.publish(TOPIC_COMMAND, payloadTheme, { qos: 1 }, (errTheme) => {
        setIsSaving(false);
        if (errTheme) {
          console.error("❌ Gagal publish tema:", errTheme);
          toast.error("Gagal mengirim data tema");
          return;
        }

        setSaveSuccess(true);
        toast.success("Perubahan berhasil dikirim ke RoboLove! 🤖💕", {
          duration: 3000,
          icon: "✅",
          style: {
            borderRadius: "16px",
            background: "#FFF0F5",
            color: "#9D174D",
            fontWeight: 500,
          },
        });

        // Reset animasi success setelah 2 detik
        setTimeout(() => setSaveSuccess(false), 2000);
      });
    });
  }, [selectedModes, selectedTheme]);

  // ─── Derived State ─────────────────────────────────────────────────
  const isOnline = mqttConnected && deviceStatus.online;
  const batteryPercent = deviceStatus.baterai;
  const firmwareVersion = deviceStatus.firmware || "v1.0-stage1";

  // ─── Render ────────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen bg-pink-50 pb-16 font-poppins"
      style={{ fontFamily: "'Poppins', sans-serif" }}
    >
      <Toaster position="top-center" />

      {/* ═══ Floating Decorations ═══ */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-20 left-10 w-32 h-32 bg-pink-200/20 rounded-full blur-3xl animate-float" />
        <div
          className="absolute top-60 right-8 w-24 h-24 bg-rose-200/25 rounded-full blur-2xl animate-float"
          style={{ animationDelay: "1s" }}
        />
        <div
          className="absolute bottom-40 left-1/4 w-40 h-40 bg-pink-100/30 rounded-full blur-3xl animate-float"
          style={{ animationDelay: "2s" }}
        />
      </div>

      {/* ═══ HEADER ═══ */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/70 border-b border-pink-100 shadow-sm">
        <div className="max-w-2xl mx-auto px-5 py-4">
          {/* Greeting */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">
                <span className="bg-gradient-to-r from-pink-500 via-rose-400 to-pink-400 bg-clip-text text-transparent">
                  Halo, Muflih
                </span>{" "}
                <span className="inline-block animate-bounce" style={{ animationDuration: "2s" }}>
                  👋
                </span>
              </h1>
              <p className="text-xs text-pink-400/80 mt-0.5 font-medium">
                RoboLove Control Panel
              </p>
            </div>
            {/* Logo */}
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center shadow-lg shadow-pink-200/50">
              <span className="text-white text-lg">🤖</span>
            </div>
          </div>

          {/* Status Bar */}
          <div className="mt-3 flex items-center gap-3 text-xs font-medium">
            {/* Online / Offline */}
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all duration-500 ${
                isOnline
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-red-50 text-red-600 border border-red-200"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isOnline ? "bg-emerald-500 animate-pulse" : "bg-red-500"
                }`}
              />
              <span>{isOnline ? "Online" : "Offline"}</span>
            </div>

            {/* Battery */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
              <span>{batteryPercent > 70 ? "🔋" : batteryPercent > 30 ? "🪫" : "🔴"}</span>
              <span>{batteryPercent}%</span>
            </div>

            {/* Firmware */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-50 text-purple-600 border border-purple-200">
              <span>📟</span>
              <span>{firmwareVersion}</span>
            </div>
          </div>
        </div>
      </header>

      {/* ═══ MAIN CONTENT ═══ */}
      <main className="relative z-10 max-w-2xl mx-auto px-5 pt-6 space-y-6">
        {/* ─── Section 1: Atur Mode Tampilan 💡 ─── */}
        <section className="bg-white rounded-3xl p-6 shadow-[0_2px_20px_rgba(236,72,153,0.08)] border border-pink-100/50 animate-fade-in">
          {/* Section Header */}
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-300 to-orange-400 flex items-center justify-center shadow-md shadow-amber-200/40">
              <span className="text-lg">💡</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-800">Atur Mode Tampilan</h2>
              <p className="text-xs text-gray-400 font-medium">
                Pilih mode yang ingin ditampilkan di layar
              </p>
            </div>
          </div>

          {/* Mode List */}
          <div className="space-y-2.5">
            {DISPLAY_MODES.map((mode) => {
              const isActive = selectedModes.includes(mode.id);
              return (
                <div
                  key={mode.id}
                  className={`flex items-center justify-between p-4 rounded-2xl transition-all duration-300 cursor-pointer group ${
                    isActive
                      ? "bg-gradient-to-r from-pink-50 to-rose-50 border border-pink-200 shadow-sm"
                      : "bg-gray-50/80 border border-transparent hover:bg-gray-100/80 hover:border-gray-200"
                  }`}
                  onClick={() => handleToggleMode(mode.id)}
                >
                  <div className="flex items-center gap-3.5">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center text-base transition-all duration-300 ${
                        isActive
                          ? "bg-pink-100 scale-110 shadow-sm shadow-pink-200/50"
                          : "bg-gray-100 group-hover:bg-gray-200"
                      }`}
                    >
                      {mode.emoji}
                    </div>
                    <div>
                      <span
                        className={`font-semibold text-sm transition-colors ${
                          isActive ? "text-pink-700" : "text-gray-700"
                        }`}
                      >
                        {mode.label}
                      </span>
                      <p className="text-[10px] text-gray-400 font-medium">ID: {mode.id}</p>
                    </div>
                  </div>

                  {/* Toggle Switch */}
                  <label
                    className="relative inline-flex items-center cursor-pointer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={isActive}
                      onChange={() => handleToggleMode(mode.id)}
                    />
                    <div
                      className={`w-12 h-7 rounded-full transition-all duration-300 peer-focus:outline-none
                        after:content-[''] after:absolute after:top-[3px] after:left-[3px]
                        after:bg-white after:rounded-full after:h-[22px] after:w-[22px]
                        after:transition-all after:duration-300 after:shadow-sm
                        ${
                          isActive
                            ? "bg-gradient-to-r from-pink-400 to-rose-400 after:translate-x-[20px] shadow-inner shadow-pink-500/20"
                            : "bg-gray-200 after:translate-x-0"
                        }`}
                    />
                  </label>
                </div>
              );
            })}
          </div>

          {/* Simpan Perubahan Button */}
          <button
            disabled={isSaving}
            onClick={handleSave}
            className={`mt-6 w-full py-4 rounded-2xl font-bold text-white text-sm tracking-wide
              transition-all duration-300 flex items-center justify-center gap-2
              disabled:opacity-60 disabled:cursor-not-allowed
              ${
                saveSuccess
                  ? "bg-gradient-to-r from-emerald-400 to-teal-500 shadow-lg shadow-emerald-200/50 scale-[0.98]"
                  : "bg-gradient-to-r from-pink-400 via-rose-400 to-pink-500 shadow-lg shadow-pink-300/40 hover:shadow-xl hover:shadow-pink-300/50 hover:scale-[1.01] active:scale-[0.98]"
              }`}
          >
            {isSaving ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Mengirim...</span>
              </>
            ) : saveSuccess ? (
              <>
                <span>✅</span>
                <span>Terkirim!</span>
              </>
            ) : (
              <>
                <span>💾</span>
                <span>Simpan Perubahan</span>
              </>
            )}
          </button>
        </section>

        {/* ─── Section 2: Pilih Tema Layar 🎨 ─── */}
        <section
          className="bg-white rounded-3xl p-6 shadow-[0_2px_20px_rgba(236,72,153,0.08)] border border-pink-100/50 animate-fade-in"
          style={{ animationDelay: "0.1s" }}
        >
          {/* Section Header */}
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center shadow-md shadow-purple-200/40">
              <span className="text-lg">🎨</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-800">Pilih Tema Layar</h2>
              <p className="text-xs text-gray-400 font-medium">
                Ubah tampilan visual di perangkat
              </p>
            </div>
          </div>

          {/* Theme Grid */}
          <div className="grid grid-cols-2 gap-3">
            {THEMES.map((theme) => {
              const isActive = selectedTheme === theme.id;
              return (
                <button
                  key={theme.id}
                  onClick={() => setSelectedTheme(theme.id)}
                  className={`relative overflow-hidden rounded-2xl p-4 border-2 transition-all duration-300 group
                    ${
                      isActive
                        ? `${theme.border} ring-2 ${theme.ring} ring-offset-2 scale-[1.02] shadow-lg`
                        : "border-gray-100 hover:border-gray-200 hover:shadow-md hover:scale-[1.01]"
                    }`}
                >
                  {/* Gradient Preview Bar */}
                  <div
                    className={`w-full h-16 rounded-xl bg-gradient-to-r ${theme.gradient} mb-3 transition-all duration-300 group-hover:shadow-md ${
                      isActive ? "shadow-md" : ""
                    }`}
                  />

                  {/* Theme Info */}
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{theme.emoji}</span>
                    <span
                      className={`font-bold text-sm transition-colors ${
                        isActive ? "text-gray-800" : "text-gray-500"
                      }`}
                    >
                      {theme.name}
                    </span>
                  </div>

                  {/* Active Checkmark */}
                  {isActive && (
                    <div className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full bg-pink-500 flex items-center justify-center shadow-sm animate-[scale-in_0.3s_ease-out]">
                      <svg
                        className="w-3.5 h-3.5 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={3}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Selected Theme Info */}
          <div className="mt-4 flex items-center gap-2 px-4 py-3 rounded-xl bg-pink-50 border border-pink-100">
            <span className="text-sm">🎯</span>
            <p className="text-xs text-pink-600 font-semibold">
              Tema aktif:{" "}
              <span className="text-pink-800">
                {THEMES.find((t) => t.id === selectedTheme)?.name || selectedTheme}
              </span>
            </p>
          </div>
        </section>

        {/* ─── MQTT Debug Info (Subtle) ─── */}
        <div className="text-center pb-4">
          <p className="text-[10px] text-gray-300 font-medium">
            MQTT {mqttConnected ? "🟢 Connected" : "🔴 Disconnected"} •{" "}
            {MQTT_OPTIONS.clientId}
          </p>
        </div>
      </main>
    </div>
  );
}
