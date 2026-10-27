import { Router, type IRouter } from "express";
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { asc, eq, and } from "drizzle-orm";
import { ReceiveMidtransNotificationBody } from "@workspace/api-zod";
import {
  db,
  membershipLevels,
  memberProfiles,
  salonBookings,
  salonNotifications,
  salonSettings,
  salonTransactions,
} from "@workspace/db";

const router: IRouter = Router();

router.post("/payments/midtrans/notification", async (req, res): Promise<void> => {
  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  if (!serverKey) {
    res.status(503).json({ error: "Webhook Midtrans belum dikonfigurasi." });
    return;
  }
  const parsed = ReceiveMidtransNotificationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Notifikasi pembayaran tidak lengkap." });
    return;
  }
  const notice = parsed.data;
  const expected = createHash("sha512")
    .update(`${notice.order_id}${notice.status_code}${notice.gross_amount}${serverKey}`)
    .digest();
  let supplied: Buffer;
  try {
    supplied = Buffer.from(notice.signature_key, "hex");
  } catch {
    res.status(400).json({ error: "Tanda tangan pembayaran tidak valid." });
    return;
  }
  if (supplied.length !== expected.length || !timingSafeEqual(expected, supplied)) {
    res.status(400).json({ error: "Tanda tangan pembayaran tidak valid." });
    return;
  }
  const outcome =
    notice.transaction_status === "settlement" || notice.transaction_status === "capture"
      ? "PAID"
      : notice.transaction_status === "pending"
        ? "PENDING"
        : ["deny", "cancel", "expire"].includes(notice.transaction_status)
          ? "FAILED"
          : null;
  if (!outcome) {
    res.status(200).json({ received: true, ignored: true });
    return;
  }

  const result = await db.transaction(async (tx) => {
    const [booking] = await tx.select().from(salonBookings).where(eq(salonBookings.bookingCode, notice.order_id)).limit(1);
    if (!booking) return "NOT_FOUND";
    const [transaction] = await tx.select().from(salonTransactions).where(eq(salonTransactions.bookingId, booking.id)).limit(1);
    if (!transaction) return "NOT_FOUND";
    if (Math.round(Number(notice.gross_amount)) !== transaction.finalAmount) return "AMOUNT_MISMATCH";
    if (transaction.status === "PAID") return "ALREADY_PAID";
    if (transaction.status !== "PENDING") return "ALREADY_FINAL";
    if (outcome === "PENDING") return "PENDING";
    const [profile] =
      outcome === "PAID"
        ? await tx.select().from(memberProfiles).where(eq(memberProfiles.userId, transaction.userId)).limit(1)
        : [];
    if (outcome === "PAID" && !profile) return "PROFILE_MISSING";

    const [claimed] = await tx
      .update(salonTransactions)
      .set({
        status: outcome,
        paymentRef: notice.order_id,
        paidAt: outcome === "PAID" ? new Date() : null,
      })
      .where(and(eq(salonTransactions.id, transaction.id), eq(salonTransactions.status, "PENDING")))
      .returning({ id: salonTransactions.id });
    if (!claimed) return "ALREADY_FINAL";

    if (outcome === "FAILED") {
      await tx.update(salonBookings).set({ status: "CANCELLED" }).where(eq(salonBookings.id, booking.id));
      return "FAILED";
    }

    await tx.update(salonBookings).set({ status: "CONFIRMED" }).where(eq(salonBookings.id, booking.id));
    const [ratioSetting] = await tx.select().from(salonSettings).where(eq(salonSettings.key, "points_per_rupiah")).limit(1);
    const ratio = Number(ratioSetting?.value ?? "0.001");
    const paidProfile = profile!;
    const totalSpending = paidProfile.totalSpending + transaction.finalAmount;
    const points = paidProfile.points + Math.floor(transaction.finalAmount * ratio);
    const [currentLevel] = await tx.select().from(membershipLevels).where(eq(membershipLevels.id, paidProfile.levelId)).limit(1);
    const levels = await tx.select().from(membershipLevels).orderBy(asc(membershipLevels.sortOrder));
    const earned = [...levels].reverse().find((level) => totalSpending >= level.minSpending);
    const levelId = paidProfile.manualLevel ? paidProfile.levelId : earned?.id ?? paidProfile.levelId;
    const [nextLevel] = await tx.select().from(membershipLevels).where(eq(membershipLevels.id, levelId)).limit(1);
    await tx.update(memberProfiles).set({ totalSpending, points, levelId }).where(eq(memberProfiles.userId, transaction.userId));
    if (currentLevel && nextLevel && nextLevel.sortOrder > currentLevel.sortOrder) {
      await tx.insert(salonNotifications).values({
        id: randomUUID(),
        userId: transaction.userId,
        message: `Selamat! Kamu naik ke level ${nextLevel.name}. Benefit membership barumu sudah aktif.`,
      });
    }
    return "PAID";
  });

  if (result === "NOT_FOUND") {
    res.status(404).json({ error: "Referensi booking tidak ditemukan." });
    return;
  }
  if (result === "AMOUNT_MISMATCH") {
    res.status(400).json({ error: "Nominal pembayaran tidak sesuai." });
    return;
  }
  if (result === "PROFILE_MISSING") {
    res.status(409).json({ error: "Profil member belum tersedia." });
    return;
  }
  res.json({ received: true, status: result });
});

export default router;
