import { Session } from "../models";
import { SessionsRepositoryInterface } from "./storage";
import Datastore from "nedb";

export class NeDBSessionRepository implements SessionsRepositoryInterface {
  private db: Datastore;

  constructor(dbName: string) {
    this.db = new Datastore({ filename: dbName, autoload: true });
  }

  async findSessionByUserId(userId: number): Promise<Session | null> {
    return new Promise((resolve, reject) => {
      this.db.findOne({ "user.id": userId }, (err, doc) => {
        if (err) {
          console.error("Error occurred while finding session:", err);
          return reject(err);
        }

        if (!doc) {
          console.log("No session found for userId:", userId);
          return resolve(null);
        }

        resolve(doc as Session);
      });
    });
  }

  async saveSession(session: Session): Promise<Session> {
    return new Promise((resolve, reject) => {
      this.db.update(
        { "user.id": session.user.id },
        session,
        { upsert: true },
        (err) => {
          if (err) {
            reject(err);
          }
          resolve(session);
        },
      );
    });
  }
}
