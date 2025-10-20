// Mapping data fakultas dan jurusan dengan nomor kode
export const FAKULTAS_JURUSAN_MAP = {
  "Fakultas Kedokteran (FK)": {
    kode: "01",
    prodi: {
      "Pendidikan Dokter": "01",
      "Kedokteran Gigi": "02",
      "Keperawatan": "03",
      "Farmasi": "04",
      "Gizi": "05",
      "Kedokteran Hewan": "06",
    },
  },
  "Fakultas Ekonomi dan Bisnis (FEB)": {
    kode: "02",
    prodi: {
      "Manajemen": "01",
      "Akuntansi": "02",
      "Ekonomi Pembangunan": "03",
      "Keuangan dan Perbankan": "04",
      "Ekonomi Syariah": "05",
      "Bisnis Digital": "06",
    },
  },
  "Fakultas Teknik (FT)": {
    kode: "03",
    prodi: {
      "Teknik Sipil": "01",
      "Teknik Mesin": "02",
      "Teknik Elektro": "03",
      "Teknik Industri": "04",
      "Teknik Kimia": "05",
      "Teknik Informatika": "06",
      "Arsitektur": "07",
    },
  },
  "Fakultas Hukum (FH)": {
    kode: "04",
    prodi: {
      "Ilmu Hukum": "01",
      "Hukum Internasional": "02",
      "Hukum Bisnis": "03",
      "Hukum Pidana": "04",
      "Hukum Tata Negara": "05",
    },
  },
  "Fakultas Ilmu Sosial dan Ilmu Politik (FISIP)": {
    kode: "05",
    prodi: {
      "Hubungan Internasional": "01",
      "Ilmu Komunikasi": "02",
      "Sosiologi": "03",
      "Administrasi Publik": "04",
      "Ilmu Politik": "05",
      "Kriminologi": "06",
    },
  },
  "Fakultas Seni Rupa dan Desain (FSRD)": {
    kode: "06",
    prodi: {
      "Desain Komunikasi Visual (DKV)": "01",
      "Desain Produk": "02",
      "Desain Interior": "03",
      "Seni Murni": "04",
      "Kriya": "05",
      "Film dan Televisi": "06",
      "Animasi": "07",
    },
  },
} as const;

export type FakultasName = keyof typeof FAKULTAS_JURUSAN_MAP;
export type JurusanName<T extends FakultasName> =
  keyof (typeof FAKULTAS_JURUSAN_MAP)[T]["prodi"];

/**
 * Generate NIM berdasarkan struktur:
 * [kode jurusan][kode fakultas][tahun masuk][nomor urutan]
 *
 * @param fakultas - Nama fakultas
 * @param jurusan - Nama jurusan
 * @param tahunMasuk - Tahun masuk (default: tahun sekarang)
 * @param nomorUrutan - Nomor urutan mahasiswa (akan di-increment otomatis jika tidak disediakan)
 * @returns NIM yang sudah di-generate
 */
export function generateNIM(
  fakultas: string,
  jurusan: string,
  tahunMasuk?: number,
  nomorUrutan?: number
): string {
  // Validasi fakultas
  const fakultasData = FAKULTAS_JURUSAN_MAP[fakultas as FakultasName];
  if (!fakultasData) {
    throw new Error(`Fakultas "${fakultas}" tidak ditemukan dalam mapping`);
  }

  // Validasi jurusan
  const jurusanKode =
    fakultasData.prodi[jurusan as keyof typeof fakultasData.prodi];
  if (!jurusanKode) {
    throw new Error(
      `Jurusan "${jurusan}" tidak ditemukan dalam fakultas "${fakultas}"`
    );
  }

  // Gunakan tahun sekarang jika tidak disediakan
  const tahun = tahunMasuk || new Date().getFullYear();
  const tahunStr = tahun.toString(); // Gunakan 4 digit tahun penuh

  // Generate nomor urutan jika tidak disediakan
  const urutan = nomorUrutan || 1;
  const urutanStr = urutan.toString().padStart(3, "0"); // 3 digit dengan leading zero

  // Gabungkan semua komponen
  const nim = `${jurusanKode}${fakultasData.kode}${tahunStr}${urutanStr}`;

  return nim;
}

/**
 * Parse NIM untuk mendapatkan informasi komponennya
 *
 * @param nim - NIM yang akan di-parse
 * @returns Object berisi komponen NIM
 */
export function parseNIM(nim: string): {
  kodeJurusan: string;
  kodeFakultas: string;
  tahunMasuk: string;
  nomorUrutan: string;
  fakultas?: string;
  jurusan?: string;
} {
  if (nim.length !== 13) {
    throw new Error("Format NIM tidak valid. NIM harus terdiri dari 13 digit");
  }

  const kodeJurusan = nim.slice(0, 2);
  const kodeFakultas = nim.slice(2, 4);
  const tahunMasuk = nim.slice(4, 8);
  const nomorUrutan = nim.slice(8, 11);

  // Cari nama fakultas dan jurusan berdasarkan kode
  let fakultas: string | undefined;
  let jurusan: string | undefined;

  for (const [namaFakultas, dataFakultas] of Object.entries(
    FAKULTAS_JURUSAN_MAP
  )) {
    if (dataFakultas.kode === kodeFakultas) {
      fakultas = namaFakultas;

      // Cari jurusan
      for (const [namaJurusan, kodeJurusanData] of Object.entries(
        dataFakultas.prodi
      )) {
        if (kodeJurusanData === kodeJurusan) {
          jurusan = namaJurusan;
          break;
        }
      }
      break;
    }
  }

  return {
    kodeJurusan,
    kodeFakultas,
    tahunMasuk,
    nomorUrutan,
    fakultas,
    jurusan,
  };
}

/**
 * Validasi apakah fakultas dan jurusan valid
 *
 * @param fakultas - Nama fakultas
 * @param jurusan - Nama jurusan
 * @returns true jika valid, false jika tidak
 */
export function validateFakultasJurusan(
  fakultas: string,
  jurusan: string
): boolean {
  try {
    generateNIM(fakultas, jurusan);
    return true;
  } catch {
    return false;
  }
}

/**
 * Mendapatkan daftar semua fakultas
 */
export function getAllFakultas(): string[] {
  return Object.keys(FAKULTAS_JURUSAN_MAP);
}

/**
 * Mendapatkan daftar jurusan berdasarkan fakultas
 *
 * @param fakultas - Nama fakultas
 * @returns Array nama jurusan
 */
export function getJurusanByFakultas(fakultas: string): string[] {
  const fakultasData = FAKULTAS_JURUSAN_MAP[fakultas as FakultasName];
  if (!fakultasData) {
    return [];
  }
  return Object.keys(fakultasData.prodi) as string[];
}
