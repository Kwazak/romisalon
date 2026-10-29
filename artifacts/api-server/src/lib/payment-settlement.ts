import { randomUUID } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import {
  type db,
  membershipLevels,
  memberProfiles,
  salonBookings,
  salonNotifications,
  salonSettings,
  salonTransactions,
} from "@workspace/db";

export type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface SettlePendingPaymentInput {
  tx: DbTransaction;
  bookingId: string;
  transactionId: string;
  userId: string;
  finalAmount: number;
  paymentRef: string;
  levelUpNotificationTemplate?: (nextLevelName: string) => string;
}

export type SettlePendingPaymentResult =
  | { status: "SETTLED" }
  | { status: "ALREADY_FINAL" }
  | { status: "PROFILE_MISSING" };

export async function settlePendingPayment({
  tx,
  bookingId,
  transactionId,
  userId,
  finalAmount,
  paymentRef,
  levelUpNotificationTemplate = (nextLevelName) =>
    `Selamat! Kamu naik ke level ${nextLevelName}. Nikmati benefit membership barumu.`,
}: SettlePendingPaymentInput): Promise<SettlePendingPaymentResult> {
  const [profile] = await tx
    .select()
    .from(memberProfiles)
    .where(eq(memberProfiles.userId, userId))
    .limit(1);

  if (!profile) {
    return { status: "PROFILE_MISSING" };
  }

  const paidAt = new Date();
  const [claimedPayment] = await tx
    .update(salonTransactions)
    .set({
      status: "PAID",
      paymentRef,
      paidAt,
    })
    .where(
      and(
        eq(salonTransactions.id, transactionId),
        eq(salonTransactions.status, "PENDING"),
      ),
    )
    .returning({ id: salonTransactions.id });

  if (!claimedPayment) {
    return { status: "ALREADY_FINAL" };
  }

  await tx
    .update(salonBookings)
    .set({ status: "CONFIRMED" })
    .where(eq(salonBookings.id, bookingId));

  const [pointsSetting] = await tx
    .select()
    .from(salonSettings)
    .where(eq(salonSettings.key, "points_per_rupiah"))
    .limit(1);

  const pointsRatio = Number(pointsSetting?.value ?? "0.001");
  const totalSpending = profile.totalSpending + finalAmount;
  const points = profile.points + Math.floor(finalAmount * pointsRatio);

  const [currentLevel] = await tx
    .select()
    .from(membershipLevels)
    .where(eq(membershipLevels.id, profile.levelId))
    .limit(1);

  const sortedLevels = await tx
    .select()
    .from(membershipLevels)
    .orderBy(asc(membershipLevels.sortOrder));

  const earnedLevel = [...sortedLevels]
    .reverse()
    .find((level) => totalSpending >= level.minSpending);

  const nextLevelId = profile.manualLevel
    ? profile.levelId
    : (earnedLevel?.id ?? profile.levelId);

  const [nextLevel] = await tx
    .select()
    .from(membershipLevels)
    .where(eq(membershipLevels.id, nextLevelId))
    .limit(1);

  await tx
    .update(memberProfiles)
    .set({
      totalSpending,
      points,
      levelId: nextLevelId,
    })
    .where(eq(memberProfiles.userId, userId));

  if (nextLevel && currentLevel && nextLevel.sortOrder > currentLevel.sortOrder) {
    await tx.insert(salonNotifications).values({
      id: randomUUID(),
      userId,
      message: levelUpNotificationTemplate(nextLevel.name),
    });
  }

  return { status: "SETTLED" };
}
