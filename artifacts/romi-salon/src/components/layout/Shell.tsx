import { type ReactNode, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { ArrowRight, Menu, Scissors, X } from "lucide-react";
import {
  getGetCurrentUserQueryKey,
  useGetCurrentUser,
  useLogout,
} from "@workspace/api-client-react";
import { Action } from "@/components/salon-primitives";

export interface ShellProps {
  children: ReactNode;
}

export function Shell({ children }: ShellProps) {
  const { data: user } = useGetCurrentUser({
    query: { queryKey: getGetCurrentUserQueryKey(), retry: false },
  });
  const logout = useLogout();
  const [, setPath] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const queryClient = useQueryClient();

  const handleSignOut = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        queryClient.setQueryData(getGetCurrentUserQueryKey(), null);
        setPath("/");
      },
    });
  };

  return (
    <div className="page-shell">
      <header className="relative z-30 border-b border-[#e6dccc] bg-[#faf6f0]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
          <Link href="/" className="flex items-center gap-3 text-[#3b1f2b] no-underline">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-[#3b1f2b] text-[#c9a66b]">
              <Scissors size={19} />
            </span>
            <span>
              <span className="block font-display text-xl leading-none">Romi Salon</span>
              <span className="mt-1 block text-[9px] tracking-[.23em] text-[#9a7a56]">
                RAWAT • TENANG • BERSAMA
              </span>
            </span>
          </Link>

          <nav className="hidden items-center gap-7 text-sm text-[#5f5051] md:flex">
            <Link className="hover:text-[#9a7047]" href="/#layanan">
              Layanan
            </Link>
            <Link className="hover:text-[#9a7047]" href="/#member">
              Membership
            </Link>
            <Link className="hover:text-[#9a7047]" href="/#cerita">
              Cerita
            </Link>
            <Link className="hover:text-[#9a7047]" href="/#lokasi">
              Lokasi
            </Link>
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            {user ? (
              <>
                <Link
                  href={user.role === "ADMIN" ? "/admin" : "/member"}
                  className="rounded-xl px-4 py-2 text-sm font-semibold text-[#3b1f2b] hover:bg-[#f0e7dc]"
                >
                  {user.name.split(" ")[0]}
                </Link>
                <Action kind="outline" onClick={handleSignOut}>
                  Keluar
                </Action>
              </>
            ) : (
              <>
                <Link href="/login" className="rounded-xl px-4 py-2 text-sm font-semibold text-[#3b1f2b]">
                  Masuk
                </Link>
                <Link
                  href="/register"
                  className="btn-primary inline-flex min-h-11 items-center gap-2 rounded-xl px-5 py-2 text-sm font-semibold"
                >
                  Mulai merawat diri <ArrowRight size={15} />
                </Link>
              </>
            )}
          </div>

          <button
            data-testid="button-mobile-menu"
            className="grid h-10 w-10 place-items-center rounded-xl border border-[#e3d7c8] md:hidden"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Buka menu"
          >
            {isMobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>

        {isMobileMenuOpen && (
          <nav className="grid gap-1 border-t border-[#e6dccc] bg-[#faf6f0] p-4 md:hidden">
            <Link onClick={() => setIsMobileMenuOpen(false)} className="rounded-lg p-3" href="/#layanan">
              Layanan
            </Link>
            <Link onClick={() => setIsMobileMenuOpen(false)} className="rounded-lg p-3" href="/#member">
              Membership
            </Link>
            <Link onClick={() => setIsMobileMenuOpen(false)} className="rounded-lg p-3" href="/#lokasi">
              Lokasi
            </Link>
            {user ? (
              <Link
                onClick={() => setIsMobileMenuOpen(false)}
                className="rounded-lg p-3"
                href={user.role === "ADMIN" ? "/admin" : "/member"}
              >
                Akun saya
              </Link>
            ) : (
              <>
                <Link onClick={() => setIsMobileMenuOpen(false)} className="rounded-lg p-3" href="/login">
                  Masuk
                </Link>
                <Link onClick={() => setIsMobileMenuOpen(false)} className="rounded-lg p-3" href="/register">
                  Daftar member
                </Link>
              </>
            )}
          </nav>
        )}
      </header>

      {children}

      <footer className="bg-[#3b1f2b] px-5 py-10 text-[#faf6f0]">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-6 sm:flex-row sm:items-center">
          <div>
            <div className="font-display text-2xl">Romi Salon</div>
            <p className="mt-2 max-w-sm text-sm leading-6 text-[#eadcc9]/75">
              Ruang untuk kembali merasa utuh. Perawatan ahli, ritme yang tenang, dan sambutan yang selalu hangat.
            </p>
          </div>
          <div className="text-sm text-[#eadcc9]/75">© Romi Salon · Jakarta · Waktu layanan WIB</div>
        </div>
      </footer>
    </div>
  );
}
