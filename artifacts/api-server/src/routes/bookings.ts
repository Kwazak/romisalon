import { Router, type IRouter } from "express";
import { and, eq, gt, lt, ne, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  CancelMemberBookingParams,
  CancelMemberBookingResponse,
  CompleteMockPaymentParams,
  CompleteMockPaymentResponse,
  CreateBookingBody,
  CreateBookingResponse,
  GetAvailableSlotsQueryParams,
  GetAvailableSlotsResponse,
} from "@workspace/api-zod";
import {
  db,
  membershipLevels,
  memberProfiles,
  salonBookings,
  salonServices,
  salonTransactions,
} from "@workspace/db";
import { jakartaClock, jakartaDate, jakartaDateKey, slotLabel } from "../lib/jakarta-time";
import { settlePendingPayment } from "../lib/payment-settlement";
import { getSalonIdentity, requireSalonUser } from "../middlewares/salon-auth";

const router: IRouter = Router();

router.get("/bookings/slots", async (req, res): Promise<void> => {
  const parsed = GetAvailableSlotsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Pilih layanan dan tanggal yang valid." });
    return;
  }
  const selectedDate = parsed.data.date;
  const calendarDate = new Date(`${selectedDate}T00:00:00.000Z`);
  if (
    Number.isNaN(calendarDate.getTime()) ||
    calendarDate.toISOString().slice(0, 10) !== selectedDate
  ) {
    res.status(400).json({ error: "Pilih tanggal yang valid." });
    return;
  }
  const [service] = await db
    .select()
    .from(salonServices)
    .where(and(eq(salonServices.id, parsed.data.serviceId), eq(salonServices.isActive, true)))
    .limit(1);
  if (!service) {
    res.status(404).json({ error: "Layanan tidak ditemukan." });
    return;
  }
  const weekday = jakartaDate(selectedDate, 12).getUTCDay();
  const openingHour = weekday === 0 || weekday === 6 ? 10 : 9;
  const closingHour = weekday === 0 || weekday === 6 ? 18 : 20;
  const dayStart = jakartaDate(selectedDate);
  const dayEnd = jakartaDate(selectedDate, 23, 59);
  const existingBookings = await db
    .select()
    .from(salonBookings)
    .where(
      and(
        lt(salonBookings.startTime, dayEnd),
        gt(salonBookings.endTime, dayStart),
        ne(salonBookings.status, "CANCELLED"),
      ),
    );
  const pendingCutoff = Date.now() - 15 * 60 * 1000;
  const activeBookings = existingBookings.filter(
    (booking) =>
      booking.status !== "PENDING_PAYMENT" || booking.createdAt.getTime() > pendingCutoff,
  );
  const slots: string[] = [];
  for (let hour = openingHour; hour < closingHour; hour += 1) {
    for (const minute of [0, 30]) {
      const startTime = jakartaDate(selectedDate, hour, minute);
      const endTime = new Date(startTime.getTime() + service.durationMin * 60_000);
      if (endTime > jakartaDate(selectedDate, closingHour)) continue;
      if (startTime.getTime() <= Date.now()) continue;
      const overlaps = activeBookings.some(
        (booking) => booking.startTime < endTime && booking.endTime > startTime,
      );
      if (!overlaps) slots.push(slotLabel(startTime));
    }
  }
  res.json(GetAvailableSlotsResponse.parse({ slots }));
});

router.post("/bookings", requireSalonUser, async (req, res): Promise<void> => {
  const parsed = CreateBookingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Data pemesanan belum lengkap." });
    return;
  }
  const user = getSalonIdentity(res);
  const startTime = new Date(parsed.data.startTime);
  if (Number.isNaN(startTime.getTime()) || startTime.getTime() <= Date.now()) {
    res.status(400).json({ error: "Pilih waktu pemesanan yang akan datang." });
    return;
  }
  const [service] = await db
    .select()
    .from(salonServices)
    .where(and(eq(salonServices.id, parsed.data.serviceId), eq(salonServices.isActive, true)))
    .limit(1);
  if (!service) {
    res.status(404).json({ error: "Layanan tidak tersedia." });
    return;
  }
  const endTime = new Date(startTime.getTime() + service.durationMin * 60_000);
  const localDate = jakartaDateKey(startTime);
  const localClock = jakartaClock(startTime);
  const weekday = jakartaDate(localDate, 12).getUTCDay();
  const openingHour = weekday === 0 || weekday === 6 ? 10 : 9;
  const closingHour = weekday === 0 || weekday === 6 ? 18 : 20;
  if (
    ![0, 30].includes(localClock.minute) ||
    localClock.hour < openingHour ||
    endTime > jakartaDate(localDate, closingHour)
  ) {
    res.status(400).json({ error: "Pilih waktu sesuai jam operasional salon." });
    return;
  }
  const [profile] = await db
    .select()
    .from(memberProfiles)
    .where(eq(memberProfiles.userId, user.id))
    .limit(1);
  const [level] = profile
    ? await db
        .select()
        .from(membershipLevels)
        .where(eq(membershipLevels.id, profile.levelId))
        .limit(1)
    : [];
  const amount = service.price;
  const discountAmount = Math.round((amount * (level?.discountPercent ?? 0)) / 100);
  const id = randomUUID();
  const bookingCode = `ROMI-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 90 + 10)}`;

  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('romi-salon-slot-capacity'))`);
    const overlapping = await tx
      .select({
        id: salonBookings.id,
        status: salonBookings.status,
        createdAt: salonBookings.createdAt,
      })
      .from(salonBookings)
      .where(
        and(
          lt(salonBookings.startTime, endTime),
          gt(salonBookings.endTime, startTime),
          ne(salonBookings.status, "CANCELLED"),
        ),
      )
      .limit(1);
    const pendingCutoff = Date.now() - 15 * 60 * 1000;
    const isBlocked = overlapping.some(
      (booking) =>
        booking.status !== "PENDING_PAYMENT" || booking.createdAt.getTime() > pendingCutoff,
    );
    if (isBlocked) return null;
    await tx.insert(salonBookings).values({
      id,
      userId: user.id,
      serviceId: service.id,
      startTime,
      endTime,
      status: "PENDING_PAYMENT",
      bookingCode,
    });
    await tx.insert(salonTransactions).values({
      id: randomUUID(),
      bookingId: id,
      userId: user.id,
      amount,
      discountAmount,
      finalAmount: amount - discountAmount,
      status: "PENDING",
    });
    return {
      id,
      userId: user.id,
      memberName: user.name,
      serviceId: service.id,
      serviceName: service.name,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      status: "PENDING_PAYMENT",
      paymentStatus: "PENDING",
      amount,
      discountAmount,
      finalAmount: amount - discountAmount,
      bookingCode,
    };
  });
  if (!result) {
    res.status(409).json({ error: "Slot baru saja dipesan. Silakan pilih waktu lain." });
    return;
  }
  res.status(201).json(CreateBookingResponse.parse(result));
});

router.patch("/bookings/:bookingId/cancel", requireSalonUser, async (req, res): Promise<void> => {
  const params = CancelMemberBookingParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Pemesanan tidak valid." });
    return;
  }
  const user = getSalonIdentity(res);
  const [existingBooking] = await db
    .select()
    .from(salonBookings)
    .where(and(eq(salonBookings.id, params.data.bookingId), eq(salonBookings.userId, user.id)))
    .limit(1);
  if (!existingBooking) {
    res.status(404).json({ error: "Pemesanan tidak ditemukan." });
    return;
  }
  if (
    existingBooking.status === "COMPLETED" ||
    existingBooking.status === "CANCELLED" ||
    existingBooking.startTime <= new Date()
  ) {
    res.status(409).json({ error: "Pemesanan ini tidak dapat dibatalkan." });
    return;
  }
  const [service] = await db
    .select()
    .from(salonServices)
    .where(eq(salonServices.id, existingBooking.serviceId))
    .limit(1);
  const [transaction] = await db
    .select()
    .from(salonTransactions)
    .where(eq(salonTransactions.bookingId, existingBooking.id))
    .limit(1);
  const [updatedBooking] = await db
    .update(salonBookings)
    .set({ status: "CANCELLED" })
    .where(eq(salonBookings.id, existingBooking.id))
    .returning();
  res.json(
    CancelMemberBookingResponse.parse({
      id: updatedBooking.id,
      userId: updatedBooking.userId,
      memberName: user.name,
      serviceId: updatedBooking.serviceId,
      serviceName: service?.name ?? "Layanan",
      startTime: updatedBooking.startTime.toISOString(),
      endTime: updatedBooking.endTime.toISOString(),
      status: updatedBooking.status,
      paymentStatus: transaction?.status ?? "PENDING",
      amount: transaction?.amount ?? 0,
      discountAmount: transaction?.discountAmount ?? 0,
      finalAmount: transaction?.finalAmount ?? 0,
      bookingCode: updatedBooking.bookingCode,
    }),
  );
});

router.post(
  "/bookings/:bookingId/mock-payment",
  requireSalonUser,
  async (req, res): Promise<void> => {
    const params = CompleteMockPaymentParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "Pemesanan tidak valid." });
      return;
    }
    if (process.env.MOCK_PAYMENT === "false") {
      res.status(503).json({
        error: "Pembayaran simulasi dinonaktifkan. Hubungkan Midtrans untuk menerima pembayaran.",
      });
      return;
    }
    const user = getSalonIdentity(res);
    const paymentResult = await db.transaction(async (tx) => {
      const [booking] = await tx
        .select()
        .from(salonBookings)
        .where(and(eq(salonBookings.id, params.data.bookingId), eq(salonBookings.userId, user.id)))
        .limit(1);
      if (!booking) return { error: "Pemesanan tidak ditemukan.", status: 404 as const };

      const [transaction] = await tx
        .select()
        .from(salonTransactions)
        .where(eq(salonTransactions.bookingId, booking.id))
        .limit(1);
      if (!transaction) return { error: "Transaksi tidak ditemukan.", status: 404 as const };

      if (transaction.status === "PAID") {
        return {
          value: {
            bookingId: booking.id,
            status: "PAID",
            message: "Pembayaran sudah tercatat.",
          },
        };
      }
      if (booking.status === "CANCELLED" || transaction.status !== "PENDING") {
        return { error: "Pemesanan tidak dapat dibayar.", status: 409 as const };
      }

      const settlement = await settlePendingPayment({
        tx,
        bookingId: booking.id,
        transactionId: transaction.id,
        userId: user.id,
        finalAmount: transaction.finalAmount,
        paymentRef: `MOCK-${transaction.id}`,
      });

      if (settlement.status === "PROFILE_MISSING") {
        return { error: "Profil member tidak ditemukan.", status: 409 as const };
      }
      if (settlement.status === "ALREADY_FINAL") {
        return {
          value: {
            bookingId: booking.id,
            status: "PAID",
            message: "Pembayaran sudah tercatat.",
          },
        };
      }

      return {
        value: {
          bookingId: booking.id,
          status: "PAID",
          message: "Pembayaran simulasi berhasil. Poin dan level sudah diperbarui.",
        },
      };
    });

    if ("error" in paymentResult) {
      res.status(paymentResult.status ?? 500).json({ error: paymentResult.error });
      return;
    }
    res.json(CompleteMockPaymentResponse.parse(paymentResult.value));
  },
);

export default router;
