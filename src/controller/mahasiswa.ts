import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import "dotenv/config";
import { Prisma, PrismaClient } from "@prisma/client";
import { verifyJwt } from "./admin"; // tetap boleh, tidak circular selama admin tidak import mahasiswa
import multer from "multer";
import path from "path";
import fs from "fs";
import { Request, Response } from "express";
import dayjs from "dayjs";
import { redisService, CACHE_KEYS, CACHE_TTL } from "../utils/redis";
import {
  generateNIM,
  validateFakultasJurusan,
  getAllFakultas,
  getJurusanByFakultas,
} from "../utils/nimGenerator";
const prisma = new PrismaClient();

let nextCursorPage: number | null = null;
let paginationValue: number = 30;

const s3 = new S3Client({
  region: "de-fra1",
  endpoint: process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY!,
    secretAccessKey: process.env.S3_SECRET_KEY!,
  },
  forcePathStyle: true,
});

type AdminAuthed = { admin_id: number };
type CreateMahasiswaBody = AdminAuthed & {
  name: string;
  email: string;
  phone_number: string;
  fakultas: string;
  jurusan: string;
  birth: string;
  gender: string;
  image: string;
  address?: string;
  city?: string;
  district?: string;
  subdistrict?: string;
  province?: string;
};
type UpdateMahasiswaBody = AdminAuthed & {
  nim: number;
  name?: string;
  city?: string;
  email?: string;
  phone_number?: string;
  fakultas?: string;
  jurusan?: string;
  birth?: string;
  gender?: string;
  image?: string;
  district?: string;
  subdistrict?: string;
  province?: string;
};

// ---- Helpers ----
function unauthorized(res: Response) {
  return res.status(400).send({ msg: "Unauthorized" });
}

// Helper function untuk invalidate dashboard cache
async function invalidateDashboardCache() {
  try {
    await redisService.del(CACHE_KEYS.DASHBOARD_DATA);
    console.log("Dashboard cache invalidated");
  } catch (error) {
    console.error("Error invalidating dashboard cache:", error);
  }
}

export async function getAll(req: Request, res: Response) {
  const token = req.headers.authorization as string | undefined;
  const admin_id = (req.body?.admin_id as number | undefined) ?? undefined;
  const isFirstTime = Boolean(req.body?.is_first_time);

  const verified = verifyJwt(token ?? "", admin_id ?? 0);
  if (!verified) return unauthorized(res);

  try {
    if (isFirstTime || nextCursorPage === null) {
      const result = await prisma.mahasiswa.findMany({
        take: paginationValue,
        orderBy: { nim: "asc" },
      });

      if (result.length > 0) {
        const last = result[result.length - 1];
        nextCursorPage = last.nim;
        return res.status(200).send({ msg: "Succesfully", result });
      }

      nextCursorPage = -1;
      return res.status(200).send({ msg: "Data is empty", result: [] });
    }

    if (nextCursorPage < 0) {
      return res.status(200).send({ msg: "Data is empty", result: [] });
    }

    const result = await prisma.mahasiswa.findMany({
      take: paginationValue,
      cursor: { nim: nextCursorPage },
      skip: 1,
      orderBy: { nim: "asc" },
    });

    if (result.length === 0) {
      nextCursorPage = -1;
      return res.status(200).send({ msg: "Data is empty", result: [] });
    }

    const last = result[result.length - 1];
    nextCursorPage = result.length < paginationValue ? -1 : last.nim;
    return res.status(200).send({ msg: "Succesfully", result });
  } catch (error) {
    return res.status(500).send({ msg: "Internal Server Error", error });
  } finally {
    await prisma.$disconnect();
  }
}

export async function filterMhs(req: Request, res: Response) {
  const token = req.headers.authorization as string | undefined;
  const admin_id = (req.body?.admin_id as number | undefined) ?? undefined;

  const verified = verifyJwt(token ?? "", admin_id ?? 0);
  if (!verified) return unauthorized(res);

  try {
    const incomingWhere = (req.body as any)?.where ?? {};
    const where: Prisma.MahasiswaWhereInput = {};

    const assignStringOrArrayIn = (
      key: "fakultas" | "jurusan" | "city",
      value: unknown
    ) => {
      if (Array.isArray(value)) {
        if (value.length > 0) {
          (where as any)[key] = { in: value };
        }
      } else if (typeof value === "string") {
        const trimmed = value.trim();
        if (trimmed) {
          (where as any)[key] = trimmed;
        }
      }
    };

    assignStringOrArrayIn("fakultas", incomingWhere.fakultas);
    assignStringOrArrayIn("jurusan", incomingWhere.jurusan);
    assignStringOrArrayIn("city", incomingWhere.city);

    const result = await prisma.mahasiswa.findMany({
      where,
      orderBy: req.body.orderBy,
      select: {
        nim: true,
        name: true,
        jurusan: true,
        city: true,
        fakultas: true,
      },
    });

    return res.status(200).send({ msg: "Successfully", result });
  } catch (error) {
    console.error(error);
    return res.status(500).send({ msg: "Internal Server Error", error });
  } finally {
    await prisma.$disconnect();
  }
}

export async function getMhs(req: Request, res: Response) {
  const token = req.headers.authorization as string | undefined;
  const admin_id = (req.body?.admin_id as number | undefined) ?? undefined;
  const verified = verifyJwt(token ?? "", admin_id ?? 0);
  if (!verified) return unauthorized(res);

  const nimParam = req.params.nim;
  const nim = Number.parseInt(nimParam, 10);

  try {
    const result = await prisma.mahasiswa.findUnique({ where: { nim } });

    return res.status(200).send({ msg: "Succesfully", result });
  } catch (error) {
    return res.status(500).send({ msg: "Internal Server Error", error });
  } finally {
    await prisma.$disconnect();
  }
}

export async function createMhs(
  req: Request<{}, {}, CreateMahasiswaBody>,
  res: Response
) {
  const token = req.headers.authorization as string | undefined;
  const admin_id = req.body.admin_id;
  const verified = verifyJwt(token ?? "", admin_id);
  if (!verified) return unauthorized(res);

  try {
    // Validasi fakultas dan jurusan
    if (!validateFakultasJurusan(req.body.fakultas, req.body.jurusan)) {
      return res.status(400).send({
        msg: "Fakultas atau jurusan tidak valid",
        error: "Invalid faculty or major",
      });
    }

    // Generate NIM berdasarkan fakultas dan jurusan
    const tahunMasuk = new Date().getFullYear();

    // Cari NIM terakhir untuk jurusan dan tahun yang sama
    const lastMhs = await prisma.mahasiswa.findFirst({
      where: {
        fakultas: req.body.fakultas,
        jurusan: req.body.jurusan,
        nim: {
          gte: parseInt(
            `${generateNIM(
              req.body.fakultas,
              req.body.jurusan,
              tahunMasuk,
              1
            ).slice(0, -3)}000`
          ),
        },
      },
      orderBy: { nim: "desc" },
    });

    let nomorUrutan = 1;
    if (lastMhs) {
      // Parse NIM terakhir untuk mendapatkan nomor urutan
      const lastNimStr = lastMhs.nim.toString().padStart(13, "0"); // Pastikan 13 digit
      const lastUrutan = parseInt(lastNimStr.slice(-3));
      nomorUrutan = lastUrutan + 1;
    }

    const generatedNIM = generateNIM(
      req.body.fakultas,
      req.body.jurusan,
      tahunMasuk,
      nomorUrutan
    );
    const nimNumber = parseInt(generatedNIM);

    const result = await prisma.mahasiswa.create({
      data: {
        nim: nimNumber,
        name: req.body.name,
        email: req.body.email,
        phone_number: req.body.phone_number,
        fakultas: req.body.fakultas,
        jurusan: req.body.jurusan,
        birth: req.body.birth,
        gender: req.body.gender,
        image: req.body.image,
        subdistrict: req.body.subdistrict,
        city: req.body.city,
        district: req.body.district,
        province: req.body.province,
      },
    });

    // Invalidate dashboard cache setelah data berubah
    await invalidateDashboardCache();

    return res.status(200).send({
      msg: "Succesfully",
      result: {
        ...result,
        generatedNIM: generatedNIM, // Tambahkan NIM yang di-generate untuk referensi
      },
    });
  } catch (error) {
    console.error("Error creating mahasiswa:", error);
    return res.status(500).send({ msg: "Internal Server Error", error });
  } finally {
    await prisma.$disconnect();
  }
}

// Konfigurasi multer untuk upload file
export const upload = multer({
  dest: "uploads/",
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Hanya izinkan file gambar
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Hanya file gambar yang diizinkan!"));
    }
  },
});

export async function uploadImage(req: Request, res: Response) {
  try {
    const file = (req as Request & { file?: Express.Multer.File }).file;

    if (!file) {
      return res.status(400).json({
        message: "No file uploaded!",
        msg: "Tidak ada file yang diupload",
      });
    }

    // Generate unique filename dengan timestamp
    const timestamp = Date.now();
    const fileExtension = path.extname(file.originalname);
    const fileName = file.originalname;

    // Path tujuan file
    const uploadPath = path.join(__dirname, "../../uploads", fileName);

    // Pindahkan file dari temp ke folder uploads
    fs.renameSync(file.path, uploadPath);

    // URL untuk mengakses file
    const fileUrl = `http://localhost:3000/uploads/${fileName}`;

    res.json({
      message: "Upload successfully!",
      msg: "File berhasil diupload",
      fileName: fileName,
      fileUrl: fileUrl,
      originalName: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
    });
  } catch (error: any) {
    console.error("Upload error:", error);
    res.status(500).json({
      error: "Failed to upload file",
      msg: "Gagal mengupload file",
      details: error.message,
    });
  }
}

export async function updateMhs(
  req: Request<{}, {}, UpdateMahasiswaBody>,
  res: Response
) {
  const token = req.headers.authorization as string | undefined;
  const admin_id = req.body.admin_id;
  const verified = verifyJwt(token ?? "", admin_id);
  if (!verified) return unauthorized(res);

  try {
    const result = await prisma.mahasiswa.update({
      where: { nim: Number(req.body.nim) },
      data: {
        name: req.body.name,
        city: req.body.city,
        email: req.body.email,
        phone_number: req.body.phone_number,
        fakultas: req.body.fakultas,
        jurusan: req.body.jurusan,
        birth: req.body.birth ? new Date(req.body.birth) : undefined,
        subdistrict: req.body.subdistrict,
        district: req.body.district,
        province: req.body.province,
        gender: req.body.gender,
        image: req.body.image,
      },
    });

    // Invalidate dashboard cache setelah data berubah
    await invalidateDashboardCache();

    return res.status(200).send({ msg: "Succesfully", result });
  } catch (error) {
    return res.status(500).send({ msg: "Internal Server Error", error });
  } finally {
    await prisma.$disconnect();
  }
}

export async function deleteMhs(req: Request, res: Response) {
  const token = req.headers.authorization as string | undefined;
  const admin_id = (req.body?.admin_id as number | undefined) ?? 0;
  const verified = verifyJwt(token ?? "", admin_id);
  if (!verified) return unauthorized(res);

  try {
    const nim = Number.parseInt(req.params.nim, 10);
    const result = await prisma.mahasiswa.delete({ where: { nim } });

    // Invalidate dashboard cache setelah data berubah
    await invalidateDashboardCache();

    return res.status(200).send({ msg: "Succesfully", result });
  } catch (error) {
    return res.status(500).send({ msg: "Internal Server Error", error });
  } finally {
    await prisma.$disconnect();
  }
}

export async function searchMhs(req: Request, res: Response) {
  const token = req.headers.authorization as string | undefined;
  const admin_id = (req.body?.admin_id as number | undefined) ?? 0;
  const verified = verifyJwt(token ?? "", admin_id);
  if (!verified) return unauthorized(res);

  const keyword = (req.query.key as string) || "";

  if (!keyword) {
    return res.status(400).json({ msg: "Query parameter q is required" });
  }

  const nimNumber = Number(keyword);

  try {
    const result = await prisma.mahasiswa.findMany({
      where: {
        OR: [
          { nim: isNaN(nimNumber) ? undefined : nimNumber },
          { name: { contains: keyword, mode: "insensitive" } },
          { email: { contains: keyword, mode: "insensitive" } },
        ],
      },
      select: {
        nim: true,
        name: true,
        email: true,
      },
    });

    if (result.length === 0) {
      return res.status(404).json({ msg: "Data not found" });
    } else {
      return res.status(200).json({ msg: "Success", result });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ msg: "Internal Server Error", error });
  } finally {
    await prisma.$disconnect();
  }
}

export async function dashboardMhs(req: Request, res: Response) {
  try {
    // Cek cache terlebih dahulu
    const cachedData = await redisService.getJSON(CACHE_KEYS.DASHBOARD_DATA);
    if (cachedData) {
      console.log("Dashboard data served from cache");
      return res.status(200).json({
        msg: "Success",
        result: cachedData,
        cached: true,
      });
    }

    console.log("Dashboard data not found in cache, fetching from database");

    // Jika tidak ada di cache, ambil data dari database
    const totalMhs = await prisma.mahasiswa.count();
    const countFakultas = await prisma.mahasiswa.groupBy({
      by: ["fakultas"],
      _count: { fakultas: true },
    });

    const countJurusan = await prisma.mahasiswa.groupBy({
      by: ["jurusan"],
      _count: { jurusan: true },
    });

    const countCity = await prisma.mahasiswa.groupBy({
      by: ["city"],
      _count: { city: true },
    });

    const countCityMhs = await prisma.mahasiswa.groupBy({
      by: ["city"],
      _count: { city: true },
    });

    const allMahasiswa = await prisma.mahasiswa.findMany({
      select: { birth: true },
    });

    const now = dayjs();
    const ageList = allMahasiswa.map((m) => now.diff(dayjs(m.birth), "year"));

    const totalFakultas = countFakultas.length;
    const totalJurusan = countJurusan.length;
    const totalCity = countCityMhs.length;
    const averageAge = parseFloat(
      (ageList.reduce((a, b) => a + b, 0) / ageList.length).toFixed(1)
    );

    const unformatedTop5Fakultas = countFakultas.sort(
      (a, b) => b._count.fakultas - a._count.fakultas
    );

    const countFakultasMhs = unformatedTop5Fakultas.map((f) => ({
      fakultas: f.fakultas,
      jumlah: f._count.fakultas,
    }));

    const unformatedTop5Jurusan = countJurusan
      .sort((a, b) => b._count.jurusan - a._count.jurusan)
      .slice(0, 5);

    const top5Jurusan = unformatedTop5Jurusan.map((f) => ({
      jurusan: f.jurusan,
      jumlah: f._count.jurusan,
    }));

    const unformatedTop5City = countCity
      .sort((a, b) => b._count.city - a._count.city)
      .slice(0, 5);

    const top5city = unformatedTop5City.map((c) => ({
      city: c.city,
      count: c._count.city,
    }));

    const genderCounts = await prisma.mahasiswa.groupBy({
      by: ["gender"],
      _count: { gender: true },
    });

    const totalGender = genderCounts.reduce(
      (acc, cur) => acc + cur._count.gender,
      0
    );

    const summaryGender = genderCounts.map((g) => ({
      gender: g.gender === "L" ? "L" : "P",
      jumlah: g._count.gender,
      persen: parseFloat(((g._count.gender / totalGender) * 100).toFixed(1)), // bulatkan 1 angka desimal
    }));

    const dashboardData = {
      card: {
        totalMhs,
        totalFakultas,
        totalJurusan,
        totalCity,
        averageAge,
      },
      top5Jurusan,
      countFakultasMhs,
      summaryGender,
      top5city,
    };

    // Simpan data ke cache
    await redisService.setJSON(
      CACHE_KEYS.DASHBOARD_DATA,
      dashboardData,
      CACHE_TTL.DASHBOARD_DATA
    );
    console.log("Dashboard data cached successfully");

    return res.status(200).json({
      msg: "Success",
      result: dashboardData,
      cached: false,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ msg: "Internal Server Error", error });
  } finally {
    await prisma.$disconnect();
  }
}

// Fungsi untuk membersihkan cache dashboard (untuk testing atau maintenance)
export async function clearDashboardCache(req: Request, res: Response) {
  try {
    await invalidateDashboardCache();
    return res.status(200).json({
      msg: "Dashboard cache cleared successfully",
      success: true,
    });
  } catch (error) {
    console.error("Error clearing dashboard cache:", error);
    return res.status(500).json({
      msg: "Failed to clear dashboard cache",
      error: error,
    });
  }
}

// Endpoint untuk mendapatkan daftar fakultas dan jurusan
export async function getFakultasJurusan(req: Request, res: Response) {
  try {
    const fakultas = getAllFakultas();
    const fakultasJurusan = fakultas.map((fakultasName) => ({
      nama: fakultasName,
      prodi: getJurusanByFakultas(fakultasName),
    }));

    return res.status(200).json({
      msg: "Success",
      result: fakultasJurusan,
    });
  } catch (error) {
    console.error("Error getting fakultas jurusan:", error);
    return res.status(500).json({ msg: "Internal Server Error", error });
  }
}

export async function getJurusanByFakultasEndpoint(
  req: Request,
  res: Response
) {
  try {
    const { fakultas } = req.params;

    if (!fakultas) {
      return res.status(400).json({ msg: "Fakultas parameter is required" });
    }

    const jurusan = getJurusanByFakultas(fakultas);

    if (jurusan.length === 0) {
      return res.status(404).json({ msg: "Fakultas tidak ditemukan" });
    }

    return res.status(200).json({
      msg: "Success",
      result: {
        fakultas,
        jurusan,
      },
    });
  } catch (error) {
    console.error("Error getting jurusan by fakultas:", error);
    return res.status(500).json({ msg: "Internal Server Error", error });
  }
}

export default {
  getAll,
  getMhs,
  createMhs,
  updateMhs,
  deleteMhs,
  uploadImage,
  searchMhs,
  filterMhs,
  dashboardMhs,
  clearDashboardCache,
};
