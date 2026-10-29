import { type FormEvent, useState } from "react";
import { X } from "lucide-react";
import type {
  LevelInput,
  MembershipLevel,
  SalonService,
  ServiceInput,
} from "@workspace/api-client-react";
import { Action, Field } from "@/components/salon-primitives";

export interface AdminModalState {
  kind: "service" | "level";
  item?: SalonService | MembershipLevel;
}

export interface AdminFormProps {
  modal: AdminModalState;
  onClose: () => void;
  onSave: (data: ServiceInput | LevelInput) => void;
}

interface AdminFormState {
  name: string;
  description: string;
  durationMin: string;
  price: string;
  imageUrl: string;
  category: string;
  isActive: boolean;
  minSpending: string;
  discountPercent: string;
  badgeColor: string;
  benefits: string;
  sortOrder: string;
}

export function AdminForm({ modal, onClose, onSave }: AdminFormProps) {
  const existingService =
    modal.kind === "service" ? (modal.item as SalonService | undefined) : undefined;
  const existingLevel =
    modal.kind === "level" ? (modal.item as MembershipLevel | undefined) : undefined;

  const [values, setValues] = useState<AdminFormState>({
    name: existingService?.name || existingLevel?.name || "",
    description: existingService?.description || "",
    durationMin: String(existingService?.durationMin ?? 60),
    price: String(existingService?.price ?? ""),
    imageUrl: existingService?.imageUrl || "",
    category: existingService?.category || "Perawatan",
    isActive: existingService?.isActive ?? true,
    minSpending: String(existingLevel?.minSpending ?? ""),
    discountPercent: String(existingLevel?.discountPercent ?? 0),
    badgeColor: existingLevel?.badgeColor || "#C9A66B",
    benefits: existingLevel?.benefits.join("\n") || "",
    sortOrder: String(existingLevel?.sortOrder ?? 0),
  });

  const updateField = <K extends keyof AdminFormState>(field: K, value: AdminFormState[K]) => {
    setValues((previous) => ({ ...previous, [field]: value }));
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (modal.kind === "service") {
      onSave({
        name: values.name,
        description: values.description,
        durationMin: Number(values.durationMin),
        price: Number(values.price),
        imageUrl: values.imageUrl || null,
        category: values.category,
        isActive: values.isActive,
      });
    } else {
      onSave({
        name: values.name,
        minSpending: Number(values.minSpending),
        discountPercent: Number(values.discountPercent),
        badgeColor: values.badgeColor,
        benefits: values.benefits
          .split("\n")
          .map((benefit) => benefit.trim())
          .filter(Boolean),
        sortOrder: Number(values.sortOrder),
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#25131c]/60 p-4">
      <form
        onSubmit={handleSubmit}
        className="max-h-[90dvh] w-full max-w-xl overflow-auto rounded-3xl bg-[#faf6f0] p-7 shadow-2xl"
      >
        <div className="mb-6 flex items-start justify-between">
          <div>
            <div className="eyebrow">{modal.item ? "Perbarui data" : "Data baru"}</div>
            <h2 className="mt-2 font-display text-3xl">
              {modal.kind === "service"
                ? existingService
                  ? "Ubah layanan"
                  : "Tambah layanan"
                : existingLevel
                  ? "Ubah tingkat"
                  : "Tambah tingkat"}
            </h2>
          </div>
          <button type="button" aria-label="Tutup" onClick={onClose}>
            <X />
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Nama"
            required
            minLength={2}
            value={values.name}
            onChange={(event) => updateField("name", event.target.value)}
          />

          {modal.kind === "service" ? (
            <>
              <Field
                label="Kategori"
                required
                value={values.category}
                onChange={(event) => updateField("category", event.target.value)}
              />
              <Field
                label="Durasi (menit)"
                type="number"
                min={10}
                required
                value={values.durationMin}
                onChange={(event) => updateField("durationMin", event.target.value)}
              />
              <Field
                label="Harga (Rp)"
                type="number"
                min={0}
                required
                value={values.price}
                onChange={(event) => updateField("price", event.target.value)}
              />
              <Field
                label="URL gambar (opsional)"
                value={values.imageUrl}
                onChange={(event) => updateField("imageUrl", event.target.value)}
              />
              <label className="flex items-center gap-3 text-sm sm:col-span-2">
                <input
                  type="checkbox"
                  checked={values.isActive}
                  onChange={(event) => updateField("isActive", event.target.checked)}
                />
                Layanan aktif dan dapat dipesan
              </label>
              <label className="grid gap-2 text-sm sm:col-span-2">
                Deskripsi
                <textarea
                  required
                  rows={3}
                  value={values.description}
                  onChange={(event) => updateField("description", event.target.value)}
                  className="rounded-xl border border-[#dfd3c4] bg-white p-3 outline-none focus:border-[#c9a66b]"
                />
              </label>
            </>
          ) : (
            <>
              <Field
                label="Minimal belanja (Rp)"
                type="number"
                min={0}
                required
                value={values.minSpending}
                onChange={(event) => updateField("minSpending", event.target.value)}
              />
              <Field
                label="Diskon (%)"
                type="number"
                min={0}
                max={100}
                required
                value={values.discountPercent}
                onChange={(event) => updateField("discountPercent", event.target.value)}
              />
              <Field
                label="Warna badge"
                type="color"
                value={values.badgeColor}
                onChange={(event) => updateField("badgeColor", event.target.value)}
              />
              <Field
                label="Urutan"
                type="number"
                min={0}
                value={values.sortOrder}
                onChange={(event) => updateField("sortOrder", event.target.value)}
              />
              <label className="grid gap-2 text-sm sm:col-span-2">
                Manfaat (satu per baris)
                <textarea
                  rows={4}
                  value={values.benefits}
                  onChange={(event) => updateField("benefits", event.target.value)}
                  className="rounded-xl border border-[#dfd3c4] bg-white p-3 outline-none focus:border-[#c9a66b]"
                />
              </label>
            </>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Action kind="outline" onClick={onClose}>
            Batal
          </Action>
          <Action type="submit" kind="gold">
            Simpan
          </Action>
        </div>
      </form>
    </div>
  );
}
