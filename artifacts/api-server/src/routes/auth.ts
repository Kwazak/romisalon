import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import {
  GetCurrentUserResponse,
  LoginBody,
  LoginResponse,
  RegisterMemberBody,
  RegisterMemberResponse,
} from "@workspace/api-zod";
import { db, membershipLevels, memberProfiles, salonUsers } from "@workspace/db";
import { clearSalonSession, getSalonIdentity, requireSalonUser, setSalonSession } from "../middlewares/salon-auth";

const router: IRouter = Router();
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const maxAttempts = 8;
const windowMs = 15 * 60 * 1000;

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const current = loginAttempts.get(key);
  if (!current || current.resetAt <= now) {
    loginAttempts.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  current.count += 1;
  return current.count > maxAttempts;
}

function resetAttempts(key: string): void {
  loginAttempts.delete(key);
}

router.get("/auth/me", requireSalonUser, (req, res): void => {
  const user = getSalonIdentity(res);
  res.json(GetCurrentUserResponse.parse(user));
});

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterMemberBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Periksa kembali data pendaftaran." });
    return;
  }
  const email = parsed.data.email.trim().toLowerCase();
  const [existing] = await db.select({ id: salonUsers.id }).from(salonUsers).where(eq(salonUsers.email, email)).limit(1);
  if (existing) {
    res.status(409).json({ error: "Email sudah terdaftar." });
    return;
  }
  const [starterLevel] = await db.select().from(membershipLevels).orderBy(membershipLevels.sortOrder).limit(1);
  if (!starterLevel) {
    res.status(503).json({ error: "Membership belum siap. Coba beberapa saat lagi." });
    return;
  }
  const id = crypto.randomUUID();
  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const [user] = await db
    .insert(salonUsers)
    .values({
      id,
      name: parsed.data.name.trim(),
      email,
      phone: parsed.data.phone.trim(),
      passwordHash,
      role: "MEMBER",
      isActive: true,
    })
    .returning({
      id: salonUsers.id,
      name: salonUsers.name,
      email: salonUsers.email,
      phone: salonUsers.phone,
      role: salonUsers.role,
      isActive: salonUsers.isActive,
    });
  await db.insert(memberProfiles).values({ userId: id, totalSpending: 0, points: 0, levelId: starterLevel.id });
  setSalonSession(res, id);
  res.status(201).json(RegisterMemberResponse.parse(user));
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const key = req.ip ?? "unknown";
  if (isRateLimited(key)) {
    res.status(429).json({ error: "Terlalu banyak percobaan. Silakan coba lagi dalam 15 menit." });
    return;
  }
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Email atau kata sandi belum valid." });
    return;
  }
  const email = parsed.data.email.trim().toLowerCase();
  const [user] = await db.select().from(salonUsers).where(eq(salonUsers.email, email)).limit(1);
  if (!user || !user.isActive || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
    res.status(401).json({ error: "Email atau kata sandi tidak sesuai." });
    return;
  }
  resetAttempts(key);
  setSalonSession(res, user.id);
  const sessionUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    isActive: user.isActive,
  };
  res.json(LoginResponse.parse(sessionUser));
});

router.post("/auth/logout", (_req, res): void => {
  clearSalonSession(res);
  res.sendStatus(204);
});

export default router;
