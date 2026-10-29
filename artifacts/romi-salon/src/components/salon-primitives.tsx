import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { CircleAlert, RefreshCw } from "lucide-react";
import { cx } from "@/lib/formatters";

export interface ActionProps {
  children: ReactNode;
  onClick?: () => void;
  kind?: "dark" | "gold" | "outline" | "quiet" | "danger";
  className?: string;
  type?: "button" | "submit";
  disabled?: boolean;
}

export function Action({
  children,
  onClick,
  kind = "dark",
  className = "",
  type = "button",
  disabled = false,
}: ActionProps) {
  return (
    <button
      data-testid="button-action"
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cx(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50",
        kind === "dark" && "btn-primary",
        kind === "gold" && "btn-gold",
        kind === "outline" && "border border-[#d9cbb7] bg-transparent text-[#3b1f2b] hover:bg-[#f1e9dd]",
        kind === "quiet" && "text-[#654d55] hover:bg-[#f3ece5]",
        kind === "danger" && "bg-[#b5524a] text-[#fff8f1] hover:opacity-90",
        className,
      )}
    >
      {children}
    </button>
  );
}

export type FieldProps = {
  label: string;
} & InputHTMLAttributes<HTMLInputElement>;

export function Field({ label, className, ...props }: FieldProps) {
  return (
    <label className="grid gap-2 text-sm font-medium text-[#4c3940]">
      {label}
      <input
        {...props}
        className={cx(
          "h-12 w-full rounded-xl border border-[#dfd3c4] bg-[#fffdfa] px-4 outline-none transition focus:border-[#c9a66b] focus:ring-2 focus:ring-[#c9a66b]/20",
          className,
        )}
      />
    </label>
  );
}

export type SelectFieldProps = {
  label: string;
  children: ReactNode;
} & SelectHTMLAttributes<HTMLSelectElement>;

export function SelectField({ label, children, ...props }: SelectFieldProps) {
  return (
    <label className="grid gap-2 text-sm font-medium text-[#4c3940]">
      {label}
      <select
        {...props}
        className="h-12 rounded-xl border border-[#dfd3c4] bg-[#fffdfa] px-4 outline-none focus:border-[#c9a66b]"
      >
        {children}
      </select>
    </label>
  );
}

export interface SectionTitleProps {
  eyebrow?: string;
  title: string;
  copy?: string;
}

export function SectionTitle({ eyebrow, title, copy }: SectionTitleProps) {
  return (
    <div className="mb-8 max-w-2xl">
      <div className="eyebrow mb-3">{eyebrow}</div>
      <h2 className="font-display text-3xl leading-tight text-[#3b1f2b] sm:text-4xl">{title}</h2>
      {copy && <p className="mt-3 leading-7 text-[#78696a]">{copy}</p>}
    </div>
  );
}

export interface NoticeProps {
  children: ReactNode;
  retry?: () => void;
}

export function Notice({ children, retry }: NoticeProps) {
  return (
    <div className="soft-card flex flex-col items-center gap-3 p-8 text-center">
      <CircleAlert className="text-[#b5524a]" />
      <p className="max-w-md text-sm text-[#735f62]">{children}</p>
      {retry && (
        <Action kind="outline" onClick={retry}>
          <RefreshCw size={15} /> Coba lagi
        </Action>
      )}
    </div>
  );
}

export interface LoaderProps {
  label?: string;
}

export function Loader({ label = "Memuat informasi…" }: LoaderProps) {
  return (
    <div className="grid gap-4 py-6" aria-label={label}>
      <div className="h-8 w-1/3 animate-pulse rounded-lg bg-[#e9ded1]" />
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="h-32 animate-pulse rounded-2xl bg-[#eee4d8]" />
        <div className="h-32 animate-pulse rounded-2xl bg-[#eee4d8]" />
        <div className="h-32 animate-pulse rounded-2xl bg-[#eee4d8]" />
      </div>
    </div>
  );
}
