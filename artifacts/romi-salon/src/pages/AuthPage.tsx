import { type FormEvent, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { ArrowRight, Sparkles } from "lucide-react";
import {
  getGetCurrentUserQueryKey,
  useLogin,
  useRegisterMember,
} from "@workspace/api-client-react";
import { Shell } from "@/components/layout/Shell";
import { Action, Field } from "@/components/salon-primitives";

export interface AuthPageProps {
  mode: "login" | "register";
}

interface AuthFormValues {
  name: string;
  email: string;
  phone: string;
  password: string;
}

export function AuthPage({ mode }: AuthPageProps) {
  const loginMutation = useLogin();
  const registerMutation = useRegisterMember();
  const queryClient = useQueryClient();
  const [, setPath] = useLocation();
  const [errorMessage, setErrorMessage] = useState("");
  const [formValues, setFormValues] = useState<AuthFormValues>({
    name: "",
    email: "",
    phone: "",
    password: "",
  });

  const updateField = (field: keyof AuthFormValues, value: string) => {
    setFormValues((previous) => ({ ...previous, [field]: value }));
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setErrorMessage("");

    const handleAuthSuccess = (user: { role: string }) => {
      queryClient.setQueryData(getGetCurrentUserQueryKey(), user);
      setPath(user.role === "ADMIN" ? "/admin" : "/member");
    };

    if (mode === "register") {
      registerMutation.mutate(
        { data: formValues },
        {
          onSuccess: handleAuthSuccess,
          onError: () => {
            setErrorMessage("Pendaftaran belum berhasil. Periksa kembali data yang kamu masukkan.");
          },
        },
      );
    } else {
      loginMutation.mutate(
        { data: { email: formValues.email, password: formValues.password } },
        {
          onSuccess: handleAuthSuccess,
          onError: () => {
            setErrorMessage("Email atau kata sandi belum sesuai.");
          },
        },
      );
    }
  };

  const isSubmitting = loginMutation.isPending || registerMutation.isPending;

  return (
    <Shell>
      <main className="mx-auto grid min-h-[calc(100dvh-150px)] max-w-7xl items-center gap-10 px-5 py-12 lg:grid-cols-[1fr_.8fr] lg:px-8">
        <div className="hidden rounded-[2rem] bg-[#3b1f2b] p-12 text-[#faf6f0] lg:block">
          <div className="eyebrow text-[#d5b77f]">Romi Circle</div>
          <h1 className="mt-5 font-display text-5xl leading-tight">
            {mode === "register"
              ? "Perawatan yang baik terasa lebih baik bersama."
              : "Senang bertemu lagi."}
          </h1>
          <p className="mt-6 max-w-md leading-7 text-[#f0e6da]/75">
            Kelola kunjunganmu, lihat progres membership, dan temukan manfaat yang tumbuh seiring
            waktumu bersama Romi.
          </p>
          <div className="mt-14 flex gap-3 text-[#d9c79e]">
            <Sparkles />
            <span className="text-sm">Waktu untukmu, dengan perhatian penuh.</span>
          </div>
        </div>

        <section className="mx-auto w-full max-w-md">
          <div className="eyebrow">
            {mode === "register" ? "Bergabung dengan Romi Circle" : "Romi Salon"}
          </div>
          <h2 className="mt-3 font-display text-4xl text-[#3b1f2b]">
            {mode === "register" ? "Mulai perjalananmu." : "Masuk ke akunmu."}
          </h2>
          <p className="mt-3 text-sm leading-6 text-[#7b6b6d]">
            {mode === "register"
              ? "Buat akun untuk memesan jadwal dan mengumpulkan manfaat."
              : "Lanjutkan perjalanan perawatanmu bersama kami."}
          </p>

          <form onSubmit={handleSubmit} className="mt-8 grid gap-4">
            {mode === "register" && (
              <>
                <Field
                  label="Nama lengkap"
                  autoComplete="name"
                  required
                  minLength={2}
                  value={formValues.name}
                  onChange={(event) => updateField("name", event.target.value)}
                />
                <Field
                  label="Nomor telepon"
                  type="tel"
                  autoComplete="tel"
                  required
                  minLength={8}
                  value={formValues.phone}
                  onChange={(event) => updateField("phone", event.target.value)}
                />
              </>
            )}

            <Field
              label="Alamat email"
              type="email"
              autoComplete="email"
              required
              value={formValues.email}
              onChange={(event) => updateField("email", event.target.value)}
            />

            <Field
              label="Kata sandi"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
              minLength={8}
              value={formValues.password}
              onChange={(event) => updateField("password", event.target.value)}
            />

            {errorMessage && (
              <div role="alert" className="rounded-xl bg-[#f8e7e2] p-3 text-sm text-[#994a45]">
                {errorMessage}
              </div>
            )}

            <Action type="submit" className="mt-2 w-full" disabled={isSubmitting}>
              {isSubmitting ? "Memproses…" : mode === "register" ? "Buat akun member" : "Masuk"}{" "}
              <ArrowRight size={16} />
            </Action>
          </form>

          <div className="mt-6 text-center text-sm text-[#76676a]">
            {mode === "register" ? "Sudah menjadi member?" : "Belum menjadi member?"}{" "}
            <Link
              href={mode === "register" ? "/login" : "/register"}
              className="font-semibold text-[#8a6340]"
            >
              {mode === "register" ? "Masuk" : "Daftar di sini"}
            </Link>
          </div>

          {mode === "login" && (
            <div className="mt-8 rounded-2xl border border-[#e5d9cb] bg-[#f4ede3] p-4">
              <div className="text-xs font-bold uppercase tracking-[.14em] text-[#96734b]">
                Akun demo
              </div>
              <div className="mt-3 grid gap-2 text-xs text-[#69585d] sm:grid-cols-2">
                <button
                  data-testid="demo-admin"
                  className="rounded-lg bg-[#faf6f0] p-3 text-left hover:bg-white"
                  onClick={() =>
                    setFormValues({
                      name: "",
                      email: "admin@romisalon.id",
                      phone: "",
                      password: "RomiAdmin2026!",
                    })
                  }
                >
                  <b>Admin</b>
                  <br />
                  admin@romisalon.id
                </button>
                <button
                  data-testid="demo-member"
                  className="rounded-lg bg-[#faf6f0] p-3 text-left hover:bg-white"
                  onClick={() =>
                    setFormValues({
                      name: "",
                      email: "member@romisalon.id",
                      phone: "",
                      password: "RomiMember2026!",
                    })
                  }
                >
                  <b>Member</b>
                  <br />
                  member@romisalon.id
                </button>
              </div>
              <p className="mt-2 text-[10px] leading-4 text-[#88797a]">
                Klik akun untuk mengisi kredensial demo yang disediakan server.
              </p>
            </div>
          )}
        </section>
      </main>
    </Shell>
  );
}
