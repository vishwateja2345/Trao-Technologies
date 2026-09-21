import mongoose, { Schema, type HydratedDocument, type Model } from "mongoose";
import bcrypt from "bcryptjs";

export interface UserFields {
  email: string;
  passwordHash: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserMethods {
  comparePassword(candidate: string): Promise<boolean>;
}

export type UserDoc = HydratedDocument<UserFields, UserMethods>;

const userSchema = new Schema<UserFields, Model<UserFields, {}, UserMethods>, UserMethods>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    name: { type: String, default: "" },
  },
  { timestamps: true }
);

userSchema.methods.comparePassword = function comparePassword(this: UserDoc, candidate: string) {
  return bcrypt.compare(candidate, this.passwordHash);
};

export const User = mongoose.model<UserFields, Model<UserFields, {}, UserMethods>>("User", userSchema);

export async function hashPassword(plain: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plain, salt);
}
