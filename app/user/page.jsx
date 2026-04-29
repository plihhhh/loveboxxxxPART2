"use client";

import { useState, useEffect, useRef } from "react";
import mqtt from "mqtt";
import { useRouter } from "next/navigation";
import { 
  LogOut, 
  Clock, 
  Calendar, 
  Image as ImageIcon, 
  MessageCircle, 
  CloudSun, 
  Upload, 
  Trash2, 
  BatteryFull, 
  BatteryMedium, 
  BatteryLow 
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";

export default function UserDashboard() {
  const router = useRouter();

  // State: Status Perangkat
  const [status, setStatus] = useState({
    online: false,
    battery: 0,
  });

  // State: Mode Tampilan (Card A)
  const [modes, setModes] = useState({
    jam: true,
    tanggal: true,
    foto: true,
    pesan: true,
    cuaca: true
  });
  const [loadingMode, setLoadingMode] = useState(false);

  // State: Tema Layar TFT (Card Baru)
  const [activeTheme, setActiveTheme] = useState("pastel_love");
  const [loadingTheme, setLoadingTheme] = useState(false);

  const tftThemes = [
    { id: 'pastel_love', name: 'Pastel Love', emoji: '🌸', color: 'bg-pink-100 text-pink-600 border-pink-200' },
    { id: 'classic_dark', name: 'Classic Dark', emoji: '🌙', color: 'bg-gray-800 text-gray-100 border-gray-700' },
    { id: 'retro_8bit', name: 'Retro 8-Bit', emoji: '👾', color: 'bg-orange-100 text-orange-600 border-orange-200' },
    { id: 'neon_cyberpunk', name: 'Cyberpunk', emoji: '⚡', color: 'bg-cyan-100 text-cyan-600 border-cyan-200' },
    { id: 'ocean_breeze', name: 'Ocean Breeze', emoji: '🌊', color: 'bg-blue-100 text-blue-600 border-blue-200' }
  ];

  // State: Kirim Pesan (Card B)
  const [pesan, setPesan] = useState("");
  const [warnaPesan, setWarnaPesan] = useState("#FFFFFF");
  const [ukuranPesan, setUkuranPesan] = useState("Sedang");
  const [fontPesan, setFontPesan] = useState("Sans-serif");
  const [loadingPesan, setLoadingPesan] = useState(false);

  const warnaPilihan = ["#FFFFFF", "#F8B4C8", "#B4D4F8", "#F8D4B4", "#B4F8B4", "#4A4A4A"];
  const ukuranPilihan = ["Kecil", "Sedang", "Besar"];
  const fontPilihan = ["Sans-serif", "Serif", "Monospace", "Cursive"];

  // State: Kelola Foto (Card C)
  const [fotos, setFotos] = useState([]);
  const [loadingFotoUpload, setLoadingFotoUpload] = useState(false);
  const fileInputRef = useRef(null);

  // State: Kecerahan (Card D)
  const [brightness, setBrightness] = useState(50);
  const [loadingBrightness, setLoadingBrightness] = useState(false);

  // Real-time Status via MQTT WebSockets
  useEffect(() => {
    const client = mqtt.connect(process.env.NEXT_PUBLIC_MQTT_URL, {
      username: process.env.NEXT_PUBLIC_MQTT_USERNAME,
      password: process.env.NEXT_PUBLIC_MQTT_PASSWORD,
    });

    client.on("connect", () => {
      console.log("WebSocket terhubung ke MQTT!");
      client.subscribe("lovebox/status");
    });

    client.on("message", (topic, message) => {
      if (topic === "lovebox/status") {
        try {
          const data = JSON.parse(message.toString());
          setStatus(prev => ({
            ...prev,
            online: data.online ?? true, 
            battery: data.battery ?? prev.battery
          }));
        } catch (error) {
          console.error("Gagal parse MQTT status:", error);
        }
      }
    });

    client.on("close", () => setStatus(prev => ({ ...prev, online: false })));
    client.on("offline", () => setStatus(prev => ({ ...prev, online: false })));

    // Cleanup saat komponen unmount
    return () => {
      if (client) client.end();
    };
  }, []);

  // Fetch Initial Data (Fotos dll)
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/foto");
        if (res.ok) {
          const data = await res.json();
          setFotos(data.fotos || data || []);
        }
      } catch (e) {
        console.error("Gagal load foto:", e);
      }
    };
    fetchData();
  }, []);

  // Handlers
  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "GET" });
      router.push("/");
    } catch (error) {
      toast.error("Gagal logout");
    }
  };

  const handleSaveMode = async () => {
    setLoadingMode(true);
    try {
      const res = await fetch("/api/mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(modes)
      });
      if (res.ok) toast.success("Tampilan berhasil disimpan! ✨");
      else throw new Error("Gagal");
    } catch (error) {
      toast.error("Gagal menyimpan tampilan");
    }
    setLoadingMode(false);
  };

  const handleSaveTheme = async () => {
    setLoadingTheme(true);
    try {
      const res = await fetch("/api/theme", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: activeTheme })
      });
      if (res.ok) toast.success("Tema layar berhasil diubah! 🎨");
      else throw new Error("Gagal");
    } catch (error) {
      toast.error("Gagal mengubah tema layar");
    }
    setLoadingTheme(false);
  };

  const handleKirimPesan = async () => {
    if (!pesan.trim()) return toast.error("Pesan tidak boleh kosong");
    setLoadingPesan(true);
    try {
      const res = await fetch("/api/pesan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pesan, warna: warnaPesan, ukuran: ukuranPesan, font: fontPesan })
      });
      if (res.ok) {
        toast.success("Pesan terkirim! 💌");
        setPesan("");
      } else throw new Error("Gagal");
    } catch (error) {
      toast.error("Gagal mengirim pesan");
    }
    setLoadingPesan(false);
  };

  const handleUploadFoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setLoadingFotoUpload(true);
    const formData = new FormData();
    formData.append("file", file);
    
    try {
      const res = await fetch("/api/foto", {
        method: "POST",
        body: formData
      });
      if (res.ok) {
        toast.success("Foto berhasil diupload! 📸");
        // Refresh daftar foto
        const resData = await res.json();
        if (resData.fotos) setFotos(resData.fotos);
        else if (Array.isArray(resData)) setFotos(resData);
      } else throw new Error("Gagal");
    } catch (error) {
      toast.error("Gagal upload foto");
    }
    setLoadingFotoUpload(false);
  };

  const handleHapusFoto = async (id) => {
    try {
      const res = await fetch(`/api/foto?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setFotos(prev => prev.filter(f => f.id !== id));
        toast.success("Foto dihapus 🗑️");
      } else throw new Error("Gagal");
    } catch (error) {
      toast.error("Gagal menghapus foto");
    }
  };

  const handleSaveBrightness = async () => {
    setLoadingBrightness(true);
    try {
      const res = await fetch("/api/brightness", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brightness })
      });
      if (res.ok) toast.success("Kecerahan berhasil disimpan! ☀️");
      else throw new Error("Gagal");
    } catch (error) {
      toast.error("Gagal menyimpan kecerahan");
    }
    setLoadingBrightness(false);
  };

  // Helper Icon Baterai
  const renderBatteryIcon = () => {
    if (status.battery > 70) return <BatteryFull size={16} />;
    if (status.battery > 30) return <BatteryMedium size={16} />;
    return <BatteryLow size={16} className="text-red-500" />;
  };

  return (
    // Background light pastel blue
    <div className="min-h-screen bg-[#F0F7FF] text-[#4A4A4A] pb-12 font-poppins" style={{ fontFamily: "'Poppins', sans-serif" }}>
      <Toaster position="top-center" />
      
      {/* HEADER STICKY */}
      <header className="sticky top-0 bg-white/90 backdrop-blur-md shadow-sm z-50 mb-6">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-[#B4D4F8] to-[#F8B4C8] bg-clip-text text-transparent">
              Halo, Suci 💕
            </h1>
            <div className="flex items-center text-xs text-gray-500 mt-1 space-x-3">
              <div className="flex items-center space-x-1">
                <span className={`w-2 h-2 rounded-full ${status.online ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></span>
                <span>{status.online ? "Online" : "Offline"}</span>
              </div>
              <div className="flex items-center space-x-1">
                {renderBatteryIcon()}
                <span>{status.battery}%</span>
              </div>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-50 rounded-full transition-colors"
            title="Logout"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      {/* CONTAINER MAX-WIDTH */}
      <main className="max-w-2xl mx-auto px-4 space-y-5">
        
        {/* CARD A - Pilih Tampilan */}
        <section className="bg-white rounded-2xl p-6 shadow-sm border border-blue-50/50">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            Pilih Tampilan ✨
          </h2>
          <div className="space-y-3">
            {[
              { id: 'jam', label: 'Jam', icon: Clock },
              { id: 'tanggal', label: 'Tanggal', icon: Calendar },
              { id: 'foto', label: 'Foto', icon: ImageIcon },
              { id: 'pesan', label: 'Pesan', icon: MessageCircle },
              { id: 'cuaca', label: 'Cuaca', icon: CloudSun }
            ].map((item) => (
              <div key={item.id} className="flex items-center justify-between p-3 bg-[#F8FAFC] rounded-xl border border-gray-100">
                <div className="flex items-center gap-3">
                  <item.icon size={18} className="text-[#B4D4F8]" />
                  <span className="font-medium text-sm">{item.label}</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer"
                    checked={modes[item.id]}
                    onChange={() => setModes(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                  />
                  {/* Warna toggle pastel blue (#B4D4F8) */}
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#B4D4F8]"></div>
                </label>
              </div>
            ))}
          </div>
          <button 
            disabled={loadingMode}
            onClick={handleSaveMode}
            className="mt-5 w-full py-3 rounded-xl bg-gradient-to-r from-[#B4D4F8] to-[#88B8F2] hover:opacity-90 text-white font-medium shadow-sm transition-all flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loadingMode ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : "Simpan Tampilan"}
          </button>
        </section>

        {/* CARD A2 - Tema Layar TFT */}
        <section className="bg-white rounded-2xl p-6 shadow-sm border border-blue-50/50">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            Tema Layar TFT 🎨
          </h2>
          <div className="grid grid-cols-2 gap-3 mb-5">
            {tftThemes.map((thm) => (
              <button
                key={thm.id}
                onClick={() => setActiveTheme(thm.id)}
                className={`py-3 px-2 rounded-xl border text-sm font-medium transition-all ${
                  activeTheme === thm.id 
                    ? `shadow-md ring-2 ring-blue-300 scale-[1.02] ${thm.color}`
                    : 'bg-gray-50 text-gray-500 border-gray-100 hover:bg-gray-100'
                }`}
              >
                <div className="text-xl mb-1">{thm.emoji}</div>
                <div>{thm.name}</div>
              </button>
            ))}
          </div>
          <button 
            disabled={loadingTheme}
            onClick={handleSaveTheme}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-[#B4D4F8] to-[#88B8F2] hover:opacity-90 text-white font-medium shadow-sm transition-all flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loadingTheme ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : "Terapkan Tema"}
          </button>
        </section>

        {/* CARD B - Pesan dari Hatiku */}
        <section className="bg-white rounded-2xl p-6 shadow-sm border border-blue-50/50">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            Pesan dari Hatiku 💌
          </h2>
          <div className="relative">
            <textarea
              className="w-full bg-[#F8FAFC] border border-gray-200 rounded-xl p-4 h-28 text-sm focus:outline-none focus:border-[#B4D4F8] focus:ring-1 focus:ring-[#B4D4F8] transition-all resize-none"
              placeholder="Tulis pesan spesialmu di sini..."
              maxLength={100}
              value={pesan}
              onChange={(e) => setPesan(e.target.value)}
            ></textarea>
            <span className="absolute bottom-3 right-3 text-xs text-gray-400 font-medium">
              {pesan.length}/100
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-2 block">Pilih Warna Teks</label>
              <div className="flex gap-2">
                {warnaPilihan.map(color => (
                  <button
                    key={color}
                    onClick={() => setWarnaPesan(color)}
                    className={`w-7 h-7 rounded-full border border-gray-200 shadow-sm transition-transform ${warnaPesan === color ? 'ring-2 ring-gray-400 scale-110' : ''}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-2 block">Ukuran Teks</label>
              <div className="flex bg-[#F8FAFC] p-1 rounded-lg border border-gray-100">
                {ukuranPilihan.map(uk => (
                  <button
                    key={uk}
                    onClick={() => setUkuranPesan(uk)}
                    className={`flex-1 text-xs py-1.5 rounded-md transition-colors ${ukuranPesan === uk ? 'bg-white shadow-sm font-medium text-[#79a9e3]' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    {uk}
                  </button>
                ))}
              </div>
            </div>
            {/* Opsi Font */}
            <div className="col-span-2">
              <label className="text-xs font-semibold text-gray-500 mb-2 block">Gaya Huruf (Font)</label>
              <div className="flex bg-[#F8FAFC] p-1 rounded-lg border border-gray-100 flex-wrap">
                {fontPilihan.map(fnt => (
                  <button
                    key={fnt}
                    onClick={() => setFontPesan(fnt)}
                    className={`flex-1 text-xs py-1.5 rounded-md transition-colors whitespace-nowrap ${fontPesan === fnt ? 'bg-white shadow-sm font-medium text-[#79a9e3]' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    {fnt}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-5">
            <label className="text-xs font-semibold text-gray-500 mb-2 block">Preview Layar Cinta</label>
            <div className="bg-[#2A2A2A] min-h-[90px] rounded-xl flex items-center justify-center p-4 shadow-inner">
              <p 
                className="text-center w-full break-words font-medium transition-all"
                style={{ 
                  color: warnaPesan,
                  fontSize: ukuranPesan === 'Kecil' ? '0.875rem' : ukuranPesan === 'Besar' ? '1.25rem' : '1rem',
                  fontFamily: fontPesan.toLowerCase()
                }}
              >
                {pesan || "Pesanmu akan tampil di sini..."}
              </p>
            </div>
          </div>

          <button 
            disabled={loadingPesan}
            onClick={handleKirimPesan}
            className="mt-5 w-full py-3 rounded-xl bg-gradient-to-r from-[#B4D4F8] to-[#88B8F2] hover:opacity-90 text-white font-medium shadow-sm transition-all flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loadingPesan ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : "Kirim Pesan 💌"}
          </button>
        </section>

        {/* CARD C - Foto Kita */}
        <section className="bg-white rounded-2xl p-6 shadow-sm border border-blue-50/50 relative overflow-hidden">
          {loadingFotoUpload && (
            <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center">
              <div className="w-8 h-8 border-4 border-blue-200 border-t-[#B4D4F8] rounded-full animate-spin"></div>
              <p className="mt-2 text-sm font-medium text-[#79a9e3]">Mengunggah foto...</p>
            </div>
          )}

          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            Foto Kita 📸
          </h2>

          <div 
            className="border-2 border-dashed border-[#B4D4F8] bg-blue-50/30 rounded-xl p-6 text-center cursor-pointer hover:bg-blue-50/50 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <input 
              type="file" 
              className="hidden" 
              ref={fileInputRef} 
              accept="image/*" 
              capture="environment" /* Prioritaskan kamera belakang jika di HP */
              onChange={handleUploadFoto}
            />
            <div className="w-12 h-12 bg-blue-100 text-[#79a9e3] rounded-full flex items-center justify-center mx-auto mb-2 shadow-sm">
              <Upload size={24} />
            </div>
            <p className="text-sm text-gray-500 font-medium">Buka Kamera atau Galeri</p>
          </div>

          <div className="mt-5 grid grid-cols-2 md:grid-cols-3 gap-3">
            {fotos.length > 0 ? fotos.map((foto) => (
              <div key={foto.id} className="relative aspect-square rounded-xl overflow-hidden group border border-gray-100 bg-gray-50 shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={foto.url || foto.path || '/placeholder-image.jpg'} alt="Foto kenangan" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button 
                    onClick={() => handleHapusFoto(foto.id)}
                    className="p-2 bg-white text-red-500 rounded-full hover:bg-red-50 hover:scale-110 transition-all shadow-md"
                    title="Hapus foto ini"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            )) : (
               <div className="col-span-2 md:col-span-3 text-center py-6 text-gray-400 text-sm font-medium">
                Belum ada foto yang diunggah. Berikan kenangan manis kalian!
              </div>
            )}
          </div>
        </section>

        {/* CARD D - Kecerahan Layar */}
        <section className="bg-white rounded-2xl p-6 shadow-sm border border-blue-50/50">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            Kecerahan Layar ☀️
          </h2>
          
          <div className="mb-5 mt-2">
            <label className="text-sm font-medium text-gray-700 mb-3 flex justify-between">
              <span>Kecerahan Layar</span>
              <span className="text-[#79a9e3] font-semibold">{brightness}%</span>
            </label>
            <input 
              type="range" 
              min="0" 
              max="100" 
              step="1"
              value={brightness}
              onChange={(e) => setBrightness(parseInt(e.target.value))}
              className="w-full accent-[#B4D4F8] h-2 bg-gray-100 rounded-lg appearance-none cursor-pointer mt-2"
            />
          </div>

          <button 
            disabled={loadingBrightness}
            onClick={handleSaveBrightness}
            className="w-full py-3 rounded-xl bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition-colors text-sm flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loadingBrightness ? (
              <div className="w-4 h-4 border-2 border-gray-400/30 border-t-gray-600 rounded-full animate-spin"></div>
            ) : "Simpan Kecerahan"}
          </button>
        </section>

      </main>
    </div>
  );
}
