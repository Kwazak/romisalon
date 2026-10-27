import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { and, eq } from "drizzle-orm";
import { db, salonUsers } from "@workspace/db";

const sessionCookie = "romi_session";
const maxAgeSeconds = 60 * 60 * 24 * 7;
const sessionSecret = process.env.SESSION_SECRET ?? "";

if (!sessionSecret) {
  throw new Error("SESSION_SECRET must be configured before the salon API starts.");
}

export type SalonIdentity = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  isActive: boolean;
};

function sign(value: string): string {
  return createHmac("sha256", sessionSecret).update(value).digest("base64url");
}

function createToken(userId: string): string {
  const payload = `${userId}.${Math.floor(Date.now() / 1000) + maxAgeSeconds}`;
  return `${payload}.${sign(payload)}`;
}

function verifyToken(token: unknown): string | null {
  if (typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, expiresAt, signature] = parts;
  if (!userId || !expiresAt || !signature || !/^\d+$/.test(expiresAt)) return null;
  const payload = `${userId}.${expiresAt}`;
  const expected = Buffer.from(sign(payload));
  const supplied = Buffer.from(signature);
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;
  if (Number(expiresAt) <= Math.floor(Date.now() / 1000)) return null;
  return userId;
}

export function setSalonSession(res: Response, userId: string): void {
  res.cookie(sessionCookie, createToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds * 1000,
  });
}

export function clearSalonSession(res: Response): void {
  res.clearCookie(sessionCookie, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

export async function requireSalonUser(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const userId = verifyToken(req.cookies?.[sessionCookie]);
  if (!userId) {
    res.status(401).json({ error: "Silakan masuk untuk melanjutkan." });
    return;
  }
  const [user] = await db
    .select({
      id: salonUsers.id,
      name: salonUsers.name,
      email: salonUsers.email,
      phone: salonUsers.phone,
      role: salonUsers.role,
      isActive: salonUsers.isActive,
    })
    .from(salonUsers)
    .where(and(eq(salonUsers.id, userId), eq(salonUsers.isActive, true)))
    .limit(1);
  if (!user) {
    clearSalonSession(res);
    res.status(401).json({ error: "Akun tidak aktif atau sesi telah berakhir." });
    return;
  }
  res.locals.salonUser = user satisfies SalonIdentity;
  next();
}

export function requireSalonAdmin(
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  const user = res.locals.salonUser as SalonIdentity | undefined;
  if (user?.role !== "ADMIN") {
    res.status(403).json({ error: "Akses khusus admin." });
    return;
  }
  next();
}

export function getSalonIdentity(res: Response): SalonIdentity {
  return res.locals.salonUser as SalonIdentity;
}
