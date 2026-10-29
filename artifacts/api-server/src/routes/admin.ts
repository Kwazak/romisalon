import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, gte, ilike, lt, or } from "drizzle-orm";
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
import { jakartaDate, jakartaDateKey } from "../lib/jakarta-time";
import { requireSalonAdmin, requireSalonUser } from "../middlewares/salon-auth";

const router: IRouter = Router();

async function bookingRows(from?: Date, until?: Date) {
  const whereClause =
    from && until
      ? and(gte(salonBookings.startTime, from), lt(salonBookings.startTime, until))
      : undefined;
  const rows = await db
    .select({
      booking: salonBookings,
      memberName: salonUsers.name,
      serviceName: salonServices.name,
      transaction: salonTransactions,
    })
    .from(salonBookings)
    .innerJoin(salonUsers, eq(salonBookings.userId, salonUsers.id))
    .innerJoin(salonServices, eq(salonBookings.serviceId, salonServices.id))
    .leftJoin(salonTransactions, eq(salonTransactions.bookingId, salonBookings.id))
    .where(whereClause)
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

async function getFormattedAdminMember(userId: string) {
  const [row] = await db
    .select({
      user: salonUsers,
      profile: memberProfiles,
      level: membershipLevels,
    })
    .from(salonUsers)
    .innerJoin(memberProfiles, eq(memberProfiles.userId, salonUsers.id))
    .innerJoin(membershipLevels, eq(membershipLevels.id, memberProfiles.levelId))
    .where(and(eq(salonUsers.id, userId), eq(salonUsers.role, "MEMBER")))
    .limit(1);

  if (!row) return null;

  return {
    id: row.user.id,
    name: row.user.name,
    email: row.user.email,
    phone: row.user.phone,
    level: row.level.name,
    levelId: row.level.id,
    totalSpending: row.profile.totalSpending,
    points: row.profile.points,
    joinedAt: row.user.createdAt.toISOString(),
    isActive: row.user.isActive,
  };
}

async function recalculateMemberLevels(): Promise<void> {
  const [levels, profiles] = await Promise.all([
    db.select().from(membershipLevels).orderBy(asc(membershipLevels.sortOrder)),
    db.select().from(memberProfiles).where(eq(memberProfiles.manualLevel, false)),
  ]);
  for (const profile of profiles) {
    const earned = [...levels]
      .reverse()
      .find((level) => profile.totalSpending >= level.minSpending);
    if (earned && earned.id !== profile.levelId) {
      await db
        .update(memberProfiles)
        .set({ levelId: earned.id })
        .where(eq(memberProfiles.userId, profile.userId));
    }
  }
}

function levelOrderIsValid(
  candidate: { id?: string; minSpending: number; sortOrder: number },
  existing: Array<typeof membershipLevels.$inferSelect>,
): boolean {
  const nextLevels = [
    ...existing.filter((item) => item.id !== candidate.id),
    { ...candidate, id: candidate.id ?? "candidate" },
  ].sort((first, second) => first.sortOrder - second.sortOrder);

  return nextLevels.every((level, index) =>
    index === 0
      ? level.minSpending === 0
      : level.minSpending > nextLevels[index - 1]!.minSpending,
  );
}

router.use("/admin", requireSalonUser, requireSalonAdmin);

router.get("/admin/dashboard", async (_req, res): Promise<void> => {
  const now = new Date();
  const today = jakartaDateKey(now);
  const [year, month] = today.split("-");
  const dayStart = jakartaDate(today);
  const monthStart = jakartaDate(`${year}-${month}-01`);

  const [transactions, bookings, members] = await Promise.all([
    db.select().from(salonTransactions).where(eq(salonTransactions.status, "PAID")),
    bookingRows(),
    db
      .select({ id: salonUsers.id, createdAt: salonUsers.createdAt })
      .from(salonUsers)
      .where(eq(salonUsers.role, "MEMBER")),
  ]);

  const completedTransactions = transactions.filter((transaction) => transaction.paidAt);
  const todayRevenue = completedTransactions
    .filter((transaction) => transaction.paidAt! >= dayStart)
    .reduce((sum, item) => sum + item.finalAmount, 0);
  const monthRevenue = completedTransactions
    .filter((transaction) => transaction.paidAt! >= monthStart)
    .reduce((sum, item) => sum + item.finalAmount, 0);

  const revenueTrend = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(dayStart.getTime() - (6 - index) * 86_400_000);
    const key = jakartaDateKey(date);
    return {
      label: new Intl.DateTimeFormat("id-ID", {
        timeZone: "Asia/Jakarta",
        day: "numeric",
        month: "short",
      }).format(date),
      amount: completedTransactions
        .filter((item) => item.paidAt && jakartaDateKey(item.paidAt) === key)
        .reduce((sum, item) => sum + item.finalAmount, 0),
    };
  });

  const serviceRevenue = new Map<string, number>();
  const transactionDetails = await db
    .select({
      serviceName: salonServices.name,
      finalAmount: salonTransactions.finalAmount,
    })
    .from(salonTransactions)
    .innerJoin(salonBookings, eq(salonTransactions.bookingId, salonBookings.id))
    .innerJoin(salonServices, eq(salonBookings.serviceId, salonServices.id))
    .where(eq(salonTransactions.status, "PAID"));

  for (const row of transactionDetails) {
    serviceRevenue.set(
      row.serviceName,
      (serviceRevenue.get(row.serviceName) ?? 0) + row.finalAmount,
    );
  }

  const topServices = [...serviceRevenue.entries()]
    .sort((first, second) => second[1] - first[1])
    .slice(0, 5)
    .map(([name]) => name);

  const upcomingBookings = bookings
    .filter(
      (booking) => new Date(booking.startTime) >= now && booking.status !== "CANCELLED",
    )
    .slice(0, 6);

  const payload = {
    todayRevenue,
    monthRevenue,
    totalRevenue: completedTransactions.reduce((sum, item) => sum + item.finalAmount, 0),
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
  res.json(
    GetAdminServicesResponse.parse(rows.map((row) => ({ ...row, imageUrl: row.imageUrl }))),
  );
});

router.post("/admin/services", async (req, res): Promise<void> => {
  const parsed = CreateServiceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Data layanan belum valid." });
    return;
  }
  const [created] = await db
    .insert(salonServices)
    .values({ id: randomUUID(), ...parsed.data })
    .returning();
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
  const rows = await db
    .select()
    .from(membershipLevels)
    .orderBy(asc(membershipLevels.sortOrder));
  res.json(GetMembershipLevelsResponse.parse(rows));
});

router.post("/admin/levels", async (req, res): Promise<void> => {
  const parsed = CreateMembershipLevelBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Data level belum valid." });
    return;
  }
  const currentLevels = await db.select().from(membershipLevels);
  if (!levelOrderIsValid({ ...parsed.data }, currentLevels)) {
    res.status(409).json({
      error: "Batas minimum setiap level harus berurutan dan tidak boleh sama.",
    });
    return;
  }
  const [created] = await db
    .insert(membershipLevels)
    .values({ id: randomUUID(), ...parsed.data })
    .returning();
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
  const currentLevels = await db.select().from(membershipLevels);
  if (!currentLevels.some((level) => level.id === params.data.levelId)) {
    res.status(404).json({ error: "Level membership tidak ditemukan." });
    return;
  }
  if (!levelOrderIsValid({ id: params.data.levelId, ...body.data }, currentLevels)) {
    res.status(409).json({
      error: "Batas minimum setiap level harus berurutan dan tidak boleh sama.",
    });
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
  const [assigned] = await db
    .select()
    .from(memberProfiles)
    .where(eq(memberProfiles.levelId, params.data.levelId))
    .limit(1);
  if (assigned) {
    res.status(409).json({
      error: "Level masih digunakan oleh member dan tidak dapat dihapus.",
    });
    return;
  }
  const deleted = await db
    .delete(membershipLevels)
    .where(eq(membershipLevels.id, params.data.levelId))
    .returning({ id: membershipLevels.id });
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
  const pattern = searchTerm ? `%${searchTerm}%` : null;
  const whereClause = pattern
    ? and(
        eq(salonUsers.role, "MEMBER"),
        or(
          ilike(salonUsers.name, pattern),
          ilike(salonUsers.email, pattern),
          ilike(salonUsers.phone, pattern),
        ),
      )
    : eq(salonUsers.role, "MEMBER");

  const rows = await db
    .select({
      user: salonUsers,
      profile: memberProfiles,
      level: membershipLevels,
    })
    .from(salonUsers)
    .innerJoin(memberProfiles, eq(memberProfiles.userId, salonUsers.id))
    .innerJoin(membershipLevels, eq(membershipLevels.id, memberProfiles.levelId))
    .where(whereClause)
    .orderBy(asc(salonUsers.name));

  const result = rows.map(({ user, profile, level }) => ({
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
  }));

  res.json(GetAdminMembersResponse.parse(result));
});

router.patch("/admin/members/:userId/level", async (req, res): Promise<void> => {
  const params = UpdateMemberLevelParams.safeParse(req.params);
  const body = UpdateMemberLevelBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Level member tidak valid." });
    return;
  }
  const [level] = await db
    .select()
    .from(membershipLevels)
    .where(eq(membershipLevels.id, body.data.levelId))
    .limit(1);
  if (!level) {
    res.status(404).json({ error: "Level membership tidak ditemukan." });
    return;
  }
  await db
    .update(memberProfiles)
    .set({ levelId: level.id, manualLevel: true })
    .where(eq(memberProfiles.userId, params.data.userId));

  const formattedMember = await getFormattedAdminMember(params.data.userId);
  if (!formattedMember) {
    res.status(404).json({ error: "Member tidak ditemukan." });
    return;
  }
  res.json(UpdateMemberLevelResponse.parse(formattedMember));
});

router.patch("/admin/members/:userId/status", async (req, res): Promise<void> => {
  const params = UpdateMemberStatusParams.safeParse(req.params);
  const body = UpdateMemberStatusBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Status member tidak valid." });
    return;
  }
  const [updatedUser] = await db
    .update(salonUsers)
    .set({ isActive: body.data.isActive })
    .where(and(eq(salonUsers.id, params.data.userId), eq(salonUsers.role, "MEMBER")))
    .returning({ id: salonUsers.id });

  if (!updatedUser) {
    res.status(404).json({ error: "Member tidak ditemukan." });
    return;
  }

  const formattedMember = await getFormattedAdminMember(updatedUser.id);
  if (!formattedMember) {
    res.status(404).json({ error: "Profil member tidak ditemukan." });
    return;
  }
  res.json(UpdateMemberStatusResponse.parse(formattedMember));
});

router.get("/admin/bookings", async (req, res): Promise<void> => {
  const parsed = GetAdminBookingsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Filter tanggal tidak valid." });
    return;
  }
  const selectedDay = parsed.data.date ? parsed.data.date.toISOString().slice(0, 10) : null;
  const rows = selectedDay
    ? await bookingRows(jakartaDate(selectedDay), jakartaDate(selectedDay, 24))
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
  const [booking] = await db
    .select()
    .from(salonBookings)
    .where(eq(salonBookings.id, params.data.bookingId))
    .limit(1);
  if (!booking) {
    res.status(404).json({ error: "Pemesanan tidak ditemukan." });
    return;
  }
  const [transaction] = await db
    .select()
    .from(salonTransactions)
    .where(eq(salonTransactions.bookingId, booking.id))
    .limit(1);
  if (body.data.status === "CONFIRMED" && transaction?.status !== "PAID") {
    res.status(409).json({
      error: "Pemesanan hanya dapat dikonfirmasi setelah pembayaran berhasil.",
    });
    return;
  }
  const [updated] = await db
    .update(salonBookings)
    .set({ status: body.data.status })
    .where(eq(salonBookings.id, booking.id))
    .returning();
  const [user] = await db
    .select()
    .from(salonUsers)
    .where(eq(salonUsers.id, updated.userId))
    .limit(1);
  const [service] = await db
    .select()
    .from(salonServices)
    .where(eq(salonServices.id, updated.serviceId))
    .limit(1);
  res.json(
    UpdateBookingStatusResponse.parse({
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
    }),
  );
});

router.get("/admin/transactions", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      transaction: salonTransactions,
      userName: salonUsers.name,
      booking: salonBookings,
      serviceName: salonServices.name,
    })
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
