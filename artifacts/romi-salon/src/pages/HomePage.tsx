import { useState } from "react";
import {
  ArrowRight,
  Check,
  Clock3,
  Crown,
  Gem,
  Heart,
  Leaf,
  Scissors,
  Sparkles,
} from "lucide-react";
import {
  type SalonService,
  getGetSalonOverviewQueryKey,
  getHealthCheckQueryKey,
  useGetSalonOverview,
  useHealthCheck,
} from "@workspace/api-client-react";
import { BookingDialog } from "@/components/booking/BookingDialog";
import { Shell } from "@/components/layout/Shell";
import { Action, Loader, Notice, SectionTitle } from "@/components/salon-primitives";
import { cx, rupiah, splitOperatingHour } from "@/lib/formatters";

const DEFAULT_HOURS = [
  "Senin – Sabtu · 09.00 – 20.00",
  "Minggu · 10.00 – 17.00",
];

export function HomePage() {
  const health = useHealthCheck({
    query: { queryKey: getHealthCheckQueryKey(), retry: false },
  });
  const overview = useGetSalonOverview({
    query: { queryKey: getGetSalonOverviewQueryKey(), retry: 1 },
  });
  const { data, isLoading, isError, refetch } = overview;
  const [bookingService, setBookingService] = useState<SalonService | null>(null);

  const activeServices = (data?.services ?? []).filter((service) => service.isActive);
  const sortedLevels = [...(data?.levels ?? [])].sort(
    (first, second) => first.sortOrder - second.sortOrder,
  );
  const operatingHours = data?.hours ?? DEFAULT_HOURS;

  return (
    <Shell>
      <main>
        <section className="relative isolate min-h-[690px] overflow-hidden bg-[#3b1f2b] text-[#faf6f0] sm:min-h-[740px]">
          <div
            aria-hidden="true"
            className="salon-hero-poster absolute inset-0 -z-30 bg-cover bg-center"
          />
          <video
            className="salon-hero-video absolute inset-0 -z-20 h-full w-full object-cover opacity-35"
            autoPlay
            muted
            loop
            playsInline
            poster="/images/hero-poster.jpg"
          >
            <source src="/videos/salon.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(43,22,32,.96)_0%,rgba(59,31,43,.78)_48%,rgba(59,31,43,.34)_100%),radial-gradient(ellipse_at_85%_45%,rgba(201,166,107,.25),transparent_45%)]" />
          <div className="mx-auto grid min-h-[690px] max-w-7xl items-center px-5 py-16 sm:min-h-[740px] lg:grid-cols-[1.15fr_.85fr] lg:px-8">
            <div className="max-w-2xl reveal">
              <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#c9a66b]/50 bg-[#faf6f0]/10 px-4 py-2 text-xs tracking-[.14em] text-[#e7c98f]">
                <Sparkles size={14} /> SALON & MEMBERSHIP DI JAKARTA{" "}
                <span
                  className="ml-1 h-1.5 w-1.5 rounded-full bg-[#7a9e7e]"
                  title={health.isError ? "Layanan sedang diperiksa" : "Layanan tersedia"}
                />
              </div>
              <h1 className="font-display text-5xl leading-[1.08] sm:text-6xl lg:text-[76px]">
                Rawat dirimu.
                <br />
                <span className="text-[#e4c38b] italic">Pulang lebih utuh.</span>
              </h1>
              <p className="mt-7 max-w-lg text-base leading-8 text-[#f0e6da]/80 sm:text-lg">
                Perawatan yang dilakukan dengan keahlian, didengar dengan sungguh-sungguh, dan
                selalu dimulai dari kebutuhanmu.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <a
                  href="#layanan"
                  className="btn-gold inline-flex min-h-12 items-center gap-2 rounded-xl px-6 font-semibold"
                >
                  Jelajahi layanan <ArrowRight size={17} />
                </a>
                <a
                  href="#member"
                  className="inline-flex min-h-12 items-center rounded-xl border border-[#faf6f0]/30 px-6 font-semibold text-[#faf6f0] hover:bg-[#faf6f0]/10"
                >
                  Kenali membership
                </a>
              </div>
              <div className="mt-14 flex items-center gap-4 text-sm text-[#eee0d2]/70">
                <span className="h-px w-12 bg-[#c9a66b]" />
                Keahlian yang terasa personal, sejak kunjungan pertama.
              </div>
            </div>

            <div className="relative mt-14 hidden h-[390px] items-center justify-center lg:flex">
              <div className="absolute right-[8%] top-[5%] h-[320px] w-[280px] rotate-3 rounded-[48%_48%_25%_25%] border border-[#d1b685]/50 bg-[radial-gradient(ellipse_at_35%_30%,#c7a78f_0%,#8a5c5b_28%,#492a38_70%)] shadow-2xl" />
              <div className="absolute right-[22%] top-[16%] h-[255px] w-[170px] rounded-[50%_48%_30%_30%] bg-[linear-gradient(125deg,rgba(255,227,193,.38),rgba(102,58,68,.18)_44%,rgba(37,21,30,.75))] shadow-inner" />
              <div className="absolute bottom-7 left-7 rounded-2xl border border-[#e5c790]/25 bg-[#3b1f2b]/75 p-5 backdrop-blur">
                <div className="eyebrow text-[#d5b77f]">Ruang jeda</div>
                <div className="mt-2 font-display text-2xl">Sentuhan ahli.</div>
                <div className="mt-1 text-xs text-[#eadcc9]/70">
                  Hasil yang tetap terasa seperti kamu.
                </div>
              </div>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#faf6f0] to-transparent" />
        </section>

        <section id="layanan" className="mx-auto max-w-7xl scroll-mt-20 px-5 py-20 lg:px-8">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <SectionTitle
              eyebrow="Pilih yang kamu butuhkan"
              title="Perawatan dengan perhatian penuh."
              copy="Ritual yang dipilih bersama, dijalankan dengan teliti, dan disesuaikan untukmu."
            />
            {!isLoading && (
              <a
                href="#booking"
                className="mb-8 hidden items-center gap-2 text-sm font-semibold text-[#8a6340] md:flex"
              >
                Tanya jadwal <ArrowRight size={16} />
              </a>
            )}
          </div>

          {isLoading ? (
            <Loader label="Memuat katalog layanan" />
          ) : isError ? (
            <Notice retry={() => void refetch()}>
              Katalog belum dapat dimuat. Periksa koneksi lalu coba kembali.
            </Notice>
          ) : activeServices.length === 0 ? (
            <div className="soft-card p-10 text-center text-[#756568]">
              Layanan baru sedang kami siapkan. Silakan kembali sebentar lagi.
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {activeServices.map((service, index) => (
                <article
                  key={service.id}
                  className={cx(
                    "soft-card group overflow-hidden p-6 transition-all hover:-translate-y-1 hover:shadow-lg",
                    index === 0 &&
                      "lg:col-span-2 lg:grid lg:grid-cols-[.8fr_1.2fr] lg:items-center lg:gap-8 lg:p-8",
                  )}
                >
                  <div
                    className={cx(
                      "mb-6 grid h-40 place-items-center overflow-hidden rounded-2xl bg-[linear-gradient(140deg,#e8c4c4,#f0dfc7_50%,#d8c7aa)]",
                      index === 0 && "lg:mb-0 lg:h-56",
                    )}
                    style={
                      service.imageUrl
                        ? {
                            backgroundImage: `url("${service.imageUrl}")`,
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                          }
                        : undefined
                    }
                  >
                    <span className="grid h-16 w-16 place-items-center rounded-full border border-white/65 bg-[#faf6f0]/50 text-[#68404b] backdrop-blur">
                      <Scissors size={25} />
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="eyebrow">{service.category || "Perawatan"}</span>
                      <span className="text-xs text-[#867879]">{service.durationMin} menit</span>
                    </div>
                    <h3 className="mt-3 font-display text-2xl text-[#3b1f2b]">{service.name}</h3>
                    <p className="mt-2 min-h-12 text-sm leading-6 text-[#76676a]">
                      {service.description}
                    </p>
                    <div className="mt-5 flex items-center justify-between gap-2">
                      <div>
                        <span className="font-semibold text-[#3b1f2b]">{rupiah(service.price)}</span>
                        <span className="ml-2 text-xs text-[#8a7a7c]">mulai dari</span>
                      </div>
                      <Action kind="outline" onClick={() => setBookingService(service)}>
                        Pesan jadwal <ArrowRight size={15} />
                      </Action>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section id="member" className="scroll-mt-20 bg-[#f0e8de] px-5 py-20">
          <div className="mx-auto max-w-7xl">
            <SectionTitle
              eyebrow="Romi Circle"
              title="Semakin sering merawat diri, semakin banyak kembali."
              copy="Keanggotaan yang tumbuh bersamamu. Setiap kunjungan menambah progres dan membuka manfaat yang lebih personal."
            />
            {isLoading ? (
              <Loader />
            ) : isError ? (
              <Notice retry={() => void refetch()}>Informasi membership belum dapat dimuat.</Notice>
            ) : (
              <div className="grid gap-4 md:grid-cols-3">
                {sortedLevels.map((level, index) => (
                  <article
                    key={level.id}
                    className={cx(
                      "rounded-2xl border p-7 shadow-sm",
                      index === 1
                        ? "border-[#3b1f2b] bg-[#3b1f2b] text-[#faf6f0] md:-translate-y-3"
                        : "border-[#e2d4c1] bg-[#fbf7f0] text-[#3b1f2b]",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={cx(
                          "text-xs font-bold tracking-[.16em]",
                          index === 1 ? "text-[#dfc28c]" : "text-[#98764d]",
                        )}
                      >
                        LEVEL 0{index + 1}
                      </span>
                      {index === 1 ? (
                        <Crown size={19} className="text-[#dfc28c]" />
                      ) : (
                        <Gem size={19} className="text-[#c9a66b]" />
                      )}
                    </div>
                    <h3 className="mt-4 font-display text-3xl">{level.name}</h3>
                    <p
                      className={cx(
                        "mt-2 text-sm",
                        index === 1 ? "text-[#f5eadd]/70" : "text-[#76676a]",
                      )}
                    >
                      Mulai akumulasi {rupiah(level.minSpending)}
                    </p>
                    <div className="my-6 h-px bg-current opacity-15" />
                    <div className="text-4xl font-display">
                      {level.discountPercent}% <span className="text-base font-sans">diskon</span>
                    </div>
                    <ul className="mt-5 grid gap-3 text-sm">
                      {level.benefits.map((benefit) => (
                        <li key={benefit} className="flex gap-2">
                          <Check size={16} className="shrink-0 text-[#c9a66b]" />
                          {benefit}
                        </li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-20 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[.8fr_1.2fr]">
            <div>
              <SectionTitle
                eyebrow="Ruang Romi"
                title="Suasana yang mengundangmu untuk berhenti sejenak."
                copy="Pencahayaan hangat, ritme yang tenang, dan ruang yang disiapkan untuk satu hal: membuatmu merasa disambut."
              />
              <div className="flex items-center gap-3 text-sm text-[#6d595e]">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-[#e8c4c4]/50">
                  <Heart size={17} />
                </span>
                Setiap detail dibuat agar kamu merasa nyaman.
              </div>
            </div>
            <div className="grid h-[340px] grid-cols-5 gap-3 sm:h-[420px]">
              <div className="col-span-3 rounded-[2rem] bg-[radial-gradient(ellipse_at_45%_38%,#e2bfa7_0%,#b88372_28%,#633d47_67%,#3b1f2b_100%)] p-5">
                <span className="rounded-full bg-[#faf6f0]/70 px-3 py-1 text-xs text-[#3b1f2b]">
                  01 / ruang perawatan
                </span>
              </div>
              <div className="col-span-2 grid gap-3">
                <div className="rounded-[2rem] bg-[linear-gradient(140deg,#ddc4a7,#b38177_55%,#60404a)] p-4">
                  <span className="rounded-full bg-[#faf6f0]/75 px-3 py-1 text-xs text-[#3b1f2b]">
                    02 / detail
                  </span>
                </div>
                <div className="rounded-[2rem] bg-[linear-gradient(35deg,#9c765d,#e5c9aa_50%,#bb8b85)] p-4">
                  <span className="rounded-full bg-[#faf6f0]/75 px-3 py-1 text-xs text-[#3b1f2b]">
                    03 / sentuhan
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="cerita" className="bg-[#eaded0] px-5 py-20">
          <div className="mx-auto max-w-7xl">
            <SectionTitle eyebrow="Kata mereka" title="Pengalaman yang tinggal lebih lama." />
            <div className="grid gap-5 md:grid-cols-3">
              {(data?.testimonials ?? []).map((testimonial, index) => (
                <blockquote
                  key={`${testimonial.name}-${index}`}
                  className="rounded-2xl bg-[#faf6f0] p-7 shadow-sm"
                >
                  <div className="mb-5 flex gap-1 text-[#c9a66b]">
                    <span>★★★★★</span>
                  </div>
                  <p className="font-display text-xl leading-8 text-[#3b1f2b]">
                    “{testimonial.quote}”
                  </p>
                  <footer className="mt-6 border-t border-[#e9ded1] pt-4">
                    <div className="font-semibold">{testimonial.name}</div>
                    <div className="mt-1 text-xs text-[#89777a]">{testimonial.service}</div>
                  </footer>
                </blockquote>
              ))}
            </div>
            {!data?.testimonials?.length && !isLoading && (
              <p className="text-sm text-[#76676a]">Cerita tamu Romi akan segera hadir.</p>
            )}
          </div>
        </section>

        <section
          id="lokasi"
          className="mx-auto grid max-w-7xl gap-8 px-5 py-20 lg:grid-cols-[1fr_.85fr] lg:px-8"
        >
          <div>
            <SectionTitle
              eyebrow="Temukan kami"
              title="Datang saat kamu siap."
              copy={data?.address || "Informasi lokasi segera diperbarui."}
            />
            <div className="flex flex-wrap gap-3">
              <a
                href={data?.phone ? `https://wa.me/${data.phone.replace(/\D/g, "")}` : "#lokasi"}
                className="btn-primary inline-flex min-h-11 items-center rounded-xl px-5 text-sm font-semibold"
              >
                Hubungi Romi
              </a>
              <span className="inline-flex items-center gap-2 rounded-xl border border-[#e2d4c1] px-4 text-sm">
                <Leaf size={16} className="text-[#7a9e7e]" />
                Waktu Indonesia Barat
              </span>
            </div>
          </div>

          <div className="soft-card p-7">
            <div className="mb-5 flex items-center gap-3">
              <Clock3 className="text-[#c09b61]" />
              <h3 className="font-display text-2xl">Jam operasional</h3>
            </div>
            <div className="grid gap-3">
              {operatingHours.map((entry, index) => {
                const { day, time } = splitOperatingHour(entry);
                return (
                  <div
                    key={index}
                    className="flex justify-between border-b border-[#eee4d8] pb-3 text-sm text-[#66565a]"
                  >
                    <span>{day}</span>
                    <span className="font-medium">{time}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section id="booking" className="bg-[#3b1f2b] px-5 py-16 text-[#faf6f0]">
          <div className="mx-auto flex max-w-7xl flex-col justify-between gap-6 md:flex-row md:items-center">
            <div>
              <div className="eyebrow text-[#d5b77f]">Langkah pertama</div>
              <h2 className="mt-3 font-display text-3xl sm:text-4xl">
                Waktu untuk dirimu sudah menunggu.
              </h2>
              <p className="mt-3 text-sm text-[#f0e6da]/75">
                Pilih layanan, temukan waktu yang pas, dan kami siapkan sambutan hangat.
              </p>
            </div>
            <Action
              kind="gold"
              onClick={() => activeServices[0] && setBookingService(activeServices[0])}
            >
              Pesan kunjungan <ArrowRight size={16} />
            </Action>
          </div>
        </section>
      </main>

      {bookingService && (
        <BookingDialog service={bookingService} onClose={() => setBookingService(null)} />
      )}
    </Shell>
  );
}
