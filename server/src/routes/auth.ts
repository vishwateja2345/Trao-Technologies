import { Router } from "express";
import { z } from "zod";
import { User, hashPassword } from "../models/User.js";
import { issueSessionCookie, clearSessionCookie, requireAuth } from "../middleware/auth.js";
import { asyncHandler, ApiError } from "../middleware/errors.js";

export const authRouter = Router();

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters."),
  name: z.string().trim().max(100).optional(),
});

authRouter.post(
  "/register",
  asyncHandler(async (req, res) => {
    const parsed = credentialsSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, "INVALID_INPUT", "Invalid registration input.", parsed.error.flatten());
    }
    const { email, password, name } = parsed.data;

    const existing = await User.findOne({ email });
    if (existing) {
      throw new ApiError(409, "EMAIL_TAKEN", "An account with this email already exists.");
    }

    const passwordHash = await hashPassword(password);
    const user = await User.create({ email, passwordHash, name: name ?? "" });
    issueSessionCookie(res, { userId: user._id.toString(), email: user.email });
    res.status(201).json({ user: { id: user._id, email: user.email, name: user.name } });
  })
);

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const parsed = credentialsSchema.omit({ name: true }).safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, "INVALID_INPUT", "Invalid login input.", parsed.error.flatten());
    }
    const { email, password } = parsed.data;

    const user = await User.findOne({ email });
    if (!user) throw new ApiError(401, "INVALID_CREDENTIALS", "Incorrect email or password.");

    const ok = await user.comparePassword(password);
    if (!ok) throw new ApiError(401, "INVALID_CREDENTIALS", "Incorrect email or password.");

    issueSessionCookie(res, { userId: user._id.toString(), email: user.email });
    res.json({ user: { id: user._id, email: user.email, name: user.name } });
  })
);

authRouter.post("/logout", (_req, res) => {
  clearSessionCookie(res);
  res.status(204).end();
});

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user!.userId).select("email name");
    if (!user) throw new ApiError(401, "SESSION_EXPIRED", "Session refers to a user that no longer exists.");
    res.json({ user: { id: user._id, email: user.email, name: user.name } });
  })
);
