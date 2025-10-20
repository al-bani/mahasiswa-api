import { createClient, RedisClientType } from "redis";
import "dotenv/config";

class RedisService {
  private client: RedisClientType;
  private isConnected: boolean = false;

  constructor() {
    this.client = createClient({
      url: process.env.REDIS_URL || "redis://localhost:6379",
      socket: {
        connectTimeout: 10000,
      },
    });

    this.client.on("error", (err) => {
      console.error("Redis Client Error:", err);
      this.isConnected = false;
    });

    this.client.on("connect", () => {
      console.log("Redis Client Connected");
      this.isConnected = true;
    });

    this.client.on("disconnect", () => {
      console.log("Redis Client Disconnected");
      this.isConnected = false;
    });
  }

  async connect(): Promise<void> {
    if (!this.isConnected) {
      try {
        await this.client.connect();
      } catch (error) {
        console.error("Failed to connect to Redis:", error);
        throw error;
      }
    }
  }

  async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.client.disconnect();
    }
  }

  async get(key: string): Promise<string | null> {
    try {
      if (!this.isConnected) {
        await this.connect();
      }
      return await this.client.get(key);
    } catch (error) {
      console.error("Redis GET error:", error);
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      if (ttlSeconds) {
        await this.client.setEx(key, ttlSeconds, value);
      } else {
        await this.client.set(key, value);
      }
      return true;
    } catch (error) {
      console.error("Redis SET error:", error);
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    try {
      if (!this.isConnected) {
        await this.connect();
      }
      await this.client.del(key);
      return true;
    } catch (error) {
      console.error("Redis DEL error:", error);
      return false;
    }
  }

  async delPattern(pattern: string): Promise<boolean> {
    try {
      if (!this.isConnected) {
        await this.connect();
      }
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
      }
      return true;
    } catch (error) {
      console.error("Redis DEL pattern error:", error);
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      if (!this.isConnected) {
        await this.connect();
      }
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      console.error("Redis EXISTS error:", error);
      return false;
    }
  }

  // Helper method untuk JSON data
  async getJSON<T>(key: string): Promise<T | null> {
    try {
      const data = await this.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error("Redis GET JSON error:", error);
      return null;
    }
  }

  async setJSON(
    key: string,
    value: any,
    ttlSeconds?: number
  ): Promise<boolean> {
    try {
      const jsonString = JSON.stringify(value);
      return await this.set(key, jsonString, ttlSeconds);
    } catch (error) {
      console.error("Redis SET JSON error:", error);
      return false;
    }
  }
}

// Export singleton instance
export const redisService = new RedisService();

// Cache keys constants
export const CACHE_KEYS = {
  DASHBOARD_DATA: "dashboard:mahasiswa:data",
  DASHBOARD_TOTAL_MHS: "dashboard:mahasiswa:total",
  DASHBOARD_FAKULTAS: "dashboard:mahasiswa:fakultas",
  DASHBOARD_JURUSAN: "dashboard:mahasiswa:jurusan",
  DASHBOARD_CITY: "dashboard:mahasiswa:city",
  DASHBOARD_GENDER: "dashboard:mahasiswa:gender",
  DASHBOARD_AGE: "dashboard:mahasiswa:age",
} as const;

// Cache TTL (Time To Live) dalam detik
export const CACHE_TTL = {
  DASHBOARD_DATA: 300, // 5 menit
  STATS_DATA: 600, // 10 menit
} as const;
