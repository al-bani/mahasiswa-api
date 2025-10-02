// src/routes.ts
import { Router, Request, Response, NextFunction } from "express";
import * as Admin from "./controller/admin";
import * as Mhs from "./controller/mahasiswa";
import { upload } from "./controller/mahasiswa"; // middleware multer

const router = Router();
const mhsRouter = Router();
const adminRouter = Router();

// --- Mahasiswa ---
mhsRouter.post("/filter", Mhs.filterMhs);
mhsRouter.get("/search", Mhs.searchMhs);
mhsRouter.post("/all", Mhs.getAll);

mhsRouter.get("/:nim", Mhs.getMhs);
mhsRouter.post("/create", Mhs.createMhs);

mhsRouter.put(
  "/update/:nim",
  (req: Request, res: Response, next: NextFunction) => {
    if (!req.body?.nim && req.params?.nim) {
      req.body.nim = Number(req.params.nim);
    }
    return Mhs.updateMhs(req, res);
  }
);

mhsRouter.delete("/delete/:nim", Mhs.deleteMhs);

mhsRouter.post("/upload/image", upload.single("image"), Mhs.uploadImage);

// --- Admin ---
adminRouter.post("/register", Admin.register);
adminRouter.get("/register/:email/otp", Admin.sendOTP);
adminRouter.post("/register/:email/verify", Admin.verification);
adminRouter.get("/register/:email/reset", Admin.resetOTP);
adminRouter.post("/login", Admin.login);
adminRouter.get("/logout", Admin.logout);

// Mounting
router.use("/mahasiswa", mhsRouter);
router.use("/admin", adminRouter);

export default router;
