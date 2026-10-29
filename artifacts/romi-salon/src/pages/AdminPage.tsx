import { type ReactNode, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import {
  ArrowRight,
  Banknote,
  CalendarDays,
  ChartNoAxesCombined,
   CreditCard,
  Crown,
  Download,
  LayoutDashboard,
  Pencil,
  Plus,
  Scissors,
  Search,
  ShieldCheck,
  Trash2,
  UsersRound,
} from "lucide-react";
import {
  type LevelInput,
  type ServiceInput,
  getGetAdminBookingsQueryKey,
  getGetAdminDashboardQueryKey,
  getGetAdminMembersQueryKey,
  getGetAdminServicesQueryKey,
  getGetAdminTransactionsQueryKey,
  getGetCurrentUserQueryKey,
  getGetMembershipLevelsQueryKey,
  getGetSalonOverviewQueryKey,
  useCreateMembershipLevel,
  useCreateService,
  useDeleteMembershipLevel,
  useDeleteService,
  useGetAdminBookings,
  useGetAdminDashboard,
  useGetAdminMembers,
  useGetAdminServices,
  useGetAdminTransactions,
  useGetCurrentUser,
  useGetMembershipLevels,
  useUpdateBookingStatus,
  useUpdateMemberLevel,
  useUpdateMemberStatus,
  useUpdateMembershipLevel,
  useUpdateService,
} from "@workspace/api-client-react";
import { AdminForm, type AdminModalState } from "@/components/admin/AdminForm";
import { Shell } from "@/components/layout/Shell";
import { Action, Field, Loader, Notice } from "@/components/salon-primitives";
import { cx, dateId, rupiah, statusId } from "@/lib/formatters";

const ADMIN_TABS = [
  { id: "overview", label: "Ringkasan", icon: LayoutDashboard },
  { id: "services", label: "Layanan", icon: Scissors },
  { id: "levels", label: "Membership", icon: Crown },
  { id: "members", label: "Member", icon: UsersRound },
  { id: "bookings", label: "Reservasi", icon: CalendarDays },
  { id: "transactions", label: "Transaksi", icon: Banknote },
] as const;

const TAB_TITLES: Record<string, string> = {
  overview: "Ringkasan",
  services: "Layanan salon",
  levels: "Tingkat membership",
  members: "Daftar member",
  bookings: "Reservasi",
  transactions: "Transaksi",
};

export function AdminPage() {
  const { data: user, isLoading: isUserLoading } = useGetCurrentUser({
    query: { queryKey: getGetCurrentUserQueryKey(), retry: false },
  });
  const [, setPath] = useLocation();
  const [activeTab, setActiveTab] = useState("overview");
  const [memberSearch, setMemberSearch] = useState("");
  const [bookingDateFilter, setBookingDateFilter] = useState("");
  const [modalState, setModalState] = useState<AdminModalState | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const queryClient = useQueryClient();

  const isAdmin = Boolean(user && user.role === "ADMIN");

  const dashboardQuery = useGetAdminDashboard({
    query: { queryKey: getGetAdminDashboardQueryKey(), enabled: isAdmin, retry: false },
  });
  const servicesQuery = useGetAdminServices({
    query: { queryKey: getGetAdminServicesQueryKey(), enabled: isAdmin, retry: false },
  });
  const levelsQuery = useGetMembershipLevels({
    query: { queryKey: getGetMembershipLevelsQueryKey(), enabled: isAdmin, retry: false },
  });

  const memberParams = { search: memberSearch || undefined };
  const membersQuery = useGetAdminMembers(memberParams, {
    query: {
      queryKey: getGetAdminMembersQueryKey(memberParams),
      enabled: isAdmin,
      retry: false,
    },
  });

  const bookingParams = { date: bookingDateFilter || undefined };
  const bookingsQuery = useGetAdminBookings(bookingParams, {
    query: {
      queryKey: getGetAdminBookingsQueryKey(bookingParams),
      enabled: isAdmin,
      retry: false,
    },
  });

  const transactionsQuery = useGetAdminTransactions({
    query: { queryKey: getGetAdminTransactionsQueryKey(), enabled: isAdmin, retry: false },
  });

  const createService = useCreateService();
  const updateService = useUpdateService();
  const deleteService = useDeleteService();
  const createLevel = useCreateMembershipLevel();
  const updateLevel = useUpdateMembershipLevel();
  const deleteLevel = useDeleteMembershipLevel();
  const updateMemberLevel = useUpdateMemberLevel();
  const updateMemberStatus = useUpdateMemberStatus();
  const updateBookingStatus = useUpdateBookingStatus();

  const invalidateQuery = (queryKey: readonly unknown[]) => {
    void queryClient.invalidateQueries({ queryKey });
  };

  if (isUserLoading) {
    return (
      <Shell>
        <main className="mx-auto max-w-7xl px-5 py-10">
          <Loader />
        </main>
      </Shell>
    );
  }

  if (!user || user.role !== "ADMIN") {
    return (
      <Shell>
        <main className="mx-auto max-w-xl px-5 py-16 text-center">
          <div className="soft-card p-10">
            <ShieldCheck className="mx-auto text-[#c9a66b]" size={38} />
            <h1 className="mt-4 font-display text-3xl">Akses khusus tim Romi.</h1>
            <p className="mt-3 text-sm text-[#76676a]">
              Masuk menggunakan akun admin untuk mengelola salon.
            </p>
            <Action className="mt-6" onClick={() => setPath("/login")}>
              Masuk sebagai admin
            </Action>
          </div>
        </main>
      </Shell>
    );
  }

  const renderQueryState = (
    query: { isLoading: boolean; isError: boolean; refetch: () => unknown; data?: unknown },
    content: ReactNode,
  ) => {
    if (query.isLoading) return <Loader />;
    if (query.isError) {
      return (
        <Notice retry={() => void query.refetch()}>Informasi belum berhasil dimuat.</Notice>
      );
    }
    return content;
  };

  const handleExportCsv = () => {
    const rows = (transactionsQuery.data ?? []).map((transaction) => [
      transaction.bookingId,
      transaction.memberName,
      transaction.serviceName,
      transaction.amount,
      transaction.discountAmount,
      transaction.finalAmount,
      transaction.status,
      transaction.createdAt,
    ]);
    const csvContent = [
      ["ID Reservasi", "Nama Member", "Layanan", "Harga", "Diskon", "Total", "Status", "Waktu"],
      ...rows,
    ]
      .map((row) =>
        row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(","),
      )
      .join("\n");

    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(
      new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8" }),
    );
    anchor.download = "transaksi-romi-salon.csv";
    anchor.click();
    URL.revokeObjectURL(anchor.href);
  };

  const handleChangeBookingStatus = (
    bookingId: string,
    status: "CONFIRMED" | "COMPLETED" | "CANCELLED",
  ) => {
    updateBookingStatus.mutate(
      { bookingId, data: { status } },
      {
        onSuccess: () => {
          setFeedbackMessage("Status reservasi diperbarui.");
          invalidateQuery(getGetAdminBookingsQueryKey());
          invalidateQuery(getGetAdminDashboardQueryKey());
          invalidateQuery(getGetAdminTransactionsQueryKey());
        },
        onError: () => {
          setFeedbackMessage("Status reservasi belum berhasil diperbarui.");
        },
      },
    );
  };

  const handleSaveModal = (data: ServiceInput | LevelInput) => {
    if (!modalState) return;
    if (modalState.kind === "service") {
      const serviceInput = data as ServiceInput;
      if (modalState.item) {
        updateService.mutate(
          { serviceId: modalState.item.id, data: serviceInput },
          {
            onSuccess: () => {
              invalidateQuery(getGetAdminServicesQueryKey());
              setModalState(null);
            },
            onError: () => setFeedbackMessage("Perubahan layanan belum tersimpan."),
          },
        );
      } else {
        createService.mutate(
          { data: serviceInput },
          {
            onSuccess: () => {
              invalidateQuery(getGetAdminServicesQueryKey());
              invalidateQuery(getGetSalonOverviewQueryKey());
              setModalState(null);
            },
            onError: () => setFeedbackMessage("Layanan belum berhasil ditambahkan."),
          },
        );
      }
    } else {
      const levelInput = data as LevelInput;
      if (modalState.item) {
        updateLevel.mutate(
          { levelId: modalState.item.id, data: levelInput },
          {
            onSuccess: () => {
              invalidateQuery(getGetMembershipLevelsQueryKey());
              invalidateQuery(getGetSalonOverviewQueryKey());
              setModalState(null);
            },
            onError: () => setFeedbackMessage("Perubahan tingkat belum tersimpan."),
          },
        );
      } else {
        createLevel.mutate(
          { data: levelInput },
          {
            onSuccess: () => {
              invalidateQuery(getGetMembershipLevelsQueryKey());
              invalidateQuery(getGetSalonOverviewQueryKey());
              setModalState(null);
            },
            onError: () => setFeedbackMessage("Tingkat belum berhasil ditambahkan."),
          },
        );
      }
    }
  };

  const summaryMetrics = [
    {
      label: "Pendapatan hari ini",
      value: rupiah(dashboardQuery.data?.todayRevenue),
      icon: Banknote,
    },
    {
      label: "Pendapatan bulan ini",
      value: rupiah(dashboardQuery.data?.monthRevenue),
      icon: ChartNoAxesCombined,
    },
    {
      label: "Total transaksi",
      value: (dashboardQuery.data?.transactionCount ?? 0).toLocaleString("id-ID"),
      icon: CreditCard,
    },
    {
      label: "Member baru",
      value: (dashboardQuery.data?.newMembers ?? 0).toLocaleString("id-ID"),
      icon: UsersRound,
    },
  ];

  const revenueTrend = dashboardQuery.data?.revenueTrend ?? [];
  const maxTrendRevenue = Math.max(1, ...revenueTrend.map((point) => point.amount));

  return (
    <Shell>
      <main className="min-h-[calc(100dvh-150px)] bg-[#f6f0e8]">
        <div className="mx-auto max-w-[1440px] lg:grid lg:grid-cols-[240px_1fr]">
          <aside className="hidden min-h-[calc(100dvh-80px)] bg-[#3b1f2b] p-5 text-[#faf6f0] lg:block">
            <div className="mb-7 px-3 pt-3">
              <div className="eyebrow text-[#d1b27b]">Ruang pengelola</div>
              <div className="mt-2 font-display text-2xl">Romi Salon</div>
            </div>
            <nav className="grid gap-1">
              {ADMIN_TABS.map((navItem) => (
                <button
                  key={navItem.id}
                  data-testid={`admin-tab-${navItem.id}`}
                  onClick={() => setActiveTab(navItem.id)}
                  className={cx(
                    "flex items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition",
                    activeTab === navItem.id
                      ? "bg-[#faf6f0] text-[#3b1f2b]"
                      : "text-[#eadccf]/75 hover:bg-white/10",
                  )}
                >
                  <navItem.icon size={17} />
                  {navItem.label}
                </button>
              ))}
            </nav>
            <div className="mt-12 rounded-2xl border border-white/10 p-4">
              <div className="text-sm font-medium">{user.name}</div>
              <div className="mt-1 text-xs text-[#eadccf]/60">Pengelola</div>
              <Link href="/" className="mt-4 inline-flex text-xs text-[#d5b77f]">
                Lihat tampilan salon <ArrowRight size={13} className="ml-1" />
              </Link>
            </div>
          </aside>

          <section className="px-5 py-6 sm:px-8 lg:px-10">
            <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="eyebrow">Panel pengelolaan · WIB</div>
                <h1 className="mt-2 font-display text-3xl text-[#3b1f2b]">
                  {TAB_TITLES[activeTab]}
                </h1>
              </div>
              <div className="flex items-center gap-2">
                <select
                  data-testid="admin-mobile-tabs"
                  className="h-10 rounded-xl border border-[#dfd3c4] bg-[#faf6f0] px-3 text-sm lg:hidden"
                  value={activeTab}
                  onChange={(event) => setActiveTab(event.target.value)}
                >
                  {ADMIN_TABS.map((navItem) => (
                    <option value={navItem.id} key={navItem.id}>
                      {navItem.label}
                    </option>
                  ))}
                </select>
                <span className="hidden rounded-full bg-[#e5ede3] px-3 py-2 text-xs font-semibold text-[#55785a] sm:inline-flex">
                  ● Sistem aktif
                </span>
              </div>
            </div>

            {feedbackMessage && (
              <div role="status" className="mb-5 rounded-xl bg-[#e6eee5] p-3 text-sm text-[#486d4b]">
                {feedbackMessage}
              </div>
            )}

            {activeTab === "overview" &&
              renderQueryState(
                dashboardQuery,
                <div>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {summaryMetrics.map((metric) => (
                      <div className="soft-card p-5" key={metric.label}>
                        <div className="flex justify-between text-sm text-[#78696a]">
                          {metric.label}
                          <metric.icon size={17} className="text-[#b18a53]" />
                        </div>
                        <div className="mt-4 font-display text-2xl text-[#3b1f2b]">
                          {metric.value}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
                    <div className="soft-card p-6">
                      <div className="flex items-center justify-between">
                        <h2 className="font-display text-2xl">Pergerakan pendapatan</h2>
                        <span className="text-xs text-[#88777a]">IDR</span>
                      </div>
                      <div className="mt-8 flex h-52 items-end gap-3 border-b border-l border-[#e9ded1] px-3">
                        {revenueTrend.map((point) => (
                          <div
                            key={point.label}
                            className="flex h-full flex-1 flex-col items-center justify-end gap-2"
                          >
                            <div
                              title={rupiah(point.amount)}
                              className="w-full max-w-12 rounded-t-lg bg-[#c9a66b] transition-all hover:bg-[#3b1f2b]"
                              style={{
                                height: `${Math.max(5, (point.amount / maxTrendRevenue) * 100)}%`,
                              }}
                            />
                            <span className="text-[10px] text-[#88777a]">{point.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="soft-card p-6">
                      <h2 className="font-display text-2xl">Layanan favorit</h2>
                      <div className="mt-5 grid gap-3">
                        {(dashboardQuery.data?.topServices ?? []).map((serviceName, index) => (
                          <div key={serviceName} className="flex items-center gap-3">
                            <span className="grid h-8 w-8 place-items-center rounded-full bg-[#f2e7d8] text-xs font-semibold text-[#8c6e45]">
                              0{index + 1}
                            </span>
                            <span className="text-sm">{serviceName}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 soft-card p-6">
                    <h2 className="font-display text-2xl">Reservasi berikutnya</h2>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {dashboardQuery.data?.upcomingBookings?.map((booking) => (
                        <div key={booking.id} className="rounded-xl bg-[#f5eee5] p-4">
                          <div className="font-semibold">
                            {booking.memberName} · {booking.serviceName}
                          </div>
                          <div className="mt-1 text-xs text-[#817174]">
                            {dateId(booking.startTime)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>,
              )}

            {activeTab === "services" && (
              <div>
                {renderQueryState(
                  servicesQuery,
                  <div>
                    <div className="mb-4 flex justify-end">
                      <Action kind="gold" onClick={() => setModalState({ kind: "service" })}>
                        <Plus size={16} /> Tambah layanan
                      </Action>
                    </div>
                    <div className="soft-card overflow-hidden">
                      {servicesQuery.data?.length ? (
                        servicesQuery.data.map((service) => (
                          <div
                            key={service.id}
                            className="flex flex-wrap items-center justify-between gap-4 border-b border-[#eee4d8] p-5 last:border-0"
                          >
                            <div>
                              <div className="font-semibold">
                                {service.name}
                                <span
                                  className={cx(
                                    "ml-2 rounded-full px-2 py-1 text-[10px]",
                                    service.isActive
                                      ? "bg-[#e4eee2] text-[#4e7551]"
                                      : "bg-[#f6e4e0] text-[#a14f49]",
                                  )}
                                >
                                  {service.isActive ? "Aktif" : "Nonaktif"}
                                </span>
                              </div>
                              <div className="mt-1 text-xs text-[#857578]">
                                {service.category} · {service.durationMin} menit ·{" "}
                                {rupiah(service.price)}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Action
                                kind="outline"
                                onClick={() => setModalState({ kind: "service", item: service })}
                              >
                                <Pencil size={14} /> Ubah
                              </Action>
                              <Action
                                kind="danger"
                                onClick={() => {
                                  if (confirm(`Hapus layanan ${service.name}?`)) {
                                    deleteService.mutate(
                                      { serviceId: service.id },
                                      {
                                        onSuccess: () =>
                                          invalidateQuery(getGetAdminServicesQueryKey()),
                                        onError: () =>
                                          setFeedbackMessage("Layanan tidak dapat dihapus."),
                                      },
                                    );
                                  }
                                }}
                              >
                                <Trash2 size={14} />
                              </Action>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="p-8 text-sm text-[#76676a]">
                          Belum ada layanan. Tambahkan layanan pertama.
                        </div>
                      )}
                    </div>
                  </div>,
                )}
              </div>
            )}

            {activeTab === "levels" && (
              <div>
                {renderQueryState(
                  levelsQuery,
                  <div>
                    <div className="mb-4 flex justify-end">
                      <Action kind="gold" onClick={() => setModalState({ kind: "level" })}>
                        <Plus size={16} /> Tambah tingkat
                      </Action>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {(levelsQuery.data ?? []).map((level) => (
                        <article key={level.id} className="soft-card p-6">
                          <div className="flex justify-between">
                            <span className="eyebrow">{level.discountPercent}% diskon</span>
                            <span className="text-xs text-[#89787b]">Urutan {level.sortOrder}</span>
                          </div>
                          <h3 className="mt-3 font-display text-2xl">{level.name}</h3>
                          <p className="mt-2 text-sm text-[#76676a]">
                            Mulai {rupiah(level.minSpending)}
                          </p>
                          <ul className="mt-4 grid gap-2 text-xs text-[#69585d]">
                            {level.benefits.map((benefit) => (
                              <li key={benefit}>• {benefit}</li>
                            ))}
                          </ul>
                          <div className="mt-5 flex gap-2">
                            <Action
                              kind="outline"
                              className="flex-1"
                              onClick={() => setModalState({ kind: "level", item: level })}
                            >
                              <Pencil size={14} /> Ubah
                            </Action>
                            <Action
                              kind="danger"
                              onClick={() => {
                                if (confirm(`Hapus tingkat ${level.name}?`)) {
                                  deleteLevel.mutate(
                                    { levelId: level.id },
                                    {
                                      onSuccess: () =>
                                        invalidateQuery(getGetMembershipLevelsQueryKey()),
                                      onError: () =>
                                        setFeedbackMessage("Tingkat tidak dapat dihapus."),
                                    },
                                  );
                                }
                              }}
                            >
                              <Trash2 size={14} />
                            </Action>
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>,
                )}
              </div>
            )}

            {activeTab === "members" && (
              <div>
                {renderQueryState(
                  membersQuery,
                  <div>
                    <div className="mb-4 flex items-center gap-3">
                      <label className="relative flex-1">
                        <Search size={16} className="absolute left-4 top-3.5 text-[#877578]" />
                        <input
                          data-testid="input-member-search"
                          className="h-12 w-full rounded-xl border border-[#dfd3c4] bg-[#faf6f0] pl-11 pr-4 text-sm outline-none focus:border-[#c9a66b]"
                          placeholder="Cari nama, email, atau nomor telepon…"
                          value={memberSearch}
                          onChange={(event) => setMemberSearch(event.target.value)}
                        />
                      </label>
                    </div>
                    <div className="soft-card overflow-x-auto">
                      <table className="w-full min-w-[760px] text-left text-sm">
                        <thead className="bg-[#f2e9de] text-xs text-[#796b6d]">
                          <tr>
                            {[
                              "Member",
                              "Tingkat",
                              "Total perawatan",
                              "Poin",
                              "Status",
                              "Aksi",
                            ].map((heading) => (
                              <th key={heading} className="px-4 py-3 font-semibold">
                                {heading}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {(membersQuery.data ?? []).map((member) => (
                            <tr key={member.id} className="border-t border-[#eee4d8]">
                              <td className="px-4 py-4">
                                <div className="font-semibold">{member.name}</div>
                                <div className="text-xs text-[#867679]">
                                  {member.email} · {member.phone}
                                </div>
                              </td>
                              <td className="px-4 py-4">
                                <select
                                  aria-label={`Tingkat ${member.name}`}
                                  value={member.levelId}
                                  onChange={(event) =>
                                    updateMemberLevel.mutate(
                                      {
                                        userId: member.id,
                                        data: { levelId: event.target.value },
                                      },
                                      {
                                        onSuccess: () =>
                                          invalidateQuery(
                                            getGetAdminMembersQueryKey(memberParams),
                                          ),
                                        onError: () =>
                                          setFeedbackMessage(
                                            "Tingkat member belum berhasil diubah.",
                                          ),
                                      },
                                    )
                                  }
                                  className="rounded-lg border border-[#dfd3c4] bg-white px-2 py-2"
                                >
                                  {(levelsQuery.data ?? []).map((level) => (
                                    <option key={level.id} value={level.id}>
                                      {level.name}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="px-4 py-4">{rupiah(member.totalSpending)}</td>
                              <td className="px-4 py-4">
                                {member.points.toLocaleString("id-ID")}
                              </td>
                              <td className="px-4 py-4">
                                <span
                                  className={cx(
                                    "rounded-full px-2 py-1 text-xs",
                                    member.isActive
                                      ? "bg-[#e4eee2] text-[#4e7551]"
                                      : "bg-[#f6e4e0] text-[#a14f49]",
                                  )}
                                >
                                  {member.isActive ? "Aktif" : "Nonaktif"}
                                </span>
                              </td>
                              <td className="px-4 py-4">
                                <Action
                                  kind="outline"
                                  onClick={() =>
                                    updateMemberStatus.mutate(
                                      {
                                        userId: member.id,
                                        data: { isActive: !member.isActive },
                                      },
                                      {
                                        onSuccess: () =>
                                          invalidateQuery(
                                            getGetAdminMembersQueryKey(memberParams),
                                          ),
                                        onError: () =>
                                          setFeedbackMessage(
                                            "Status member belum berhasil diperbarui.",
                                          ),
                                      },
                                    )
                                  }
                                >
                                  {member.isActive ? "Nonaktifkan" : "Aktifkan"}
                                </Action>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {!membersQuery.data?.length && (
                        <div className="p-8 text-center text-sm text-[#76676a]">
                          Member belum ditemukan.
                        </div>
                      )}
                    </div>
                  </div>,
                )}
              </div>
            )}

            {activeTab === "bookings" && (
              <div>
                {renderQueryState(
                  bookingsQuery,
                  <div>
                    <div className="mb-4 flex max-w-xs items-center gap-3">
                      <Field
                        label="Saring tanggal (WIB)"
                        type="date"
                        value={bookingDateFilter}
                        onChange={(event) => setBookingDateFilter(event.target.value)}
                      />
                    </div>
                    <div className="soft-card overflow-x-auto">
                      <table className="w-full min-w-[770px] text-left text-sm">
                        <thead className="bg-[#f2e9de] text-xs text-[#796b6d]">
                          <tr>
                            {[
                              "Reservasi",
                              "Member",
                              "Jadwal",
                              "Pembayaran",
                              "Total",
                              "Status & tindakan",
                            ].map((heading) => (
                              <th key={heading} className="px-4 py-3">
                                {heading}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {(bookingsQuery.data ?? []).map((booking) => (
                            <tr key={booking.id} className="border-t border-[#eee4d8]">
                              <td className="px-4 py-4">
                                <b>{booking.serviceName}</b>
                                <div className="text-xs text-[#867679]">{booking.bookingCode}</div>
                              </td>
                              <td className="px-4 py-4">{booking.memberName}</td>
                              <td className="px-4 py-4">{dateId(booking.startTime)}</td>
                              <td className="px-4 py-4">{statusId(booking.paymentStatus)}</td>
                              <td className="px-4 py-4">{rupiah(booking.finalAmount)}</td>
                              <td className="px-4 py-4">
                                <select
                                  aria-label={`Status ${booking.bookingCode}`}
                                  value={booking.status}
                                  onChange={(event) =>
                                    handleChangeBookingStatus(
                                      booking.id,
                                      event.target.value as
                                        | "CONFIRMED"
                                        | "COMPLETED"
                                        | "CANCELLED",
                                    )
                                  }
                                  className="rounded-lg border border-[#dfd3c4] bg-white px-2 py-2"
                                >
                                  <option value="PENDING_PAYMENT" disabled>
                                    Menunggu pembayaran
                                  </option>
                                  <option value="CONFIRMED">Terkonfirmasi</option>
                                  <option value="COMPLETED">Selesai</option>
                                  <option value="CANCELLED">Dibatalkan</option>
                                </select>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {!bookingsQuery.data?.length && (
                        <div className="p-8 text-center text-sm text-[#76676a]">
                          Tidak ada reservasi pada tanggal tersebut.
                        </div>
                      )}
                    </div>
                  </div>,
                )}
              </div>
            )}

            {activeTab === "transactions" && (
              <div>
                {renderQueryState(
                  transactionsQuery,
                  <div>
                    <div className="mb-4 flex justify-end">
                      <Action kind="outline" onClick={handleExportCsv}>
                        <Download size={15} /> Ekspor CSV
                      </Action>
                    </div>
                    <div className="soft-card overflow-x-auto">
                      <table className="w-full min-w-[720px] text-left text-sm">
                        <thead className="bg-[#f2e9de] text-xs text-[#796b6d]">
                          <tr>
                            {[
                              "Member",
                              "Layanan",
                              "Harga",
                              "Diskon",
                              "Total",
                              "Status",
                              "Tanggal",
                            ].map((heading) => (
                              <th key={heading} className="px-4 py-3">
                                {heading}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {(transactionsQuery.data ?? []).map((transaction) => (
                            <tr key={transaction.id} className="border-t border-[#eee4d8]">
                              <td className="px-4 py-4">{transaction.memberName}</td>
                              <td className="px-4 py-4">{transaction.serviceName}</td>
                              <td className="px-4 py-4">{rupiah(transaction.amount)}</td>
                              <td className="px-4 py-4">{rupiah(transaction.discountAmount)}</td>
                              <td className="px-4 py-4 font-semibold">
                                {rupiah(transaction.finalAmount)}
                              </td>
                              <td className="px-4 py-4">{transaction.status}</td>
                              <td className="px-4 py-4">{dateId(transaction.createdAt)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {!transactionsQuery.data?.length && (
                        <div className="p-8 text-center text-sm text-[#76676a]">
                          Belum ada transaksi.
                        </div>
                      )}
                    </div>
                  </div>,
                )}
              </div>
            )}
          </section>
        </div>
      </main>

      {modalState && (
        <AdminForm
          modal={modalState}
          onClose={() => setModalState(null)}
          onSave={handleSaveModal}
        />
      )}
    </Shell>
  );
}
