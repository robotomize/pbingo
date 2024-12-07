import * as dotenv from "dotenv";
import { Session } from "../models";

export interface SessionsRepositoryInterface {
  findSessionByUserId(userId: number): Promise<Session | null>;
  saveSession(session: Session): Promise<Session>;
}
