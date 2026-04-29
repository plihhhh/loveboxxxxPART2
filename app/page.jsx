"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { User, Lock, Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();

  // State untuk form & UI
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [shaking, setShaking] = useState(false);

  // Fungsi untuk handle submit form
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        // Redirect berdasarkan role
        if (data.role === "admin") {
          router.push("/admin");
        } else {
          router.push("/user");
        }
      } else {
        // Tampilkan error dan trigger animasi shake
        setError(data.message || "Login gagal");
        triggerShake();
        setLoading(false);
      }
    } catch (err) {
      console.error("Login error:", err);
      setError("Terjadi kesalahan jaringan");
      triggerShake();
      setLoading(false);
    }
  };

  // Helper untuk trigger animasi shake
  const triggerShake = () => {
    setShaking(true);
    setTimeout(() => {
      setShaking(false);
    }, 500); // Sesuai durasi durasi animasi di globals.css
  };

  return (
    // Background gradient diagonal
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#F8B4C8] to-[#B4D4F8] p-4 text-[#4A4A4A] font-poppins">
      
      {/* Card Login */}
      <div 
        className={`w-full max-w-md bg-white/90 backdrop-blur-md rounded-2xl shadow-lg p-8 animate-fade-in ${
          shaking ? "animate-shake" : ""
        }`}
      >
        {/* Header (Emoji, Title, Subtitle) */}
        <div className="text-center mb-6">
          <div className="text-6xl mb-4">💝</div>
          <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#F8B4C8] to-[#F8D4B4] mb-2">
            Love Box
          </h1>
          <p className="text-gray-500 text-sm">
            Khusus untuk Muflih & Suci
          </p>
        </div>

        {/* Divider tipis */}
        <hr className="border-gray-200 mb-6" />

        {/* Notifikasi Error */}
        {error && (
          <div className="mb-6 flex items-center gap-3 bg-red-100 text-red-600 p-3 rounded-lg text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {/* Form Login */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Input Username */}
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3">
              <User className="w-5 h-5 text-gray-400 group-focus-within:text-[#F8B4C8] transition-colors" />
            </div>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-[#F8B4C8] focus:ring-1 focus:ring-[#F8B4C8] transition-all"
            />
          </div>

          {/* Input Password */}
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3">
              <Lock className="w-5 h-5 text-gray-400 group-focus-within:text-[#F8B4C8] transition-colors" />
            </div>
            <input
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full pl-10 pr-12 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-[#F8B4C8] focus:ring-1 focus:ring-[#F8B4C8] transition-all"
            />
            {/* Toggle show/hide password */}
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
            >
              {showPassword ? (
                <EyeOff className="w-5 h-5" />
              ) : (
                <Eye className="w-5 h-5" />
              )}
            </button>
          </div>

          {/* Tombol Masuk */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center items-center py-3 px-4 bg-gradient-to-r from-[#F8B4C8] to-[#F8D4B4] hover:from-[#f29fba] hover:to-[#f2c7a0] text-white font-semibold rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Masuk...
              </>
            ) : (
              "Masuk"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
