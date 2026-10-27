import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const salonUsers = pgTable(
  "salon_users",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone").notNull().default(""),
    passwordHash: text("password_hash").notNull(),
    role: text("role").notNull().default("MEMBER"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("salon_users_email_idx").on(table.email)],
);

export const membershipLevels = pgTable(
  "salon_membership_levels",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    minSpending: integer("min_spending").notNull().default(0),
    discountPercent: integer("discount_percent").notNull().default(0),
    badgeColor: text("badge_color").notNull().default("#C9A66B"),
    benefits: text("benefits").array().notNull().default([]),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [index("salon_levels_sort_idx").on(table.sortOrder)],
);

export const memberProfiles = pgTable(
  "salon_member_profiles",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => salonUsers.id, { onDelete: "cascade" }),
    totalSpending: integer("total_spending").notNull().default(0),
    points: integer("points").notNull().default(0),
    levelId: text("level_id")
      .notNull()
      .references(() => membershipLevels.id),
    manualLevel: boolean("manual_level").notNull().default(false),
  },
  (table) => [index("salon_profiles_level_idx").on(table.levelId)],
);

export const salonServices = pgTable(
  "salon_services",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    durationMin: integer("duration_min").notNull(),
    price: integer("price").notNull(),
    imageUrl: text("image_url"),
    category: text("category").notNull().default("Perawatan"),
    isActive: boolean("is_active").notNull().default(true),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [index("salon_services_active_idx").on(table.isActive)],
);

export const salonBookings = pgTable(
  "salon_bookings",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => salonUsers.id),
    serviceId: text("service_id")
      .notNull()
      .references(() => salonServices.id),
    startTime: timestamp("start_time", { withTimezone: true }).notNull(),
    endTime: timestamp("end_time", { withTimezone: true }).notNull(),
    status: text("status").notNull().default("PENDING_PAYMENT"),
    bookingCode: text("booking_code").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("salon_bookings_code_idx").on(table.bookingCode),
    index("salon_bookings_user_idx").on(table.userId),
    index("salon_bookings_schedule_idx").on(table.startTime, table.endTime),
    index("salon_bookings_status_idx").on(table.status),
  ],
);

export const salonTransactions = pgTable(
  "salon_transactions",
  {
    id: text("id").primaryKey(),
    bookingId: text("booking_id")
      .notNull()
      .references(() => salonBookings.id),
    userId: text("user_id")
      .notNull()
      .references(() => salonUsers.id),
    amount: integer("amount").notNull(),
    discountAmount: integer("discount_amount").notNull().default(0),
    finalAmount: integer("final_amount").notNull(),
    status: text("status").notNull().default("PENDING"),
    paymentRef: text("payment_ref"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("salon_transactions_booking_idx").on(table.bookingId),
    index("salon_transactions_user_idx").on(table.userId),
    index("salon_transactions_paid_idx").on(table.status, table.paidAt),
  ],
);

export const salonNotifications = pgTable(
  "salon_notifications",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => salonUsers.id, { onDelete: "cascade" }),
    message: text("message").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    readAt: timestamp("read_at", { withTimezone: true }),
  },
  (table) => [index("salon_notifications_user_idx").on(table.userId, table.createdAt)],
);

export const salonSettings = pgTable("salon_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
