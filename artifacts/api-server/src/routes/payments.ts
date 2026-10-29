import { Router, type IRouter } from "express";
import { createHash, timingSafeEqual } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { ReceiveMidtransNotificationBody } from "@workspace/api-zod";
import { db, salonBookings, salonTransactions } from "@workspace/db";
import { settlePendingPayment } from "../lib/payment-settlement";

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
    const [booking] = await tx
      .select()
      .from(salonBookings)
      .where(eq(salonBookings.bookingCode, notice.order_id))
      .limit(1);
    if (!booking) return "NOT_FOUND";
    const [transaction] = await tx
      .select()
      .from(salonTransactions)
      .where(eq(salonTransactions.bookingId, booking.id))
      .limit(1);
    if (!transaction) return "NOT_FOUND";
    if (Math.round(Number(notice.gross_amount)) !== transaction.finalAmount) {
      return "AMOUNT_MISMATCH";
    }
    if (transaction.status === "PAID") return "ALREADY_PAID";
    if (transaction.status !== "PENDING") return "ALREADY_FINAL";
    if (outcome === "PENDING") return "PENDING";

    if (outcome === "FAILED") {
      const [claimedFailure] = await tx
        .update(salonTransactions)
        .set({
          status: "FAILED",
          paymentRef: notice.order_id,
          paidAt: null,
        })
        .where(
          and(
            eq(salonTransactions.id, transaction.id),
            eq(salonTransactions.status, "PENDING"),
          ),
        )
        .returning({ id: salonTransactions.id });
      if (!claimedFailure) return "ALREADY_FINAL";

      await tx
        .update(salonBookings)
        .set({ status: "CANCELLED" })
        .where(eq(salonBookings.id, booking.id));
      return "FAILED";
    }

    const settlement = await settlePendingPayment({
      tx,
      bookingId: booking.id,
      transactionId: transaction.id,
      userId: transaction.userId,
      finalAmount: transaction.finalAmount,
      paymentRef: notice.order_id,
      levelUpNotificationTemplate: (nextLevelName) =>
        `Selamat! Kamu naik ke level ${nextLevelName}. Benefit membership barumu sudah aktif.`,
    });

    if (settlement.status === "PROFILE_MISSING") return "PROFILE_MISSING";
    if (settlement.status === "ALREADY_FINAL") return "ALREADY_FINAL";
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
