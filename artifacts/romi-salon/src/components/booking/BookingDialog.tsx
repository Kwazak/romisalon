import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowRight, CreditCard, X } from "lucide-react";
import {
  type Booking,
  type SalonService,
  getGetAdminBookingsQueryKey,
  getGetAdminDashboardQueryKey,
  getGetAdminTransactionsQueryKey,
  getGetAvailableSlotsQueryKey,
  getGetCurrentUserQueryKey,
  getGetMemberDashboardQueryKey,
  useCompleteMockPayment,
  useCreateBooking,
  useGetAvailableSlots,
  useGetCurrentUser,
} from "@workspace/api-client-react";
import { Action, Field, Loader, Notice } from "@/components/salon-primitives";
import { cx, rupiah, statusId, todayJakarta } from "@/lib/formatters";

export interface BookingDialogProps {
  service: SalonService;
  onClose: () => void;
}

export function BookingDialog({ service, onClose }: BookingDialogProps) {
  const { data: user } = useGetCurrentUser({
    query: { queryKey: getGetCurrentUserQueryKey(), retry: false },
  });
  const [date, setDate] = useState(todayJakarta());
  const slotParams = { serviceId: service.id, date };
  const slotsQuery = useGetAvailableSlots(slotParams, {
    query: {
      queryKey: getGetAvailableSlotsQueryKey(slotParams),
      enabled: Boolean(service.id),
    },
  });
  const createBooking = useCreateBooking();
  const completePayment = useCompleteMockPayment();
  const queryClient = useQueryClient();
  const [, setPath] = useLocation();
  const [selectedSlot, setSelectedSlot] = useState("");
  const [createdBooking, setCreatedBooking] = useState<Booking | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState("");

  const handleBook = () => {
    if (!user) {
      setPath("/login");
      return;
    }
    if (!selectedSlot) {
      setFeedbackMessage("Pilih salah satu waktu yang tersedia.");
      return;
    }
    createBooking.mutate(
      {
        data: {
          serviceId: service.id,
          startTime: `${date}T${selectedSlot}:00+07:00`,
        },
      },
      {
        onSuccess: (booking) => {
          setCreatedBooking(booking);
          void queryClient.invalidateQueries({ queryKey: getGetMemberDashboardQueryKey() });
          void queryClient.invalidateQueries({ queryKey: getGetAdminBookingsQueryKey() });
          void queryClient.invalidateQueries({ queryKey: getGetAdminDashboardQueryKey() });
        },
        onError: () => {
          setFeedbackMessage("Jadwal belum berhasil dipesan. Silakan coba kembali.");
        },
      },
    );
  };

  const handleMockPayment = () => {
    if (!createdBooking) return;
    completePayment.mutate(
      { bookingId: createdBooking.id },
      {
        onSuccess: (result) => {
          setFeedbackMessage(result.message);
          void queryClient.invalidateQueries({ queryKey: getGetMemberDashboardQueryKey() });
          void queryClient.invalidateQueries({ queryKey: getGetAdminTransactionsQueryKey() });
          void queryClient.invalidateQueries({ queryKey: getGetAdminDashboardQueryKey() });
        },
        onError: () => {
          setFeedbackMessage("Pembayaran demo belum berhasil. Coba kembali.");
        },
      },
    );
  };

  const availableSlots = slotsQuery.data?.slots ?? [];

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-[#25131c]/65 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="booking-title"
    >
      <div className="max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-3xl bg-[#faf6f0] p-6 shadow-2xl sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="eyebrow">Buat reservasi</div>
            <h2 id="booking-title" className="mt-2 font-display text-3xl text-[#3b1f2b]">
              {createdBooking ? "Reservasi tercatat" : service.name}
            </h2>
            <p className="mt-2 text-sm text-[#78696a]">
              {createdBooking
                ? `Kode booking: ${createdBooking.bookingCode}`
                : `${service.durationMin} menit · ${rupiah(service.price)}`}
            </p>
          </div>
          <button
            data-testid="button-close-booking"
            onClick={onClose}
            className="rounded-full p-2 text-[#6d595e]"
            aria-label="Tutup"
          >
            <X />
          </button>
        </div>

        {createdBooking ? (
          <div className="mt-7 rounded-2xl bg-[#f0e8de] p-5">
            <p className="text-sm leading-6 text-[#68575a]">
              Status reservasi: <b>{statusId(createdBooking.status)}</b>. {feedbackMessage}
            </p>
            {createdBooking.paymentStatus !== "PAID" && (
              <Action
                className="mt-5 w-full"
                kind="gold"
                onClick={handleMockPayment}
                disabled={completePayment.isPending}
              >
                <CreditCard size={16} />
                {completePayment.isPending ? "Memproses pembayaran…" : "Bayar demo melalui server"}
              </Action>
            )}
            {feedbackMessage && (
              <div className="mt-3 text-sm font-medium text-[#4d7651]">{feedbackMessage}</div>
            )}
          </div>
        ) : (
          <div className="mt-7 grid gap-5">
            <Field
              label="Tanggal kunjungan"
              type="date"
              min={todayJakarta()}
              value={date}
              onChange={(event) => {
                setDate(event.target.value);
                setSelectedSlot("");
              }}
            />

            {slotsQuery.isLoading ? (
              <Loader label="Memuat waktu tersedia" />
            ) : slotsQuery.isError ? (
              <Notice retry={() => void slotsQuery.refetch()}>
                Waktu yang tersedia belum dapat dimuat.
              </Notice>
            ) : availableSlots.length > 0 ? (
              <div>
                <div className="mb-3 text-sm font-semibold">Pilih waktu (WIB)</div>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {availableSlots.map((slot) => (
                    <button
                      key={slot}
                      data-testid={`slot-${slot}`}
                      onClick={() => setSelectedSlot(slot)}
                      className={cx(
                        "rounded-xl border px-3 py-3 text-sm transition",
                        selectedSlot === slot
                          ? "border-[#3b1f2b] bg-[#3b1f2b] text-white"
                          : "border-[#dfd3c4] bg-[#fffdfa] text-[#503f45] hover:border-[#c9a66b]",
                      )}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-xl bg-[#f0e8de] p-4 text-sm text-[#756568]">
                Tidak ada waktu tersedia di tanggal ini. Silakan pilih tanggal lain.
              </div>
            )}

            {feedbackMessage && !createdBooking && (
              <div className="text-sm text-[#b5524a]">{feedbackMessage}</div>
            )}

            <Action className="w-full" onClick={handleBook} disabled={createBooking.isPending}>
              {createBooking.isPending
                ? "Menyimpan reservasi…"
                : user
                  ? "Konfirmasi reservasi"
                  : "Masuk untuk melanjutkan"}{" "}
              <ArrowRight size={16} />
            </Action>

            <p className="text-center text-xs text-[#88797a]">
              Pembayaran demo hanya dianggap berhasil jika dikonfirmasi oleh server.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
