const STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: "Menunggu pembayaran",
  CONFIRMED: "Terkonfirmasi",
  COMPLETED: "Selesai",
  CANCELLED: "Dibatalkan",
  PENDING: "Menunggu",
  PAID: "Lunas",
  FAILED: "Gagal",
};

export function rupiah(amount = 0): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function dateId(isoDateString?: string): string {
  if (!isoDateString) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(isoDateString));
}

export function todayJakarta(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
  }).format(new Date());
}

export function statusId(status: string): string {
  return STATUS_LABELS[status] || status;
}

export function cx(...classes: Array<string | false | undefined | null>): string {
  return classes.filter(Boolean).join(" ");
}

export function splitOperatingHour(entry: string): { day: string; time: string } {
  if (entry.includes("·")) {
    const [day = "", time = ""] = entry.split("·");
    return { day: day.trim(), time: time.trim() };
  }
  const match = entry.trim().match(/^(.+?)\s+(\d{1,2}[.:]\d{2}\s*[–-]\s*\d{1,2}[.:]\d{2}.*)$/);
  if (match) {
    return { day: match[1]!.trim(), time: match[2]!.trim() };
  }
  return { day: entry.trim(), time: "" };
}
