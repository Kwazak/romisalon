import { Router, type IRouter } from "express";
import { asc, eq, inArray } from "drizzle-orm";
import { GetSalonOverviewResponse } from "@workspace/api-zod";
import { db, membershipLevels, salonServices, salonSettings } from "@workspace/db";

const router: IRouter = Router();

router.get("/salon/overview", async (_req, res): Promise<void> => {
  const [serviceRows, levelRows, settingRows] = await Promise.all([
    db.select().from(salonServices).where(eq(salonServices.isActive, true)).orderBy(asc(salonServices.name)),
    db.select().from(membershipLevels).orderBy(asc(membershipLevels.sortOrder)),
    db.select().from(salonSettings).where(inArray(salonSettings.key, ["salon_address", "salon_phone", "opening_hours"])),
  ]);
  const settings = new Map(settingRows.map((row) => [row.key, row.value]));
  const overview = {
    services: serviceRows.map((service) => ({ ...service, deletedAt: undefined })),
    levels: levelRows,
    testimonials: [
      { name: "Alya P.", quote: "Suasananya nyaman, hasil perawatannya juga terasa personal. Saya selalu pulang dengan lebih percaya diri.", service: "Creambath Signature" },
      { name: "Maya R.", quote: "Konsultasinya detail dan tidak terburu-buru. Facial-nya jadi ritual me-time favorit saya.", service: "Radiance Facial" },
      { name: "Dina S.", quote: "Potongannya pas sekali dengan bentuk wajah. Tim Romi Salon ramah dari awal sampai akhir.", service: "Haircut & Styling" },
    ],
    gallery: [
      { src: "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1000&q=85", alt: "Interior salon yang hangat dan elegan" },
      { src: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=1000&q=85", alt: "Stylist sedang menata rambut pelanggan" },
      { src: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=1000&q=85", alt: "Hasil riasan dengan sentuhan natural" },
    ],
    address: settings.get("salon_address") ?? "Jl. Senopati No. 21, Kebayoran Baru, Jakarta Selatan",
    phone: settings.get("salon_phone") ?? "+62 812-3456-7890",
    hours: settings.has("opening_hours")
      ? JSON.parse(settings.get("opening_hours") ?? "[]") as string[]
      : ["Senin–Jumat 09.00–20.00", "Sabtu–Minggu 10.00–18.00"],
  };
  res.json(GetSalonOverviewResponse.parse(overview));
});

export default router;
