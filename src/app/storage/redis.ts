import * as dotenv from "dotenv";
import { createClient } from "redis";
import { Session } from "../models";

dotenv.config();

export interface SessionsRepositoryInterface {
  findSessionByUserId(userId: number): Promise<Session | null>;
  saveSession(session: Session): Promise<Session>;
}

export class RedisSessionRepository implements SessionsRepositoryInterface {
  private client;

  constructor() {
    this.client = createClient({
      url: process.env.REDIS_URL || "redis://localhost:6379",
    });

    this.client.on("error", (err) => console.error("Redis Client Error", err));

    this.client.connect();
  }

  async findSessionByUserId(userId: number): Promise<Session | null> {
    try {
      const sessionData = await this.client.get(`session:${userId}`);
      if (!sessionData) {
        console.log("No session found for userId:", userId);
        return null;
      }
      return JSON.parse(sessionData) as Session;
    } catch (err) {
      console.error("Error occurred while finding session:", err);
      throw err;
    }
  }

  async saveSession(session: Session): Promise<Session> {
    try {
      await this.client.set(
        `session:${session.user.id}`,
        JSON.stringify(session),
      );
      return session;
    } catch (err) {
      console.error("Error occurred while saving session:", err);
      throw err;
    }
  }
}
