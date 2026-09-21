import mongoose from "mongoose";
import { env } from "./env.js";

let connecting: Promise<typeof mongoose> | null = null;

export async function connectDB(): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1) return mongoose;
  if (!connecting) {
    connecting = mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 8000,
    });
  }
  await connecting;
  return mongoose;
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
  connecting = null;
}
