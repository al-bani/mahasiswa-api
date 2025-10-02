// src/controllers/admin.ts
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import nodemailer from "nodemailer";
import path from "path";
import ejs from "ejs";
import { Request, Response } from "express";

const prisma = new PrismaClient();
const blacklistedTokens = new Set<string>();
const otpStorage = new Map<string, { otp: string; expiryTime: number }>();

type RegisterBody = { email: string; username: string; password: string };
type LoginBody = { username: string; password: string };

export async function register(
  req: Request<{}, {}, RegisterBody>,
  res: Response
) {
  if (!req.body.email || !req.body.username) {
    return res.status(500).send({ msg: "Internal Server Error" });
  }

  try {
    const isEmailExists = await prisma.admin.findFirst({
      where: { email: req.body.email },
    });
    if (isEmailExists)
      return res.status(400).send({ msg: "Email already registered" });

    const isUsernameTaken = await prisma.admin.findFirst({
      where: { username: req.body.username },
    });
    if (isUsernameTaken)
      return res.status(400).send({ msg: "username has been taken" });

    const passwordHash = bcrypt.hashSync(req.body.password, 10);
    const result = await prisma.admin.create({
      data: {
        email: req.body.email,
        username: req.body.username,
        password: passwordHash,
      },
    });
    return res.status(200).send({ msg: "Registration Success", result });
  } catch (error) {
    return res.status(500).send({ msg: "Internal Server Error", error });
  } finally {
    await prisma.$disconnect();
  }
}

export async function sendOTP(req: Request, res: Response) {
  const email = req.params.email;
  const emailSender = process.env.GOOGLE_MAIL;
  const emailPassword = process.env.GOOGLE_PASSWORD;

  try {
    const isAdminActive = await prisma.admin.findFirst({
      where: { email },
      select: { status: true },
    });
    if (isAdminActive && isAdminActive.status === 1) {
      return res.status(400).send({ msg: "Unauthorized" });
    }

    const otp = otpGenerator(email);

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: { user: emailSender, pass: emailPassword },
    });

    const templatePath = path.join(__dirname, "..", "utils", "otp.ejs");
    const htmlTemplate = fs.readFileSync(templatePath, "utf-8");
    const htmlContent = ejs.render(htmlTemplate, { codeOTP: otp });

    const mailConfigurations = {
      from: emailSender,
      to: email,
      subject: "Verification Code Register",
      html: htmlContent,
    };

    transporter.sendMail(mailConfigurations, function (error, info) {
      if (error)
        return res.status(400).send({ msg: "Error input email", info });
      return res.status(200).send({ msg: "Email sent succesfully", info });
    });
  } catch (error) {
    console.log(error);
    return res.status(500).send({ msg: "Internal Server Error", error });
  } finally {
    await prisma.$disconnect();
  }
}

export function resetOTP(req: Request, res: Response) {
  const email = req.params.email;
  const ok = otpStorage.delete(email);
  return res.status(200).send({
    status: ok,
    message: ok ? "reset successfully" : "reset failed",
  });
}

export async function verification(req: Request, res: Response) {
  const email = req.params.email;
  const inputOTP = String(req.body.otp ?? "");

  const otpData = otpStorage.get(email);
  if (!otpData)
    return res.status(400).send({ valid: false, message: "OTP not found" });

  if (Date.now() > otpData.expiryTime) {
    otpStorage.delete(email);
    return res
      .status(400)
      .send({ valid: false, message: "OTP has been Expired" });
  }

  if (inputOTP.trim() === String(otpData.otp).trim()) {
    try {
      await prisma.admin.update({ where: { email }, data: { status: 1 } });
      otpStorage.delete(email);
      return res.status(200).send({ valid: true, message: "OTP valid" });
    } catch (error) {
      console.log(error);
      return res
        .status(500)
        .send({ valid: false, message: "internal Server Error" });
    } finally {
      await prisma.$disconnect();
    }
  } else {
    return res.status(400).send({ valid: false, message: "OTP not valid" });
  }
}

export async function login(req: Request<{}, {}, LoginBody>, res: Response) {
  try {
    const result = await prisma.admin.findFirst({
      where: { username: req.body.username },
    });
    if (!result)
      return res.status(400).send({ msg: "Wrong username or password" });

    const isPasswordMatched = bcrypt.compareSync(
      req.body.password,
      result.password
    );
    if (!isPasswordMatched)
      return res.status(400).send({ msg: "Wrong username or password" });

    const token = signJwt(result.username);
    (result as any).token = token;

    return res.status(200).send({ msg: "Login Success", result });
  } catch (error) {
    return res.status(500).send({ msg: "Internal Server Error", error });
  } finally {
    await prisma.$disconnect();
  }
}

export function logout(req: Request, res: Response) {
  let token = (req.headers.authorization as string | undefined) ?? "";
  const admin_id = Number(req.body?.admin_id ?? 0);

  const resultVerify = verifyJwt(token, admin_id);
  if (!resultVerify) return res.status(400).send({ msg: "Unauthorized" });

  token = resultVerify; // gunakan token hasil refresh kalau expired
  if (blacklistToken(token)) {
    return res
      .status(200)
      .send({ msg: "logout successfully", blacklistedTokens: token });
  }
  return res.status(500).send({ msg: "Internal Server Error" });
}

// --------- JWT helpers ----------
export function signJwt(signature: string): string {
  const timeExpiredToken = "7d";
  const privateKey = fs.readFileSync("key/private.key");
  return jwt.sign({ signValue: signature }, privateKey, {
    algorithm: "RS256",
    expiresIn: timeExpiredToken,
  });
}

/**
 * Verifies token. If expired, returns a **new token** string.
 * If invalid/blacklisted, returns null.
 */
export function verifyJwt(
  token: string,
  signature: string | number
): string | null {
  const publicKey = fs.readFileSync("key/public.key", "utf8");
  try {
    jwt.verify(token, publicKey);
    if (blacklistedTokens.has(token)) return null;
    return token;
  } catch (error: any) {
    if (error?.name === "TokenExpiredError") {
      const newToken = signJwt(String(signature));
      return newToken;
    }
    return null;
  }
}

function blacklistToken(token: string): boolean {
  blacklistedTokens.add(token);
  return blacklistedTokens.has(token);
}

function otpGenerator(email: string): string {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiryTime = Date.now() + 10 * 60 * 1000;
  otpStorage.set(email, { otp, expiryTime });
  return otp;
}

export default {
  register,
  login,
  logout,
  verifyJwt,
  signJwt,
  sendOTP,
  verification,
  resetOTP,
};
