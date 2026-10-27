import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import {
  GetMemberDashboardResponse,
  UpdateMemberPasswordBody,
  UpdateMemberPasswordResponse,
  UpdateMemberProfileBody,
  UpdateMemberProfileResponse,
} from "@workspace/api-zod";
import {
  db,
  membershipLevels,
  memberProfiles,
  salonBookings,
  salonNotifications,
  salonServices,
  salonTransactions,
  salonUsers,
} from "@workspace/db";
import { getSalonIdentity, requireSalonUser } from "../middlewares/salon-auth";

const router: IRouter = Router();

router.get("/member/dashboard", requireSalonUser, async (_req, res): Promise<void> => {
  const user = getSalonIdentity(res);
  const [profile] = await db.select().from(memberProfiles).where(eq(memberProfiles.userId, user.id)).limit(1);
  if (!profile) {
    res.status(404).json({ error: "Profil member tidak ditemukan." });
    return;
  }
  const [level] = await db.select().from(membershipLevels).where(eq(membershipLevels.id, profile.levelId)).limit(1);
  const levels = await db.select().from(membershipLevels).orderBy(asc(membershipLevels.sortOrder));
  if (!level) {
    res.status(409).json({ error: "Level membership belum tersedia." });
    return;
  }
  const [bookings, transactions, notifications] = await Promise.all([
    db
      .select({ booking: salonBookings, serviceName: salonServices.name, transaction: salonTransactions })
      .from(salonBookings)
      .innerJoin(salonServices, eq(salonBookings.serviceId, salonServices.id))
      .leftJoin(salonTransactions, eq(salonTransactions.bookingId, salonBookings.id))
      .where(eq(salonBookings.userId, user.id))
      .orderBy(desc(salonBookings.startTime))
      .limit(20),
    db
      .select({ transaction: salonTransactions, serviceName: salonServices.name })
      .from(salonTransactions)
      .innerJoin(salonBookings, eq(salonTransactions.bookingId, salonBookings.id))
      .innerJoin(salonServices, eq(salonBookings.serviceId, salonServices.id))
      .where(eq(salonTransactions.userId, user.id))
      .orderBy(desc(salonTransactions.createdAt))
      .limit(20),
    db
      .select({ message: salonNotifications.message })
      .from(salonNotifications)
      .where(and(eq(salonNotifications.userId, user.id), isNull(salonNotifications.readAt)))
      .orderBy(desc(salonNotifications.createdAt))
      .limit(8),
  ]);
  const nextLevel = levels.find((candidate) => candidate.sortOrder > level.sortOrder) ?? null;
  const shapedBookings = bookings.map(({ booking, serviceName, transaction }) => ({
    id: booking.id,
    userId: booking.userId,
    memberName: user.name,
    serviceId: booking.serviceId,
    serviceName,
    startTime: booking.startTime.toISOString(),
    endTime: booking.endTime.toISOString(),
    status: booking.status,
    paymentStatus: transaction?.status ?? "PENDING",
    amount: transaction?.amount ?? 0,
    discountAmount: transaction?.discountAmount ?? 0,
    finalAmount: transaction?.finalAmount ?? 0,
    bookingCode: booking.bookingCode,
  }));
  const shapedTransactions = transactions.map(({ transaction, serviceName }) => ({
    id: transaction.id,
    bookingId: transaction.bookingId,
    memberName: user.name,
    serviceName,
    amount: transaction.amount,
    discountAmount: transaction.discountAmount,
    finalAmount: transaction.finalAmount,
    status: transaction.status,
    createdAt: transaction.createdAt.toISOString(),
  }));
  const payload = {
    user,
    level,
    nextLevel,
    totalSpending: profile.totalSpending,
    points: profile.points,
    pointsToNextLevel: nextLevel ? Math.max(0, nextLevel.minSpending - profile.totalSpending) : 0,
    bookings: shapedBookings,
    transactions: shapedTransactions,
    notifications: notifications.map((item) => item.message),
  };
  res.json(GetMemberDashboardResponse.parse(payload));
});

router.patch("/member/profile", requireSalonUser, async (req, res): Promise<void> => {
  const parsed = UpdateMemberProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Nama dan nomor telepon wajib diisi." });
    return;
  }
  const user = getSalonIdentity(res);
  const [updated] = await db
    .update(salonUsers)
    .set({ name: parsed.data.name.trim(), phone: parsed.data.phone.trim() })
    .where(eq(salonUsers.id, user.id))
    .returning({
      id: salonUsers.id,
      name: salonUsers.name,
      email: salonUsers.email,
      phone: salonUsers.phone,
      role: salonUsers.role,
      isActive: salonUsers.isActive,
    });
  res.json(UpdateMemberProfileResponse.parse(updated));
});

router.patch("/member/password", requireSalonUser, async (req, res): Promise<void> => {
  const parsed = UpdateMemberPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Kata sandi baru minimal 8 karakter." });
    return;
  }
  const user = getSalonIdentity(res);
  const [account] = await db.select().from(salonUsers).where(eq(salonUsers.id, user.id)).limit(1);
  if (!account || !(await bcrypt.compare(parsed.data.currentPassword, account.passwordHash))) {
    res.status(400).json({ error: "Kata sandi saat ini tidak sesuai." });
    return;
  }
  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
  await db.update(salonUsers).set({ passwordHash }).where(eq(salonUsers.id, user.id));
  res.json(UpdateMemberPasswordResponse.parse({ message: "Kata sandi berhasil diperbarui." }));
});

export default router;
