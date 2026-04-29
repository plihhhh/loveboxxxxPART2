// ==============================================
// lib/auth.js
// Modul autentikasi JWT menggunakan library 'jose'
// Untuk generate dan verifikasi token login
// ==============================================

import { SignJWT, jwtVerify } from "jose";

// --- Secret key untuk menandatangani JWT ---
// Diambil dari environment variable, encode ke Uint8Array
// karena jose membutuhkan format ini untuk algoritma HS256
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "ganti_dengan_string_random_panjang_minimal_32_karakter"
);

// --- Durasi token ---
// Token berlaku selama 7 hari
const TOKEN_EXPIRY = "7d";

// ==============================================
// generateToken(username, role)
// Membuat JWT token baru untuk pengguna yang
// berhasil login.
//
// Parameter:
//   username - Nama pengguna ("muflih" atau "suci")
//   role     - Role pengguna ("admin" atau "user")
//
// Payload JWT yang dihasilkan:
//   {
//     username: "muflih",
//     role: "admin",
//     iat: 1713100000,     → issued at (otomatis)
//     exp: 1713704800      → expiry 7 hari (otomatis)
//   }
//
// Return: Promise<string> → JWT token string
//
// Contoh penggunaan:
//   const token = await generateToken("muflih", "admin");
//   // "eyJhbGciOiJIUzI1NiJ9.eyJ1c2Vy..."
// ==============================================
export async function generateToken(username, role) {
  const token = await new SignJWT({ username, role })
    .setProtectedHeader({ alg: "HS256" })  // Algoritma signing
    .setIssuedAt()                          // Tambahkan iat (waktu dibuat)
    .setExpirationTime(TOKEN_EXPIRY)        // Tambahkan exp (waktu kadaluarsa)
    .sign(JWT_SECRET);                      // Tanda tangani dengan secret

  return token;
}

// ==============================================
// verifyToken(token)
// Memverifikasi dan mendekode JWT token.
// Mengecek apakah token valid, belum expired,
// dan ditandatangani dengan secret yang benar.
//
// Parameter:
//   token - JWT token string dari cookie
//
// Return: Promise<Object|null>
//   → Object payload jika valid:
//     { username: "muflih", role: "admin", iat: ..., exp: ... }
//   → null jika token tidak valid atau sudah expired
//
// Contoh penggunaan:
//   const payload = await verifyToken(token);
//   if (payload) {
//     console.log(payload.role); // "admin"
//   }
// ==============================================
export async function verifyToken(token) {
  try {
    // Verifikasi signature dan expiry token
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload;
  } catch (err) {
    // Token tidak valid, expired, atau signature salah
    console.error("❌ Token tidak valid:", err.message);
    return null;
  }
}
