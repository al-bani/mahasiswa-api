// src/controllers/mahasiswa.ts
import jwt from "jsonwebtoken"; // dipakai tak langsung, boleh dihapus kalau tak perlu
import "dotenv/config";
import { Prisma, PrismaClient } from "@prisma/client";
import { verifyJwt } from "./admin"; // tetap boleh, tidak circular selama admin tidak import mahasiswa
import multer from "multer";
import path from "path";
import fs from "fs";
import { Request, Response } from "express";

const prisma = new PrismaClient();

let nextCursorPage: number | null = null;
// State cursor sederhana (pakai DB/param sebenarnya lebih baik)
let paginationValue: number = 30;
// Value must be even

// ---- Tipe request bodies ----
type AdminAuthed = { admin_id: number };
type CreateMahasiswaBody = AdminAuthed & {
  name: string;
  asal?: string;
  email?: string;
  phone_number?: string;
  fakultas?: string;
  jurusan?: string;
  date_of_birth: string; // ISO string
  gender?: string;
  image?: string;
};
type UpdateMahasiswaBody = AdminAuthed & {
  nim: number;
  name?: string;
  asal?: string;
  email?: string;
  phone_number?: string;
  fakultas?: string;
  jurusan?: string;
  date_of_birth?: string;
  gender?: string;
  image?: string;
};

// ---- Helpers ----
function unauthorized(res: Response) {
  return res.status(400).send({ msg: "Unauthorized" });
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
    console.log(error);
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

  const where = {};

  console.log(req.body.where.jurusan);

  try {
    console.log(req.body.where);
    const result = await prisma.mahasiswa.findMany({
      where: {
        jurusan: {
          in: [],
        },
        asal: "Bandung",
      },
      orderBy: req.body.orderBy,
      select: {
        nim: true,
        name: true,
        jurusan: true,
        asal: true,
        fakultas: true,
      },
    });

    console.log(result);

    return res.status(200).send({
      msg: "Successfully",
      result,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).send({ msg: "Internal Server Error", error });
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
    const last = await prisma.mahasiswa.findFirst({ orderBy: { nim: "desc" } });
    const nextNim = ((last?.nim ?? 0) + 1) | 0;

    const result = await prisma.mahasiswa.create({
      data: {
        nim: nextNim,
        name: req.body.name,
        asal: req.body.asal!,
        email: req.body.email!,
        phone_number: req.body.phone_number!,
        fakultas: req.body.fakultas!,
        jurusan: req.body.jurusan!,
        date_of_birth: new Date(req.body.date_of_birth),
        gender: req.body.gender!,
        image: req.body.image!,
      },
    });

    console.log("Mahasiswa created successfully :", nextNim);
    return res.status(201).send({ msg: "Succesfully", result });
  } catch (error) {
    console.log(error);
    return res.status(500).send({ msg: "Internal Server Error", error });
  } finally {
    await prisma.$disconnect();
  }
}

// ------- Upload (multer) -------
const uploadDir = path.join(__dirname, "...", "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) =>
    cb(null, `${Date.now()}${path.extname(file.originalname)}`),
});
export const upload = multer({ storage });

export async function uploadImage(req: Request, res: Response) {
  // req.file ada dari multer; di TS kita akses aman dengan cast
  const file = (req as Request & { file?: Express.Multer.File }).file;
  if (!file) return res.status(400).json({ message: "No file uploaded!" });

  try {
    const publicPath = `../uploads/${file.filename}`;
    return res
      .status(200)
      .json({ message: "File uploaded successfully!", filePath: publicPath });
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error", error });
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
        asal: req.body.asal,
        email: req.body.email,
        phone_number: req.body.phone_number,
        fakultas: req.body.fakultas,
        jurusan: req.body.jurusan,
        date_of_birth: req.body.date_of_birth
          ? new Date(req.body.date_of_birth)
          : undefined,
        gender: req.body.gender,
        image: req.body.image,
      },
    });
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

export default {
  getAll,
  getMhs,
  createMhs,
  updateMhs,
  deleteMhs,
  uploadImage,
  searchMhs,
  filterMhs,
};
