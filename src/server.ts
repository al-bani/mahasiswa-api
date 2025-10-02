// src/server.ts
import express, { Request, Response, NextFunction } from "express";
import bodyParser from "body-parser";
import cors from "cors";
import router from "./routes";
import { PrismaClient } from "@prisma/client";

async function serverConnection() {
  const prisma = new PrismaClient();
  const port = 3000;
  const app = express();

  try {
    app.use(express.json());
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: true }));
    app.use(cors());
    app.use("/api", router);

    // Error handler harus 4 argumen: (err, req, res, next)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const statusCode = err?.statusCode ?? 500;
      const message = err?.message ?? "Internal Server Error";
      res.status(statusCode).json({ message });
    });

    await prisma.$connect();
    console.log("Connected to database");

    app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
      console.log("Listening...");
    });
  } catch (error) {
    console.error("Failed connecting to database:", error);
  }
}

serverConnection();
export {};
