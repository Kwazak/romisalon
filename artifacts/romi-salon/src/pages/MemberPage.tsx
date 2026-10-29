import { type FormEvent, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { CreditCard, Crown, Gem, Pencil, X } from "lucide-react";
import {
  type Booking,
  getGetAdminDashboardQueryKey,
  getGetAdminTransactionsQueryKey,
  getGetCurrentUserQueryKey,
  getGetMemberDashboardQueryKey,
  useCancelMemberBooking,
  useCompleteMockPayment,
  useGetMemberDashboard,
  useUpdateMemberPassword,
  useUpdateMemberProfile,
} from "@workspace/api-client-react";
import { Shell } from "@/components/layout/Shell";
import { Action, Field, Loader, Notice, SectionTitle } from "@/components/salon-primitives";
import { cx, dateId, rupiah, statusId } from "@/lib/formatters";

export function MemberPage() {
  const dashboardQuery = useGetMemberDashboard({
    query: { queryKey: getGetMemberDashboardQueryKey(), retry: false },
  });
  const cancelBooking = useCancelMemberBooking();
  const completePayment = useCompleteMockPayment();
  const updateProfile = useUpdateMemberProfile();
  const changePassword = useUpdateMemberPassword();
  const queryClient = useQueryClient();

  const [, setPath] = useLocation();
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [statusNotice, setStatusNotice] = useState("");
  const [profileName, setProfileName] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordFeedback, setPasswordFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  if (dashboardQuery.isLoading) {
    return (
      <Shell>
        <main className="mx-auto max-w-7xl px-5 py-12">
          <Loader />
        </main>
      </Shell>
    );
  }

  if (dashboardQuery.isError || !dashboardQuery.data) {
    return (
      <Shell>
        <main className="mx-auto max-w-2xl px-5 py-16">
          <Notice retry={() => void dashboardQuery.refetch()}>
            Masuk sebagai member untuk membuka ruang pribadimu.
          </Notice>
          <div className="mt-4 text-center">
            <Action onClick={() => setPath("/login")}>Masuk ke akun</Action>
          </div>
        </main>
      </Shell>
    );
  }

  const dashboard = dashboardQuery.data;
  const targetSpending = dashboard.nextLevel?.minSpending ?? dashboard.level.minSpending;
  const spendingProgress = dashboard.nextLevel
    ? Math.min(100, Math.round((dashboard.totalSpending / targetSpending) * 100))
    : 100;

  const handleStartEditProfile = () => {
    setProfileName(dashboard.user.name);
    setProfilePhone(dashboard.user.phone);
    setIsEditingProfile(true);
  };

  const handleSaveProfile = (event: FormEvent) => {
    event.preventDefault();
    updateProfile.mutate(
      { data: { name: profileName, phone: profilePhone } },
      {
        onSuccess: () => {
          setIsEditingProfile(false);
          setStatusNotice("Profil berhasil diperbarui.");
          void queryClient.invalidateQueries({ queryKey: getGetMemberDashboardQueryKey() });
          void queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
        },
        onError: () => {
          setStatusNotice("Profil belum berhasil disimpan.");
        },
      },
    );
  };

  const handleSavePassword = (event: FormEvent) => {
    event.preventDefault();
    setPasswordFeedback(null);

    if (newPassword !== confirmPassword) {
      setPasswordFeedback({
        type: "error",
        text: "Konfirmasi kata sandi baru belum sama.",
      });
      return;
    }

    changePassword.mutate(
      { data: { currentPassword, newPassword } },
      {
        onSuccess: () => {
          setCurrentPassword("");
          setNewPassword("");
          setConfirmPassword("");
          setPasswordFeedback({
            type: "success",
            text: "Kata sandi berhasil diperbarui.",
          });
        },
        onError: () => {
          setPasswordFeedback({
            type: "error",
            text: "Kata sandi saat ini tidak sesuai atau perubahan belum berhasil. Silakan coba kembali.",
          });
        },
      },
    );
  };

  const handleMockPayment = (booking: Booking) => {
    completePayment.mutate(
      { bookingId: booking.id },
      {
        onSuccess: (result) => {
          setStatusNotice(result.message);
          void queryClient.invalidateQueries({ queryKey: getGetMemberDashboardQueryKey() });
          void queryClient.invalidateQueries({ queryKey: getGetAdminTransactionsQueryKey() });
          void queryClient.invalidateQueries({ queryKey: getGetAdminDashboardQueryKey() });
        },
        onError: () => {
          setStatusNotice("Pembayaran demo belum berhasil.");
        },
      },
    );
  };

  return (
    <Shell>
      <main className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="eyebrow">Romi Circle / Ruang member</div>
            <h1 className="mt-2 font-display text-4xl text-[#3b1f2b]">
              Selamat datang, {dashboard.user.name.split(" ")[0]}.
            </h1>
            <p className="mt-2 text-sm text-[#78696a]">
              Waktu untuk dirimu, tersusun dalam satu tempat.
            </p>
          </div>
          <Action kind="outline" onClick={handleStartEditProfile}>
            <Pencil size={15} /> Edit profil
          </Action>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
          <section className="relative overflow-hidden rounded-3xl bg-[#3b1f2b] p-7 text-[#faf6f0] shadow-lg sm:p-9">
            <div className="absolute -right-10 -top-16 h-64 w-64 rounded-full border border-[#c9a66b]/20" />
            <div className="absolute -right-1 -top-6 h-44 w-44 rounded-full border border-[#c9a66b]/20" />
            <div className="relative flex items-start justify-between">
              <div>
                <div className="text-xs tracking-[.18em] text-[#d4b67f]">ROMI CIRCLE MEMBER</div>
                <h2 className="mt-3 font-display text-4xl">{dashboard.level.name}</h2>
                <div className="mt-2 text-sm text-[#f0e6da]/75">
                  Terdaftar sebagai {dashboard.user.name}
                </div>
              </div>
              <div className="grid h-12 w-12 place-items-center rounded-full border border-[#d6b77e]/50 text-[#d6b77e]">
                <Crown />
              </div>
            </div>
            <div className="relative mt-12 grid grid-cols-2 gap-5 border-t border-white/15 pt-5">
              <div>
                <div className="text-xs text-[#f0e6da]/65">Total perawatan</div>
                <div className="mt-1 font-display text-2xl">{rupiah(dashboard.totalSpending)}</div>
              </div>
              <div>
                <div className="text-xs text-[#f0e6da]/65">Poin terkumpul</div>
                <div className="mt-1 font-display text-2xl">
                  {dashboard.points.toLocaleString("id-ID")} poin
                </div>
              </div>
            </div>
          </section>

          <section className="soft-card p-7">
            <div className="flex items-center justify-between">
              <div>
                <div className="eyebrow">Progres berikutnya</div>
                <h2 className="mt-2 font-display text-2xl">
                  {dashboard.nextLevel ? dashboard.nextLevel.name : "Level terbaik tercapai"}
                </h2>
              </div>
              <span className="grid h-11 w-11 place-items-center rounded-full bg-[#f1e6d4] text-[#a57d48]">
                <Gem />
              </span>
            </div>
            <div className="mt-7 h-3 overflow-hidden rounded-full bg-[#eee5da]">
              <div
                className="h-full rounded-full bg-[#c9a66b] transition-all"
                style={{ width: `${spendingProgress}%` }}
              />
            </div>
            <div className="mt-3 flex justify-between text-xs text-[#867679]">
              <span>{rupiah(dashboard.totalSpending)} terkumpul</span>
              <span>{dashboard.nextLevel ? rupiah(dashboard.nextLevel.minSpending) : "100%"}</span>
            </div>
            <p className="mt-5 text-sm text-[#736467]">
              {dashboard.nextLevel
                ? `Teruskan perawatanmu — ${dashboard.pointsToNextLevel.toLocaleString("id-ID")} poin lagi untuk langkah berikutnya.`
                : "Seluruh manfaat Romi Circle kini menjadi milikmu."}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {dashboard.level.benefits.map((benefit) => (
                <span
                  key={benefit}
                  className="rounded-full bg-[#f5eee4] px-3 py-2 text-xs text-[#6e555a]"
                >
                  {benefit}
                </span>
              ))}
            </div>
          </section>
        </div>

        <section className="soft-card mt-8 p-6 sm:p-8">
          <div className="grid gap-7 lg:grid-cols-[.7fr_1fr] lg:items-start">
            <div>
              <div className="eyebrow">Keamanan akun</div>
              <h2 className="mt-2 font-display text-3xl text-[#3b1f2b]">Perbarui kata sandi.</h2>
              <p className="mt-3 max-w-sm text-sm leading-6 text-[#78696a]">
                Gunakan kata sandi baru yang berbeda dan mudah kamu ingat. Minimal delapan karakter.
              </p>
            </div>
            <form onSubmit={handleSavePassword} className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Kata sandi saat ini"
                type="password"
                autoComplete="current-password"
                required
                minLength={8}
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                className="sm:col-span-2"
              />
              <Field
                label="Kata sandi baru"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
              <Field
                label="Konfirmasi kata sandi baru"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
              {passwordFeedback && (
                <div
                  role={passwordFeedback.type === "error" ? "alert" : "status"}
                  className={cx(
                    "rounded-xl p-3 text-sm sm:col-span-2",
                    passwordFeedback.type === "success"
                      ? "bg-[#e6eee5] text-[#486d4b]"
                      : "bg-[#f8e7e2] text-[#994a45]",
                  )}
                >
                  {passwordFeedback.text}
                </div>
              )}
              <div className="sm:col-span-2">
                <Action type="submit" disabled={changePassword.isPending}>
                  {changePassword.isPending ? "Menyimpan kata sandi…" : "Simpan kata sandi"}
                </Action>
                {changePassword.isPending && (
                  <p role="status" aria-live="polite" className="mt-2 text-sm text-[#78696a]">
                    Perubahan kata sandi sedang diproses dengan aman.
                  </p>
                )}
              </div>
            </form>
          </div>
        </section>

        {statusNotice && (
          <div role="status" className="mt-5 rounded-xl bg-[#e6eee5] p-3 text-sm text-[#486d4b]">
            {statusNotice}
          </div>
        )}

        <div className="mt-10 grid gap-8 lg:grid-cols-[1.15fr_.85fr]">
          <section>
            <SectionTitle eyebrow="Jadwalmu" title="Kunjungan mendatang." />
            <div className="grid gap-3">
              {dashboard.bookings.length > 0 ? (
                dashboard.bookings.map((booking) => (
                  <article
                    key={booking.id}
                    className="soft-card flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center"
                  >
                    <div>
                      <div className="font-semibold text-[#3b1f2b]">{booking.serviceName}</div>
                      <div className="mt-1 text-xs text-[#817174]">
                        {dateId(booking.startTime)} · {booking.bookingCode}
                      </div>
                      <div className="mt-2 text-xs">
                        Status: <b>{statusId(booking.status)}</b> · Pembayaran:{" "}
                        <b>{statusId(booking.paymentStatus)}</b>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {booking.paymentStatus !== "PAID" && booking.status !== "CANCELLED" && (
                        <Action
                          kind="gold"
                          onClick={() => handleMockPayment(booking)}
                          disabled={completePayment.isPending}
                        >
                          <CreditCard size={14} />
                          Bayar demo
                        </Action>
                      )}
                      {booking.status !== "CANCELLED" && booking.status !== "COMPLETED" && (
                        <Action
                          kind="outline"
                          onClick={() =>
                            cancelBooking.mutate(
                              { bookingId: booking.id },
                              {
                                onSuccess: () =>
                                  void queryClient.invalidateQueries({
                                    queryKey: getGetMemberDashboardQueryKey(),
                                  }),
                                onError: () => setStatusNotice("Reservasi belum dapat dibatalkan."),
                              },
                            )
                          }
                          disabled={cancelBooking.isPending}
                        >
                          Batalkan
                        </Action>
                      )}
                    </div>
                  </article>
                ))
              ) : (
                <div className="soft-card p-7 text-sm text-[#76676a]">
                  Belum ada reservasi. Kunjungan berikutnya bisa dimulai kapan saja.
                </div>
              )}
            </div>
          </section>

          <section>
            <SectionTitle eyebrow="Riwayat" title="Transaksi." />
            <div className="soft-card overflow-hidden">
              {dashboard.transactions.length > 0 ? (
                dashboard.transactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="flex items-center justify-between gap-3 border-b border-[#eee4d8] p-4 last:border-0"
                  >
                    <div>
                      <div className="text-sm font-semibold">{transaction.serviceName}</div>
                      <div className="mt-1 text-xs text-[#867679]">
                        {dateId(transaction.createdAt)} · {statusId(transaction.status)}
                      </div>
                    </div>
                    <div className="text-sm font-semibold">{rupiah(transaction.finalAmount)}</div>
                  </div>
                ))
              ) : (
                <div className="p-7 text-sm text-[#76676a]">
                  Riwayat transaksi akan tampil di sini.
                </div>
              )}
            </div>

            <div className="mt-6 rounded-2xl bg-[#f0e8de] p-5">
              <div className="eyebrow">Pembaruan Romi</div>
              {dashboard.notifications.length > 0 ? (
                dashboard.notifications.map((notification, index) => (
                  <p key={index} className="mt-3 text-sm leading-6 text-[#69585d]">
                    {notification}
                  </p>
                ))
              ) : (
                <p className="mt-3 text-sm text-[#69585d]">Belum ada kabar baru.</p>
              )}
            </div>
          </section>
        </div>
      </main>

      {isEditingProfile && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center bg-[#25131c]/60 p-4"
        >
          <form
            onSubmit={handleSaveProfile}
            className="grid w-full max-w-md gap-4 rounded-3xl bg-[#faf6f0] p-7"
          >
            <div className="flex justify-between">
              <h2 className="font-display text-3xl">Edit profil</h2>
              <button
                type="button"
                onClick={() => setIsEditingProfile(false)}
                aria-label="Tutup"
              >
                <X />
              </button>
            </div>
            <Field
              label="Nama lengkap"
              required
              minLength={2}
              value={profileName}
              onChange={(event) => setProfileName(event.target.value)}
            />
            <Field
              label="Nomor telepon"
              required
              minLength={8}
              value={profilePhone}
              onChange={(event) => setProfilePhone(event.target.value)}
            />
            <Action type="submit" disabled={updateProfile.isPending}>
              {updateProfile.isPending ? "Menyimpan…" : "Simpan perubahan"}
            </Action>
          </form>
        </div>
      )}
    </Shell>
  );
}
