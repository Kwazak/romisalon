import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { db, membershipLevels, memberProfiles, salonBookings, salonNotifications, salonServices, salonSettings, salonTransactions, salonUsers } from "@workspace/db";

async function ensureSalonSchema(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS salon_users (
      id text PRIMARY KEY,
      name text NOT NULL,
      email text NOT NULL,
      phone text NOT NULL DEFAULT '',
      password_hash text NOT NULL,
      role text NOT NULL DEFAULT 'MEMBER',
      is_active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS salon_users_email_idx ON salon_users (email);

    CREATE TABLE IF NOT EXISTS salon_membership_levels (
      id text PRIMARY KEY,
      name text NOT NULL,
      min_spending integer NOT NULL DEFAULT 0,
      discount_percent integer NOT NULL DEFAULT 0,
      badge_color text NOT NULL DEFAULT '#C9A66B',
      benefits text[] NOT NULL DEFAULT '{}',
      sort_order integer NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS salon_levels_sort_idx ON salon_membership_levels (sort_order);

    CREATE TABLE IF NOT EXISTS salon_member_profiles (
      user_id text PRIMARY KEY REFERENCES salon_users(id) ON DELETE CASCADE,
      total_spending integer NOT NULL DEFAULT 0,
      points integer NOT NULL DEFAULT 0,
      level_id text NOT NULL REFERENCES salon_membership_levels(id),
      manual_level boolean NOT NULL DEFAULT false
    );
    CREATE INDEX IF NOT EXISTS salon_profiles_level_idx ON salon_member_profiles (level_id);

    CREATE TABLE IF NOT EXISTS salon_services (
      id text PRIMARY KEY,
      name text NOT NULL,
      description text NOT NULL DEFAULT '',
      duration_min integer NOT NULL,
      price integer NOT NULL,
      image_url text,
      category text NOT NULL DEFAULT 'Perawatan',
      is_active boolean NOT NULL DEFAULT true,
      deleted_at timestamptz
    );
    CREATE INDEX IF NOT EXISTS salon_services_active_idx ON salon_services (is_active);

    CREATE TABLE IF NOT EXISTS salon_bookings (
      id text PRIMARY KEY,
      user_id text NOT NULL REFERENCES salon_users(id),
      service_id text NOT NULL REFERENCES salon_services(id),
      start_time timestamptz NOT NULL,
      end_time timestamptz NOT NULL,
      status text NOT NULL DEFAULT 'PENDING_PAYMENT',
      booking_code text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS salon_bookings_code_idx ON salon_bookings (booking_code);
    CREATE INDEX IF NOT EXISTS salon_bookings_user_idx ON salon_bookings (user_id);
    CREATE INDEX IF NOT EXISTS salon_bookings_schedule_idx ON salon_bookings (start_time, end_time);
    CREATE INDEX IF NOT EXISTS salon_bookings_status_idx ON salon_bookings (status);

    CREATE TABLE IF NOT EXISTS salon_transactions (
      id text PRIMARY KEY,
      booking_id text NOT NULL REFERENCES salon_bookings(id),
      user_id text NOT NULL REFERENCES salon_users(id),
      amount integer NOT NULL,
      discount_amount integer NOT NULL DEFAULT 0,
      final_amount integer NOT NULL,
      status text NOT NULL DEFAULT 'PENDING',
      payment_ref text,
      paid_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS salon_transactions_booking_idx ON salon_transactions (booking_id);
    CREATE INDEX IF NOT EXISTS salon_transactions_user_idx ON salon_transactions (user_id);
    CREATE INDEX IF NOT EXISTS salon_transactions_paid_idx ON salon_transactions (status, paid_at);

    CREATE TABLE IF NOT EXISTS salon_notifications (
      id text PRIMARY KEY,
      user_id text NOT NULL REFERENCES salon_users(id) ON DELETE CASCADE,
      message text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      read_at timestamptz
    );
    CREATE INDEX IF NOT EXISTS salon_notifications_user_idx ON salon_notifications (user_id, created_at);

    CREATE TABLE IF NOT EXISTS salon_settings (
      key text PRIMARY KEY,
      value text NOT NULL
    );
  `);
}

const levels = [
  { id: "level-bronze", name: "Bronze", minSpending: 0, discountPercent: 0, badgeColor: "#9C6B4D", sortOrder: 0, benefits: ["Poin dari setiap transaksi", "Prioritas informasi promo"] },
  { id: "level-silver", name: "Silver", minSpending: 300_000, discountPercent: 5, badgeColor: "#89939B", sortOrder: 1, benefits: ["Diskon 5% perawatan", "Poin dari setiap transaksi", "Prioritas informasi promo"] },
  { id: "level-gold", name: "Gold", minSpending: 1_000_000, discountPercent: 10, badgeColor: "#C9A66B", sortOrder: 2, benefits: ["Diskon 10% perawatan", "Poin ganda pada bulan ulang tahun", "Reservasi prioritas"] },
  { id: "level-platinum", name: "Platinum", minSpending: 2_500_000, discountPercent: 15, badgeColor: "#74566C", sortOrder: 3, benefits: ["Diskon 15% perawatan", "Poin ganda setiap transaksi", "Reservasi prioritas", "Konsultasi kecantikan gratis"] },
];

const services = [
  { id: "svc-haircut", name: "Haircut & Styling", description: "Potongan presisi dan styling yang dirancang untuk karakter rambutmu.", durationMin: 60, price: 180_000, imageUrl: null, category: "Rambut", isActive: true },
  { id: "svc-creambath", name: "Creambath Signature", description: "Ritual creambath dengan pijatan relaksasi dan nutrisi rambut pilihan.", durationMin: 75, price: 220_000, imageUrl: null, category: "Rambut", isActive: true },
  { id: "svc-facial", name: "Radiance Facial", description: "Perawatan wajah menyeluruh untuk kulit terasa segar dan bercahaya.", durationMin: 90, price: 320_000, imageUrl: null, category: "Wajah", isActive: true },
];

export async function seedSalonData(): Promise<void> {
  await ensureSalonSchema();
  for (const level of levels) {
    await db.insert(membershipLevels).values(level).onConflictDoNothing();
  }
  for (const service of services) {
    await db.insert(salonServices).values(service).onConflictDoNothing();
  }

  const adminHash = await bcrypt.hash("RomiAdmin2026!", 12);
  const memberHash = await bcrypt.hash("RomiMember2026!", 12);
  await db
    .insert(salonUsers)
    .values([
      { id: "demo-admin", name: "Romi Salon Admin", email: "admin@romisalon.id", phone: "081234567890", passwordHash: adminHash, role: "ADMIN", isActive: true },
      { id: "demo-member", name: "Nadia Putri", email: "member@romisalon.id", phone: "081298765432", passwordHash: memberHash, role: "MEMBER", isActive: true },
    ])
    .onConflictDoNothing();
  await db
    .insert(memberProfiles)
    .values({ userId: "demo-member", totalSpending: 1_296_000, points: 1296, levelId: "level-gold" })
    .onConflictDoNothing();

  await db
    .insert(salonSettings)
    .values([
      { key: "points_per_rupiah", value: "0.001" },
      { key: "opening_hours", value: JSON.stringify(["Senin – Jumat · 09.00 – 20.00", "Sabtu – Minggu · 10.00 – 18.00"]) },
      { key: "slot_capacity", value: "1" },
      { key: "salon_address", value: "Jl. Senopati No. 21, Kebayoran Baru, Jakarta Selatan" },
      { key: "salon_phone", value: "+62 812-3456-7890" },
    ])
    .onConflictDoNothing();

  const [existingSeedBooking] = await db
    .select({ id: salonBookings.id })
    .from(salonBookings)
    .where(eq(salonBookings.id, "demo-booking-1"))
    .limit(1);
  if (!existingSeedBooking) {
    const sampleRows = [
      { serviceId: "svc-facial", price: 320_000 },
      { serviceId: "svc-creambath", price: 220_000 },
      { serviceId: "svc-haircut", price: 180_000 },
      { serviceId: "svc-facial", price: 320_000 },
      { serviceId: "svc-creambath", price: 220_000 },
      { serviceId: "svc-haircut", price: 180_000 },
    ];
    const now = Date.now();
    for (const [index, item] of sampleRows.entries()) {
      const startTime = new Date(now - (index + 1) * 86_400_000);
      startTime.setHours(11 + (index % 4), 0, 0, 0);
      const service = services.find((candidate) => candidate.id === item.serviceId)!;
      const bookingId = `demo-booking-${index + 1}`;
      const transactionId = `demo-transaction-${index + 1}`;
      const discountAmount = Math.round(item.price * 0.1);
      await db.insert(salonBookings).values({
        id: bookingId,
        userId: "demo-member",
        serviceId: item.serviceId,
        startTime,
        endTime: new Date(startTime.getTime() + service.durationMin * 60_000),
        status: index === 0 ? "CONFIRMED" : "COMPLETED",
        bookingCode: `ROMI-DEMO-${String(index + 1).padStart(3, "0")}`,
        createdAt: startTime,
      });
      await db.insert(salonTransactions).values({
        id: transactionId,
        bookingId,
        userId: "demo-member",
        amount: item.price,
        discountAmount,
        finalAmount: item.price - discountAmount,
        status: "PAID",
        paymentRef: `DEMO-${index + 1}`,
        paidAt: startTime,
        createdAt: startTime,
      });
    }
    await db.insert(salonNotifications).values({
      id: "demo-notification-gold",
      userId: "demo-member",
      message: "Selamat! Kamu sudah mencapai level Gold. Nikmati diskon 10% di kunjungan berikutnya.",
    }).onConflictDoNothing();
  }
}
