import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, gte, like, lt, ne } from "drizzle-orm";
import {
  CreateMembershipLevelBody,
  CreateMembershipLevelResponse,
  CreateServiceBody,
  CreateServiceResponse,
  DeleteMembershipLevelParams,
  DeleteServiceParams,
  GetAdminBookingsQueryParams,
  GetAdminBookingsResponse,
  GetAdminDashboardResponse,
  GetAdminMembersQueryParams,
  GetAdminMembersResponse,
  GetAdminServicesResponse,
  GetAdminTransactionsResponse,
  GetMembershipLevelsResponse,
  UpdateBookingStatusBody,
  UpdateBookingStatusParams,
  UpdateBookingStatusResponse,
  UpdateMemberLevelBody,
  UpdateMemberLevelParams,
  UpdateMemberLevelResponse,
  UpdateMemberStatusBody,
  UpdateMemberStatusParams,
  UpdateMemberStatusResponse,
  UpdateMembershipLevelBody,
  UpdateMembershipLevelParams,
  UpdateMembershipLevelResponse,
  UpdateServiceBody,
  UpdateServiceParams,
  UpdateServiceResponse,
} from "@workspace/api-zod";
import {
  db,
  membershipLevels,
  memberProfiles,
  salonBookings,
  salonServices,
  salonTransactions,
  salonUsers,
} from "@workspace/db";
import { getSalonIdentity, requireSalonAdmin, requireSalonUser } from "../middlewares/salon-auth";

const router: IRouter = Router();
const jakartaDate = (day: string, hour = 0): Date => new Date(`${day}T${String(hour).padStart(2, "0")}:00:00+07:00`);
const dateKey = (value: Date): string =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(value);

async function bookingRows(from?: Date, until?: Date) {
  const where = from && until
    ? and(gte(salonBookings.startTime, from), lt(salonBookings.startTime, until))
    : undefined;
  const rows = await db
    .select({ booking: salonBookings, memberName: salonUsers.name, serviceName: salonServices.name, transaction: salonTransactions })
    .from(salonBookings)
    .innerJoin(salonUsers, eq(salonBookings.userId, salonUsers.id))
    .innerJoin(salonServices, eq(salonBookings.serviceId, salonServices.id))
    .leftJoin(salonTransactions, eq(salonTransactions.bookingId, salonBookings.id))
    .where(where)
    .orderBy(asc(salonBookings.startTime));
  return rows.map(({ booking, memberName, serviceName, transaction }) => ({
    id: booking.id,
    userId: booking.userId,
    memberName,
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
}

async function recalculateMemberLevels(): Promise<void> {
  const [levels, profiles] = await Promise.all([
    db.select().from(membershipLevels).orderBy(asc(membershipLevels.sortOrder)),
    db.select().from(memberProfiles).where(eq(memberProfiles.manualLevel, false)),
  ]);
  for (const profile of profiles) {
    const earned = [...levels].reverse().find((level) => profile.totalSpending >= level.minSpending);
    if (earned && earned.id !== profile.levelId) {
      await db.update(memberProfiles).set({ levelId: earned.id }).where(eq(memberProfiles.userId, profile.userId));
    }
  }
}

function levelOrderIsValid(candidate: { id?: string; minSpending: number; sortOrder: number }, existing: typeof membershipLevels.$inferSelect[]): boolean {
  const next = [...existing.filter((item) => item.id !== candidate.id), { ...candidate, id: candidate.id ?? "candidate" }]
    .sort((a, b) => a.sortOrder - b.sortOrder);
  return next.every((level, index) =>
    index === 0 ? level.minSpending === 0 : level.minSpending > next[index - 1]!.minSpending,
  );
}

router.use("/admin", requireSalonUser, requireSalonAdmin);

router.get("/admin/dashboard", async (_req, res): Promise<void> => {
  const now = new Date();
  const today = dateKey(now);
  const [year, month] = today.split("-");
  const dayStart = jakartaDate(today);
  const monthStart = jakartaDate(`${year}-${month}-01`);
  const [transactions, bookings, members] = await Promise.all([
    db.select().from(salonTransactions).where(eq(salonTransactions.status, "PAID")),
    bookingRows(),
    db.select({ id: salonUsers.id, createdAt: salonUsers.createdAt }).from(salonUsers).where(eq(salonUsers.role, "MEMBER")),
  ]);
  const completed = transactions.filter((transaction) => transaction.paidAt);
  const todayRevenue = completed.filter((transaction) => transaction.paidAt! >= dayStart).reduce((sum, item) => sum + item.finalAmount, 0);
  const monthRevenue = completed.filter((transaction) => transaction.paidAt! >= monthStart).reduce((sum, item) => sum + item.finalAmount, 0);
  const revenueTrend = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(dayStart.getTime() - (6 - index) * 86_400_000);
    const key = dateKey(date);
    return {
      label: new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "short" }).format(date),
      amount: completed.filter((item) => item.paidAt && dateKey(item.paidAt) === key).reduce((sum, item) => sum + item.finalAmount, 0),
    };
  });
  const serviceRevenue = new Map<string, number>();
  const transactionDetails = await db
    .select({ serviceName: salonServices.name, finalAmount: salonTransactions.finalAmount })
    .from(salonTransactions)
    .innerJoin(salonBookings, eq(salonTransactions.bookingId, salonBookings.id))
    .innerJoin(salonServices, eq(salonBookings.serviceId, salonServices.id))
    .where(eq(salonTransactions.status, "PAID"));
  for (const row of transactionDetails) {
    serviceRevenue.set(row.serviceName, (serviceRevenue.get(row.serviceName) ?? 0) + row.finalAmount);
  }
  const topServices = [...serviceRevenue.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name]) => name);
  const upcomingBookings = bookings
    .filter((booking) => new Date(booking.startTime) >= now && booking.status !== "CANCELLED")
    .slice(0, 6);
  const payload = {
    todayRevenue,
    monthRevenue,
    totalRevenue: completed.reduce((sum, item) => sum + item.finalAmount, 0),
    transactionCount: transactions.length,
    newMembers: members.filter((member) => member.createdAt >= dayStart).length,
    revenueTrend,
    topServices,
    upcomingBookings,
  };
  res.json(GetAdminDashboardResponse.parse(payload));
});

router.get("/admin/services", async (_req, res): Promise<void> => {
  const rows = await db.select().from(salonServices).orderBy(asc(salonServices.name));
  res.json(GetAdminServicesResponse.parse(rows.map((row) => ({ ...row, imageUrl: row.imageUrl }))));
});

router.post("/admin/services", async (req, res): Promise<void> => {
  const parsed = CreateServiceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Data layanan belum valid." });
    return;
  }
  const [created] = await db.insert(salonServices).values({ id: randomUUID(), ...parsed.data }).returning();
  res.status(201).json(CreateServiceResponse.parse(created));
});

router.patch("/admin/services/:serviceId", async (req, res): Promise<void> => {
  const params = UpdateServiceParams.safeParse(req.params);
  const body = UpdateServiceBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Data layanan belum valid." });
    return;
  }
  const [updated] = await db
    .update(salonServices)
    .set(body.data)
    .where(eq(salonServices.id, params.data.serviceId))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Layanan tidak ditemukan." });
    return;
  }
  res.json(UpdateServiceResponse.parse(updated));
});

router.delete("/admin/services/:serviceId", async (req, res): Promise<void> => {
  const params = DeleteServiceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Layanan tidak valid." });
    return;
  }
  const [updated] = await db
    .update(salonServices)
    .set({ isActive: false, deletedAt: new Date() })
    .where(eq(salonServices.id, params.data.serviceId))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Layanan tidak ditemukan." });
    return;
  }
  res.json(GetAdminServicesResponse.element.parse(updated));
});

router.get("/admin/levels", async (_req, res): Promise<void> => {
  const rows = await db.select().from(membershipLevels).orderBy(asc(membershipLevels.sortOrder));
  res.json(GetMembershipLevelsResponse.parse(rows));
});

router.post("/admin/levels", async (req, res): Promise<void> => {
  const parsed = CreateMembershipLevelBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Data level belum valid." });
    return;
  }
  const current = await db.select().from(membershipLevels);
  if (!levelOrderIsValid({ ...parsed.data }, current)) {
    res.status(409).json({ error: "Batas minimum setiap level harus berurutan dan tidak boleh sama." });
    return;
  }
  const [created] = await db.insert(membershipLevels).values({ id: randomUUID(), ...parsed.data }).returning();
  await recalculateMemberLevels();
  res.status(201).json(CreateMembershipLevelResponse.parse(created));
});

router.patch("/admin/levels/:levelId", async (req, res): Promise<void> => {
  const params = UpdateMembershipLevelParams.safeParse(req.params);
  const body = UpdateMembershipLevelBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Data level belum valid." });
    return;
  }
  const current = await db.select().from(membershipLevels);
  if (!current.some((level) => level.id === params.data.levelId)) {
    res.status(404).json({ error: "Level membership tidak ditemukan." });
    return;
  }
  if (!levelOrderIsValid({ id: params.data.levelId, ...body.data }, current)) {
    res.status(409).json({ error: "Batas minimum setiap level harus berurutan dan tidak boleh sama." });
    return;
  }
  const [updated] = await db
    .update(membershipLevels)
    .set(body.data)
    .where(eq(membershipLevels.id, params.data.levelId))
    .returning();
  await recalculateMemberLevels();
  res.json(UpdateMembershipLevelResponse.parse(updated));
});

router.delete("/admin/levels/:levelId", async (req, res): Promise<void> => {
  const params = DeleteMembershipLevelParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Level membership tidak valid." });
    return;
  }
  const [assigned] = await db.select().from(memberProfiles).where(eq(memberProfiles.levelId, params.data.levelId)).limit(1);
  if (assigned) {
    res.status(409).json({ error: "Level masih digunakan oleh member dan tidak dapat dihapus." });
    return;
  }
  const deleted = await db.delete(membershipLevels).where(eq(membershipLevels.id, params.data.levelId)).returning({ id: membershipLevels.id });
  if (!deleted.length) {
    res.status(404).json({ error: "Level membership tidak ditemukan." });
    return;
  }
  res.sendStatus(204);
});

router.get("/admin/members", async (req, res): Promise<void> => {
  const parsed = GetAdminMembersQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Filter pencarian tidak valid." });
    return;
  }
  const searchTerm = parsed.data.search?.trim();
  const matches = searchTerm
    ? await db.select().from(salonUsers).where(and(eq(salonUsers.role, "MEMBER"), like(salonUsers.name, `%${searchTerm}%`)))
    : await db.select().from(salonUsers).where(eq(salonUsers.role, "MEMBER"));
  const result = [];
  for (const user of matches) {
    const [profile] = await db.select().from(memberProfiles).where(eq(memberProfiles.userId, user.id)).limit(1);
    const [level] = profile
      ? await db.select().from(membershipLevels).where(eq(membershipLevels.id, profile.levelId)).limit(1)
      : [];
    if (!profile || !level) continue;
    result.push({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      level: level.name,
      levelId: level.id,
      totalSpending: profile.totalSpending,
      points: profile.points,
      joinedAt: user.createdAt.toISOString(),
      isActive: user.isActive,
    });
  }
  res.json(GetAdminMembersResponse.parse(result));
});

router.patch("/admin/members/:userId/level", async (req, res): Promise<void> => {
  const params = UpdateMemberLevelParams.safeParse(req.params);
  const body = UpdateMemberLevelBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Level member tidak valid." });
    return;
  }
  const [level] = await db.select().from(membershipLevels).where(eq(membershipLevels.id, body.data.levelId)).limit(1);
  if (!level) {
    res.status(404).json({ error: "Level membership tidak ditemukan." });
    return;
  }
  await db.update(memberProfiles).set({ levelId: level.id, manualLevel: true }).where(eq(memberProfiles.userId, params.data.userId));
  const [updatedUser] = await db.select().from(salonUsers).where(eq(salonUsers.id, params.data.userId)).limit(1);
  const [profile] = await db.select().from(memberProfiles).where(eq(memberProfiles.userId, params.data.userId)).limit(1);
  if (!updatedUser || !profile) {
    res.status(404).json({ error: "Member tidak ditemukan." });
    return;
  }
  res.json(UpdateMemberLevelResponse.parse({
    id: updatedUser.id,
    name: updatedUser.name,
    email: updatedUser.email,
    phone: updatedUser.phone,
    level: level.name,
    levelId: level.id,
    totalSpending: profile.totalSpending,
    points: profile.points,
    joinedAt: updatedUser.createdAt.toISOString(),
    isActive: updatedUser.isActive,
  }));
});

router.patch("/admin/members/:userId/status", async (req, res): Promise<void> => {
  const params = UpdateMemberStatusParams.safeParse(req.params);
  const body = UpdateMemberStatusBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Status member tidak valid." });
    return;
  }
  const [updatedUser] = await db.update(salonUsers).set({ isActive: body.data.isActive }).where(eq(salonUsers.id, params.data.userId)).returning();
  if (!updatedUser || updatedUser.role !== "MEMBER") {
    res.status(404).json({ error: "Member tidak ditemukan." });
    return;
  }
  const [profile] = await db.select().from(memberProfiles).where(eq(memberProfiles.userId, updatedUser.id)).limit(1);
  const [level] = profile
    ? await db.select().from(membershipLevels).where(eq(membershipLevels.id, profile.levelId)).limit(1)
    : [];
  if (!profile || !level) {
    res.status(404).json({ error: "Profil member tidak ditemukan." });
    return;
  }
  res.json(UpdateMemberStatusResponse.parse({
    id: updatedUser.id,
    name: updatedUser.name,
    email: updatedUser.email,
    phone: updatedUser.phone,
    level: level.name,
    levelId: level.id,
    totalSpending: profile.totalSpending,
    points: profile.points,
    joinedAt: updatedUser.createdAt.toISOString(),
    isActive: updatedUser.isActive,
  }));
});

router.get("/admin/bookings", async (req, res): Promise<void> => {
  const parsed = GetAdminBookingsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Filter tanggal tidak valid." });
    return;
  }
  const rows = parsed.data.date
    ? await bookingRows(
        jakartaDate(parsed.data.date.toISOString().slice(0, 10)),
        jakartaDate(parsed.data.date.toISOString().slice(0, 10), 24),
      )
    : await bookingRows();
  res.json(GetAdminBookingsResponse.parse(rows));
});

router.patch("/admin/bookings/:bookingId", async (req, res): Promise<void> => {
  const params = UpdateBookingStatusParams.safeParse(req.params);
  const body = UpdateBookingStatusBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Status pemesanan tidak valid." });
    return;
  }
  const [booking] = await db.select().from(salonBookings).where(eq(salonBookings.id, params.data.bookingId)).limit(1);
  if (!booking) {
    res.status(404).json({ error: "Pemesanan tidak ditemukan." });
    return;
  }
  const [transaction] = await db.select().from(salonTransactions).where(eq(salonTransactions.bookingId, booking.id)).limit(1);
  if (body.data.status === "CONFIRMED" && transaction?.status !== "PAID") {
    res.status(409).json({ error: "Pemesanan hanya dapat dikonfirmasi setelah pembayaran berhasil." });
    return;
  }
  const [updated] = await db.update(salonBookings).set({ status: body.data.status }).where(eq(salonBookings.id, booking.id)).returning();
  const [user] = await db.select().from(salonUsers).where(eq(salonUsers.id, updated.userId)).limit(1);
  const [service] = await db.select().from(salonServices).where(eq(salonServices.id, updated.serviceId)).limit(1);
  res.json(UpdateBookingStatusResponse.parse({
    id: updated.id,
    userId: updated.userId,
    memberName: user?.name ?? "Member",
    serviceId: updated.serviceId,
    serviceName: service?.name ?? "Layanan",
    startTime: updated.startTime.toISOString(),
    endTime: updated.endTime.toISOString(),
    status: updated.status,
    paymentStatus: transaction?.status ?? "PENDING",
    amount: transaction?.amount ?? 0,
    discountAmount: transaction?.discountAmount ?? 0,
    finalAmount: transaction?.finalAmount ?? 0,
    bookingCode: updated.bookingCode,
  }));
});

router.get("/admin/transactions", async (_req, res): Promise<void> => {
  const rows = await db
    .select({ transaction: salonTransactions, userName: salonUsers.name, booking: salonBookings, serviceName: salonServices.name })
    .from(salonTransactions)
    .innerJoin(salonUsers, eq(salonTransactions.userId, salonUsers.id))
    .innerJoin(salonBookings, eq(salonTransactions.bookingId, salonBookings.id))
    .innerJoin(salonServices, eq(salonBookings.serviceId, salonServices.id))
    .orderBy(desc(salonTransactions.createdAt))
    .limit(500);
  const result = rows.map(({ transaction, userName, serviceName }) => ({
    id: transaction.id,
    bookingId: transaction.bookingId,
    memberName: userName,
    serviceName,
    amount: transaction.amount,
    discountAmount: transaction.discountAmount,
    finalAmount: transaction.finalAmount,
    status: transaction.status,
    createdAt: transaction.createdAt.toISOString(),
  }));
  res.json(GetAdminTransactionsResponse.parse(result));
});

export default router;
