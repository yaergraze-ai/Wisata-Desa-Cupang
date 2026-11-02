/**
 * Validator NIK (Nomor Induk Kependudukan) e-KTP Republik Indonesia
 * Sesuai Standar Dukcapil & UU No. 24 Tahun 2013 tentang Administrasi Kependudukan
 */

export interface IndonesianProvince {
  code: string;
  name: string;
}

export const INDONESIAN_PROVINCES: IndonesianProvince[] = [
  { code: "11", name: "Aceh" },
  { code: "12", name: "Sumatera Utara" },
  { code: "13", name: "Sumatera Barat" },
  { code: "14", name: "Riau" },
  { code: "15", name: "Jambi" },
  { code: "16", name: "Sumatera Selatan" },
  { code: "17", name: "Bengkulu" },
  { code: "18", name: "Lampung" },
  { code: "19", name: "Kepulauan Bangka Belitung" },
  { code: "21", name: "Kepulauan Riau" },
  { code: "31", name: "DKI Jakarta" },
  { code: "32", name: "Jawa Barat" },
  { code: "33", name: "Jawa Tengah" },
  { code: "34", name: "DI Yogyakarta" },
  { code: "35", name: "Jawa Timur" },
  { code: "36", name: "Banten" },
  { code: "51", name: "Bali" },
  { code: "52", name: "Nusa Tenggara Barat" },
  { code: "53", name: "Nusa Tenggara Timur" },
  { code: "61", name: "Kalimantan Barat" },
  { code: "62", name: "Kalimantan Tengah" },
  { code: "63", name: "Kalimantan Selatan" },
  { code: "64", name: "Kalimantan Timur" },
  { code: "65", name: "Kalimantan Utara" },
  { code: "71", name: "Sulawesi Utara" },
  { code: "72", name: "Sulawesi Tengah" },
  { code: "73", name: "Sulawesi Selatan" },
  { code: "74", name: "Sulawesi Tenggara" },
  { code: "75", name: "Gorontalo" },
  { code: "76", name: "Sulawesi Barat" },
  { code: "81", name: "Maluku" },
  { code: "82", name: "Maluku Utara" },
  { code: "91", name: "Papua" },
  { code: "92", name: "Papua Barat" },
  { code: "93", name: "Papua Selatan" },
  { code: "94", name: "Papua Tengah" },
  { code: "95", name: "Papua Pegunungan" },
  { code: "96", name: "Papua Barat Daya" },
];

const VALID_PROVINCE_CODES = new Set(INDONESIAN_PROVINCES.map((p) => p.code));

export interface NikValidationResult {
  isValid: boolean;
  message?: string;
  data?: {
    provinceCode: string;
    provinceName?: string;
    cityCode: string;
    districtCode: string;
    gender: "LAKI_LAKI" | "PEREMPUAN";
    birthDay: number;
    birthMonth: number;
    birthYearSuffix: number;
    sequence: string;
  };
}

export function validateIndonesianNik(rawNik: string | null | undefined): NikValidationResult {
  if (!rawNik) {
    return { isValid: false, message: "NIK wajib diisi." };
  }

  const clean = rawNik.replace(/\s|-/g, "").trim();

  if (!/^\d{16}$/.test(clean)) {
    return {
      isValid: false,
      message: "NIK harus tepat 16 digit angka sesuai e-KTP resmi.",
    };
  }

  // Cek nomor dummy repetitif (contoh: 1111111111111111, 0000000000000000)
  if (/^(\d)\1{15}$/.test(clean)) {
    return {
      isValid: false,
      message: "NIK tidak boleh berupa angka repetitif identik.",
    };
  }

  // Cek nomor dummy berurutan
  if (clean === "1234567890123456" || clean === "0123456789012345") {
    return {
      isValid: false,
      message: "NIK tidak valid (urutan angka dummy).",
    };
  }

  // 1. Validasi Kode Provinsi (Digit 1-2)
  const prov = clean.slice(0, 2);
  if (!VALID_PROVINCE_CODES.has(prov)) {
    return {
      isValid: false,
      message: `Kode wilayah provinsi NIK (${prov}) tidak terdaftar di database kependudukan Indonesia.`,
    };
  }

  // 2. Validasi Tanggal Lahir (Digit 7-12)
  const dayRaw = parseInt(clean.slice(6, 8), 10);
  const month = parseInt(clean.slice(8, 10), 10);
  const yearSuffix = parseInt(clean.slice(10, 12), 10);

  let isFemale = false;
  let birthDay = dayRaw;

  if (dayRaw > 40) {
    // Sesuai aturan Dukcapil, wanita = tanggal lahir + 40
    isFemale = true;
    birthDay = dayRaw - 40;
  }

  if (birthDay < 1 || birthDay > 31) {
    return {
      isValid: false,
      message: "Tanggal lahir pada digit NIK (digit 7-8) tidak valid.",
    };
  }

  if (month < 1 || month > 12) {
    return {
      isValid: false,
      message: "Bulan lahir pada digit NIK (digit 9-10) tidak valid (harus 01-12).",
    };
  }

  // 3. Validasi Nomor Urut Registrasi (Digit 13-16)
  const seq = clean.slice(12, 16);
  if (seq === "0000") {
    return {
      isValid: false,
      message: "Nomor urut registrasi NIK (digit 13-16) tidak boleh 0000.",
    };
  }

  const provObj = INDONESIAN_PROVINCES.find((p) => p.code === prov);

  return {
    isValid: true,
    data: {
      provinceCode: prov,
      provinceName: provObj?.name,
      cityCode: clean.slice(2, 4),
      districtCode: clean.slice(4, 6),
      gender: isFemale ? "PEREMPUAN" : "LAKI_LAKI",
      birthDay,
      birthMonth: month,
      birthYearSuffix: yearSuffix,
      sequence: seq,
    },
  };
}
