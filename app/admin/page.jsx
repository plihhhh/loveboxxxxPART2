"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import mqtt from "mqtt";
import toast, { Toaster } from "react-hot-toast";

const BROKER = "wss://f2cc4b70efa34a2db1687f4fd304f428.s1.eu.hivemq.cloud:8884/mqtt";
const MQTT_OPTS = {
  username: "Plihhh",
  password: "Guagakbegokali12",
  clientId: "lovebox_admin_" + Math.random().toString(36).slice(2, 10),
  reconnectPeriod: 3000,
  connectTimeout: 10000,
  clean: true,
};
const T_STATUS = "lovebox/status";
const T_CMD = "lovebox/command";

const TOAST_STYLE = {
  borderRadius: "16px",
  background: "#FFF0F5",
  color: "#9D174D",
  fontWeight: 500,
  fontSize: "14px",
};

// Mode Config
const DISPLAY_MODES = [
  { id: 1, label: "Jam", emoji: "🕐" },
  { id: 2, label: "Tanggal", emoji: "📅" },
  { id: 3, label: "Foto", emoji: "🖼️" },
  { id: 4, label: "Pesan", emoji: "💬" },
  { id: 5, label: "Cuaca", emoji: "🌤️" },
];

// Theme Config
const THEMES = [
  { id: "pastel_love", name: "Pastel Love", emoji: "🌸", gradient: "from-pink-300 via-rose-200 to-pink-100", border: "border-pink-300", ring: "ring-pink-400" },
  { id: "classic_dark", name: "Classic Dark", emoji: "🌙", gradient: "from-gray-800 via-gray-700 to-gray-600", border: "border-gray-600", ring: "ring-gray-500" },
  { id: "sunset", name: "Sunset", emoji: "🌅", gradient: "from-orange-400 via-rose-400 to-pink-500", border: "border-orange-300", ring: "ring-orange-400" },
  { id: "ocean", name: "Ocean", emoji: "🌊", gradient: "from-cyan-400 via-blue-400 to-indigo-500", border: "border-blue-300", ring: "ring-blue-400" },
];

export default function AdminDashboard() {
  // ── Device Status ──
  const [online, setOnline] = useState(false);
  const [battery, setBattery] = useState(0);
  const [mqttOk, setMqttOk] = useState(false);
  const clientRef = useRef(null);

  // ── A: Mode Tampilan & Tema (FITUR LAMA) ──
  const [selectedModes, setSelectedModes] = useState([1, 2, 3, 4, 5]);
  const [selectedTheme, setSelectedTheme] = useState("pastel_love");

  // ── B: Pesan & Kontrol Layar (FITUR BARU) ──
  const [pesan, setPesan] = useState("");
  const [warnaPesan, setWarnaPesan] = useState("#FFFFFF");
  const [ukuranFont, setUkuranFont] = useState(16);
  const [brightness, setBrightness] = useState(50);

  // ── C: Foto ──
  const [fotoFile, setFotoFile] = useState(null);      // file yang dipilih
  const [fotoPreview, setFotoPreview] = useState(null); // object URL untuk preview
  const [uploadProgress, setUploadProgress] = useState(0);
  const fotoInputRef = useRef(null);

  // ── D: OTA ──
  const [firmwareFile, setFirmwareFile] = useState(null);

  // ── Loading states ──
  const [loadingKey, setLoadingKey] = useState("");

  // ── MQTT Connection ──
  useEffect(() => {
    const client = mqtt.connect(BROKER, MQTT_OPTS);
    clientRef.current = client;

    client.on("connect", () => {
      setMqttOk(true);
      client.subscribe(T_STATUS, (err) => {
        if (!err) console.log("📡 Subscribed:", T_STATUS);
      });
    });

    client.on("message", (topic, msg) => {
      if (topic === T_STATUS) {
        try {
          const d = JSON.parse(msg.toString());
          setOnline(d.online ?? false);
          setBattery(d.baterai ?? 0);
          if (d.mode && Array.isArray(d.mode)) {
             setSelectedModes(d.mode);
          }
          if (d.tema) {
             setSelectedTheme(d.tema);
          }
        } catch (e) {
          console.error("Parse error:", e);
        }
      }
    });

    client.on("error", () => setMqttOk(false));
    client.on("close", () => setMqttOk(false));

    return () => client?.end(true);
  }, []);

  // ── Publish Helper ──
  const publish = useCallback((payload, key, successMsg) => {
    const c = clientRef.current;
    if (!c || !c.connected) {
      toast.error("MQTT belum terhubung!", { style: TOAST_STYLE });
      return;
    }
    setLoadingKey(key);
    c.publish(T_CMD, JSON.stringify(payload), { qos: 1 }, (err) => {
      setLoadingKey("");
      if (err) {
        toast.error("Gagal mengirim perintah", { style: TOAST_STYLE });
      } else {
        toast.success(successMsg, { icon: "✅", style: TOAST_STYLE, duration: 3000 });
      }
    });
  }, []);

  // ── Handlers ──
  const toggleMode = (id) => {
    setSelectedModes((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  const sendMode = () => {
    const sortedModes = [...selectedModes].sort((a, b) => a - b);
    publish({ type: "mode", data: sortedModes }, "mode", "Mode berhasil disimpan! 💡");
  };

  const sendTheme = (themeId) => {
    setSelectedTheme(themeId);
    publish({ type: "theme", data: themeId }, "theme", "Tema berhasil diubah! 🎨");
  };

  const sendPesan = () => {
    if (!pesan.trim()) return toast.error("Pesan kosong!", { style: TOAST_STYLE });
    publish(
      { type: "pesan", data: { teks: pesan, warna: warnaPesan, ukuran: ukuranFont } },
      "pesan",
      "Pesan terkirim ke RoboLove! 💌"
    );
    setPesan("");
  };

  // Pilih file → buat preview, tapi BELUM upload
  const handleFotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("File harus berupa gambar!", { style: TOAST_STYLE });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Ukuran foto maksimal 5MB!", { style: TOAST_STYLE });
      return;
    }
    // Revoke preview lama
    if (fotoPreview) URL.revokeObjectURL(fotoPreview);
    setFotoFile(file);
    setFotoPreview(URL.createObjectURL(file));
    setUploadProgress(0);
    // Reset value supaya bisa pilih file yang sama lagi
    e.target.value = "";
  };

  // Upload ke Cloudinary (unsigned) → simpan URL ke DB → kirim ke ESP32 via MQTT
  const uploadFoto = async () => {
    if (!fotoFile) return toast.error("Pilih foto dulu!", { style: TOAST_STYLE });

    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

    if (!cloudName || !uploadPreset) {
      return toast.error("Konfigurasi Cloudinary belum diset!", { style: TOAST_STYLE });
    }

    setLoadingKey("foto_dl");
    setUploadProgress(10);

    try {
      // 1. Upload ke Cloudinary dengan transformasi 128×160
      const formData = new FormData();
      formData.append("file", fotoFile);
      formData.append("upload_preset", uploadPreset);
      formData.append("folder", "lovebox/photos");
      // Eager transformation: resize & crop ke 128x160
      formData.append("eager", "c_fill,w_128,h_160");

      setUploadProgress(30);
      const cloudRes = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        { method: "POST", body: formData }
      );

      if (!cloudRes.ok) {
        throw new Error("Gagal upload ke Cloudinary");
      }

      const cloudData = await cloudRes.json();
      setUploadProgress(70);

      // Gunakan eager URL (sudah 128×160) jika ada, fallback ke secure_url
      const finalUrl =
        cloudData.eager?.[0]?.secure_url ||
        cloudData.secure_url;

      // 2. Simpan URL ke DB + kirim ke ESP32 via MQTT
      const saveRes = await fetch("/api/foto-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: finalUrl,
          publicId: cloudData.public_id,
        }),
      });

      const saveData = await saveRes.json();
      setUploadProgress(100);

      if (!saveRes.ok || !saveData.success) {
        throw new Error(saveData.message || "Gagal simpan ke database");
      }

      toast.success("Foto berhasil diupload & dikirim ke ESP32! 🖼️", {
        icon: "✅",
        style: TOAST_STYLE,
        duration: 4000,
      });

      // Reset state
      setFotoFile(null);
      if (fotoPreview) URL.revokeObjectURL(fotoPreview);
      setFotoPreview(null);
      setUploadProgress(0);
    } catch (err) {
      console.error("Upload error:", err);
      toast.error(err.message || "Gagal upload foto", { style: TOAST_STYLE });
    } finally {
      setLoadingKey("");
    }
  };

  const sendSlideshow = () => {
    publish({ type: "mode", data: [3] }, "slideshow", "Mode Slideshow aktif! 📸");
  };

  const sendBrightness = () => {
    publish({ type: "brightness", data: brightness }, "bright", `Kecerahan diset ke ${brightness}%`);
  };

  const sendOTA = async () => {
    if (!firmwareFile) return toast.error("Pilih file .bin dulu!", { style: TOAST_STYLE });
    if (!window.confirm("⚠️ Yakin mau update firmware? Pastikan device online dan stabil.")) return;
    
    setLoadingKey("ota");
    const formData = new FormData();
    formData.append("firmware", firmwareFile);

    try {
      const res = await fetch("/api/ota", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      
      if (res.ok && data.success) {
        toast.success("Firmware berhasil diupload & dikirim ke device! 🔧", { icon: "✅", style: TOAST_STYLE, duration: 4000 });
        setFirmwareFile(null);
      } else {
        toast.error(data.message || "Gagal upload firmware", { style: TOAST_STYLE });
      }
    } catch (err) {
      toast.error("Terjadi kesalahan saat upload", { style: TOAST_STYLE });
    } finally {
      setLoadingKey("");
    }
  };

  const sendWifiReset = () => {
    if (!window.confirm("⚠️ Reset WiFi? Device akan masuk mode AP untuk setup ulang.")) return;
    publish({ type: "wifi_reset" }, "wifi", "Perintah reset WiFi terkirim! 📶");
  };

  const isOnline = mqttOk && online;
  const isLoading = (k) => loadingKey === k;

  // ── Card wrapper ──
  const Card = ({ children, title, emoji, delay = 0 }) => (
    <section
      className="bg-white rounded-3xl p-6 shadow-[0_2px_24px_rgba(236,72,153,0.07)] border border-pink-100/60 animate-fade-in flex flex-col"
      style={{ animationDelay: `${delay}s` }}
    >
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center shadow-md shadow-pink-200/40 text-lg">
          {emoji}
        </div>
        <h2 className="text-lg font-bold text-gray-800">{title}</h2>
      </div>
      <div className="flex-1 flex flex-col">
        {children}
      </div>
    </section>
  );

  // ── Action Button ──
  const Btn = ({ onClick, loading, children, danger = false, disabled = false, full = true, className = "" }) => (
    <button
      disabled={loading || disabled}
      onClick={onClick}
      className={`${full ? "w-full" : "flex-1"} py-3.5 px-5 rounded-2xl font-bold text-sm tracking-wide transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97] ${
        danger
          ? "bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg shadow-red-200/40 hover:shadow-xl hover:shadow-red-300/50"
          : "bg-gradient-to-r from-pink-400 via-rose-400 to-pink-500 text-white shadow-lg shadow-pink-300/40 hover:shadow-xl hover:shadow-pink-300/50 hover:scale-[1.01]"
      } ${className}`}
    >
      {loading ? (
        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      ) : (
        children
      )}
    </button>
  );

  return (
    <div className="min-h-screen bg-pink-50 pb-16" style={{ fontFamily: "'Poppins', sans-serif" }}>
      <Toaster position="top-center" />

      {/* Floating bg decorations */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-20 left-10 w-32 h-32 bg-pink-200/20 rounded-full blur-3xl animate-float" />
        <div className="absolute top-60 right-8 w-24 h-24 bg-rose-200/25 rounded-full blur-2xl animate-float" style={{ animationDelay: "1s" }} />
        <div className="absolute bottom-40 left-1/4 w-40 h-40 bg-pink-100/30 rounded-full blur-3xl animate-float" style={{ animationDelay: "2s" }} />
      </div>

      {/* ═══ HEADER ═══ */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/70 border-b border-pink-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-5 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-bold">
              <span className="bg-gradient-to-r from-pink-500 via-rose-400 to-pink-400 bg-clip-text text-transparent">
                Admin Dashboard RoboLove
              </span>{" "}
              <span className="inline-block">🛠️</span>
            </h1>
            <p className="text-[11px] text-pink-400/70 font-medium mt-0.5">
              MQTT {mqttOk ? "🟢 Connected" : "🔴 Disconnected"} • {MQTT_OPTS.clientId.slice(-8)}
            </p>
          </div>
          {/* Status badges */}
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
              isOnline
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : "bg-red-50 text-red-600 border border-red-200"
            }`}>
              <span className={`w-2 h-2 rounded-full ${isOnline ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} />
              {isOnline ? "Online" : "Offline"}
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold">
              🔋 {battery}%
            </div>
          </div>
        </div>
      </header>

      {/* ═══ MAIN GRID ═══ */}
      <main className="relative z-10 max-w-6xl mx-auto px-5 pt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

        {/* ─── Kiri: Setting Jam & Tema ─── */}
        <div className="flex flex-col gap-6">
        {/* ─── SECTION A: Setting Jam & Mode (FITUR LAMA) ─── */}
        <Card title="Setting Jam & Mode" emoji="💡" delay={0}>
          <div className="space-y-3 flex-1">
            {DISPLAY_MODES.map((mode) => {
              const isActive = selectedModes.includes(mode.id);
              return (
                <div
                  key={mode.id}
                  className={`flex items-center justify-between p-3 rounded-2xl transition-all duration-300 cursor-pointer group ${
                    isActive
                      ? "bg-gradient-to-r from-pink-50 to-rose-50 border border-pink-200 shadow-sm"
                      : "bg-gray-50/80 border border-transparent hover:bg-gray-100/80 hover:border-gray-200"
                  }`}
                  onClick={() => toggleMode(mode.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm transition-all duration-300 ${
                        isActive ? "bg-pink-100 scale-110 shadow-sm shadow-pink-200/50" : "bg-gray-100 group-hover:bg-gray-200"
                    }`}>
                      {mode.emoji}
                    </div>
                    <span className={`font-semibold text-sm transition-colors ${isActive ? "text-pink-700" : "text-gray-700"}`}>
                      {mode.label}
                    </span>
                  </div>
                  {/* Toggle Switch */}
                  <label className="relative inline-flex items-center cursor-pointer pointer-events-none">
                    <input type="checkbox" className="sr-only peer" checked={isActive} readOnly />
                    <div className={`w-11 h-6 rounded-full transition-all duration-300 peer-focus:outline-none after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all after:duration-300 ${
                          isActive ? "bg-gradient-to-r from-pink-400 to-rose-400 after:translate-x-full after:border-white shadow-inner shadow-pink-500/20" : "bg-gray-200 after:translate-x-0"
                        }`}
                    />
                  </label>
                </div>
              );
            })}
          </div>
          <Btn onClick={sendMode} loading={isLoading("mode")} className="mt-5">
            <span>💾</span> Simpan Mode
          </Btn>
        </Card>

        {/* ─── SECTION A2: Pilih Tema Layar ─── */}
        <Card title="Pilih Tema Layar" emoji="🎨" delay={0.02}>
          <div className="grid grid-cols-2 gap-3 flex-1">
            {THEMES.map((theme) => {
              const isActive = selectedTheme === theme.id;
              return (
                <button
                  key={theme.id}
                  onClick={() => sendTheme(theme.id)}
                  disabled={isLoading("theme")}
                  className={`relative overflow-hidden rounded-2xl p-3 border-2 transition-all duration-300 group text-left ${
                    isActive
                      ? `${theme.border} ring-2 ${theme.ring} ring-offset-1 scale-[1.02] shadow-md bg-white`
                      : "border-gray-100 hover:border-gray-200 hover:shadow-sm hover:scale-[1.01] bg-gray-50/50"
                  }`}
                >
                  <div className={`w-full h-8 rounded-lg bg-gradient-to-r ${theme.gradient} mb-2 transition-all duration-300 ${isActive ? "shadow-sm" : ""}`} />
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{theme.emoji}</span>
                    <span className={`font-bold text-xs transition-colors ${isActive ? "text-gray-800" : "text-gray-500"}`}>
                      {theme.name}
                    </span>
                  </div>
                  {isActive && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-pink-500 flex items-center justify-center shadow-sm">
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </Card>
      </div>

        {/* ─── SECTION B: Kontrol Layar & Pesan (FITUR BARU) ─── */}
        <Card title="Kontrol Layar & Pesan" emoji="💬" delay={0.05}>
          <div className="flex-1 flex flex-col">
            <textarea
              className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-4 h-20 text-sm focus:outline-none focus:border-pink-300 focus:ring-2 focus:ring-pink-200 transition-all resize-none placeholder:text-gray-400 mb-1"
              placeholder="Tulis pesan..."
              maxLength={200}
              value={pesan}
              onChange={(e) => setPesan(e.target.value)}
            />
            <p className="text-right text-[10px] text-gray-400 font-medium mb-3">{pesan.length}/200</p>

            <div className="grid grid-cols-2 gap-4 mb-4">
              {/* Color Picker */}
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-2 block">Warna Teks</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={warnaPesan}
                    onChange={(e) => setWarnaPesan(e.target.value)}
                    className="w-8 h-8 rounded-xl border border-gray-200 cursor-pointer p-0.5 bg-white"
                  />
                  <span className="text-xs font-mono text-gray-500 bg-gray-50 px-2 py-1.5 rounded-lg border border-gray-100">{warnaPesan}</span>
                </div>
              </div>
              {/* Font Size */}
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-2 block">Ukuran: {ukuranFont}px</label>
                <input
                  type="range"
                  min="8"
                  max="48"
                  value={ukuranFont}
                  onChange={(e) => setUkuranFont(Number(e.target.value))}
                  className="w-full accent-pink-400 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>

            <Btn onClick={sendPesan} loading={isLoading("pesan")} className="mb-6">
              <span>💌</span> Kirim Pesan
            </Btn>

            <div className="border-t border-pink-100 pt-5 mt-auto">
              <label className="text-xs font-semibold text-gray-500 mb-2 flex justify-between">
                <span>Kecerahan Layar</span>
                <span className="text-pink-500 font-bold">{brightness}%</span>
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={brightness}
                onChange={(e) => setBrightness(Number(e.target.value))}
                onMouseUp={sendBrightness}
                onTouchEnd={sendBrightness}
                className="w-full accent-amber-400 h-2.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
               <div className="flex justify-between text-[10px] text-gray-400 mt-1 font-medium">
                <span>🌑 0%</span><span>🔆 100%</span>
              </div>
            </div>
          </div>
        </Card>

        {/* ─── Kanan: Foto & Sistem ─── */}
        <div className="flex flex-col gap-6">
          {/* ─── SECTION C: Kelola Foto SD Card ─── */}
          <Card title="Kelola Foto" emoji="🖼️" delay={0.1}>
            <div className="flex-1 flex flex-col">
              {/* Drop zone */}
              <div
                className={`relative rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer flex flex-col items-center justify-center gap-2 mb-3 ${
                  fotoPreview
                    ? "border-pink-300 bg-pink-50/30 p-1"
                    : "border-gray-200 bg-gray-50/50 hover:border-pink-300 hover:bg-pink-50/20 p-6"
                }`}
                onClick={() => !isLoading("foto_dl") && fotoInputRef.current?.click()}
              >
                <input
                  ref={fotoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFotoSelect}
                />

                {fotoPreview ? (
                  // Preview gambar yang sudah dipilih
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={fotoPreview}
                      alt="Preview"
                      className="w-full h-32 object-contain rounded-xl"
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (fotoPreview) URL.revokeObjectURL(fotoPreview);
                        setFotoFile(null);
                        setFotoPreview(null);
                        setUploadProgress(0);
                      }}
                      className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600 transition-colors shadow"
                    >
                      ✕
                    </button>
                  </>
                ) : (
                  // Placeholder saat belum ada foto dipilih
                  <>
                    <div className="w-12 h-12 rounded-2xl bg-pink-100 flex items-center justify-center text-2xl">
                      🖼️
                    </div>
                    <p className="text-sm font-semibold text-gray-600">Klik untuk pilih foto</p>
                    <p className="text-xs text-gray-400">JPG, PNG, WebP — maks 5MB</p>
                    <p className="text-[10px] text-pink-400 font-medium bg-pink-50 px-2 py-1 rounded-full">
                      Akan di-resize otomatis ke 128×160px
                    </p>
                  </>
                )}
              </div>

              {/* Info nama file */}
              {fotoFile && (
                <p className="text-[11px] text-gray-500 font-medium text-center mb-2 truncate px-2">
                  📎 {fotoFile.name} ({(fotoFile.size / 1024).toFixed(0)} KB)
                </p>
              )}

              {/* Progress bar */}
              {isLoading("foto_dl") && uploadProgress > 0 && (
                <div className="w-full bg-gray-100 rounded-full h-1.5 mb-3 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-pink-400 to-rose-400 rounded-full transition-all duration-500"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3 mt-3">
              <Btn
                onClick={uploadFoto}
                loading={isLoading("foto_dl")}
                disabled={!fotoFile}
              >
                {isLoading("foto_dl") ? (
                  <span>Mengupload... {uploadProgress}%</span>
                ) : (
                  <><span>☁️</span> Upload & Kirim ke ESP32</>
                )}
              </Btn>
              <Btn onClick={sendSlideshow} loading={isLoading("slideshow")} className="!bg-gradient-to-r !from-indigo-400 !to-blue-500 shadow-indigo-300/40">
                📸 Putar Slideshow
              </Btn>
            </div>
          </Card>

          {/* ─── SECTION D: Sistem & Perawatan ─── */}
          <Card title="Sistem & Perawatan" emoji="⚙️" delay={0.15}>
            <div className="flex-1 flex flex-col gap-5">
              
              {/* OTA */}
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-2 block">Update Firmware (OTA)</label>
                <div className="flex gap-2">
                  <input
                    type="file"
                    accept=".bin"
                    className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-pink-300 focus:ring-2 focus:ring-pink-200 transition-all font-mono file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-pink-100 file:text-pink-700 hover:file:bg-pink-200"
                    onChange={(e) => setFirmwareFile(e.target.files[0])}
                  />
                  <Btn onClick={sendOTA} loading={isLoading("ota")} full={false} danger className="!py-2 !px-4 !rounded-xl">
                    Update
                  </Btn>
                </div>
              </div>

              {/* WiFi Reset */}
              <div className="mt-auto border-t border-gray-100 pt-4">
                 <Btn onClick={sendWifiReset} loading={isLoading("wifi")} danger>
                  📶 Reset WiFi Perangkat
                </Btn>
                <p className="text-[10px] text-gray-400 text-center mt-3 font-medium leading-relaxed bg-gray-50 p-2 rounded-lg border border-gray-100">
                  Gunakan ini sebelum memberikan alat ke Suci agar dia bisa menghubungkan ke WiFi kostnya.
                </p>
              </div>

            </div>
          </Card>
        </div>

      </main>

      {/* Footer */}
      <footer className="relative z-10 text-center mt-10 pb-6">
        <p className="text-[11px] text-gray-400 font-medium">
          RoboLove Admin • MQTT {mqttOk ? "🟢" : "🔴"} • {MQTT_OPTS.clientId.slice(-8)}
        </p>
      </footer>
    </div>
  );
}
