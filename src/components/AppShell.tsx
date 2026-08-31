import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode, type ComponentType } from "react";
import {
  Wallet,
  Plus,
  Grid3x3,
  Search,
  Users,
  Ticket,
  ClipboardList,
  LogOut,
  Volume2,
  VolumeX,
  Crown,
  Settings,
} from "lucide-react";
import { auth, signOut } from "@/lib/firebase";
import { usePendingReferral, usePlayer, useSession } from "@/lib/player";
import { formatMoney } from "@/lib/games";
import { isSuperAdminEmail } from "@/lib/appConfig";
import {
  attachGlobalClickSfx,
  initSound,
  isSoundOn,
  onSoundChange,
  toggleSound,
} from "@/lib/sound";
import wheelImg from "@/assets/wheel.svg";
import logoBaaziWin from "@/assets/brand-logo.png";
import { UpdateGate } from "@/components/UpdateGate";

function SoundToggle() {
  const [on, setOn] = useState(true);

  useEffect(() => {
    const off = onSoundChange(setOn);
    return () => {
      off();
    };
  }, []);
  useEffect(() => setOn(isSoundOn()), []);

  return (
    <button
      type="button"
      data-sfx="off"
      onClick={() => toggleSound()}
      aria-label={on ? "Mute sound effects" : "Unmute sound effects"}
      className="rounded-md border border-border p-2 text-muted-foreground transition-colors hover:text-foreground"
    >
      {on ? (
        <Volume2 className="size-4 text-primary" aria-hidden />
      ) : (
        <VolumeX className="size-4" aria-hidden />
      )}
    </button>
  );
}

function TopBar() {
  usePendingReferral();

  const [mounted, setMounted] = useState(false);
  const { user } = useSession();
  const { data: player } = usePlayer();
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isAdmin = isSuperAdminEmail(user?.email || player?.email);
  const isAuth = mounted && !!user;

  return (
    <header className="sticky top-0 z-50 grid h-12 w-full max-w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-border bg-background px-2">
      <Link to="/" className="flex min-w-0 items-center gap-1.5">
        {!logoError ? (
          <>
            <img
              src={logoBaaziWin}
              alt="BaaziWin"
              width={36}
              height={36}
              referrerPolicy="no-referrer"
              onError={() => setLogoError(true)}
              className="h-7 w-auto shrink-0 object-contain"
            />
            <span className="truncate font-display text-sm font-black tracking-wider">
              <span className="text-primary">BAAZI</span>
              <span className="text-emerald-400">WIN</span>
            </span>
          </>
        ) : (
          <div className="flex items-center gap-1 font-display text-sm font-black tracking-wider">
            <span className="rounded bg-primary/20 px-1.5 py-0.5 text-primary">BAAZI</span>
            <span className="text-emerald-400">WIN</span>
          </div>
        )}
      </Link>

      {isAuth ? (
        <div className="flex shrink-0 items-center gap-1.5">
          {/* Admin Manage link - only visible to authorized admin accounts */}
          {isAdmin && (
            <Link
              to="/manage"
              className="flex items-center gap-1 rounded-lg border border-primary/40 bg-surface-high px-2 py-1 text-xs font-display font-semibold text-foreground shadow-sm transition hover:bg-surface-highest active:scale-95"
              title="Admin Panel"
            >
              <Settings className="size-3.5 text-primary" />
              <span>Admin</span>
            </Link>
          )}

          <Link
            to="/wallet"
            className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-surface-high/90 px-3 py-1.5 shadow-sm transition-all hover:border-primary/60 hover:bg-surface-highest active:scale-95"
            title="Open Wallet"
          >
            <Wallet className="size-3.5 shrink-0 text-primary" aria-hidden />
            <span className="font-mono text-xs font-bold tabular-nums text-primary">
              {player ? `₹${formatMoney(player.balance)}` : "—"}
            </span>
          </Link>
          <SoundToggle />
          <button
            onClick={() => signOut(auth)}
            aria-label="Sign out"
            className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-surface-high hover:text-foreground"
          >
            <LogOut className="size-4" aria-hidden />
          </button>
        </div>
      ) : (
        <div className="flex shrink-0 items-center gap-1.5">
          <SoundToggle />
          <Link to="/auth" search={{ mode: "in" }} className="label-mono text-foreground">
            Sign In
          </Link>
          <Link
            to="/auth"
            search={{ mode: "up" }}
            className="label-mono rounded-md bg-primary px-3 py-1.5 text-primary-foreground active:scale-95"
          >
            Sign Up
          </Link>
        </div>
      )}
    </header>
  );
}

const NAV = [
  { to: "/", label: "Menu", Icon: Grid3x3 },
  { to: "/wallet", label: "Wallet", Icon: Wallet },
  { to: "/invite", label: "Invite", Icon: Users },
  { to: "/quest", label: "Quest", Icon: ClipboardList },
] as const;

function BottomNav() {
  const path = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav className="safe-bottom fixed bottom-0 left-0 z-50 flex h-16 w-full items-center justify-around border-t border-border bg-surface-low px-2 shadow-lg">
      {NAV.slice(0, 2).map(({ to, label, Icon }) => (
        <NavItem key={to} to={to} label={label} Icon={Icon} active={path === to} />
      ))}

      <Link
        to="/wheel"
        className="relative -top-5 flex flex-col items-center transition-transform active:scale-110"
        aria-label="Daily bonus wheel"
      >
        <div className="animate-glow size-[72px] rounded-full bg-primary/60 p-0.5">
          <div className="flex size-full items-center justify-center overflow-hidden rounded-full border border-primary/50 bg-surface-lowest">
            <img
              src={wheelImg}
              alt="Daily Aviator Spin"
              width={64}
              height={64}
              referrerPolicy="no-referrer"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
              className="size-14 object-contain"
            />
          </div>
        </div>
        <span className="label-mono absolute -bottom-2 whitespace-nowrap rounded-full bg-primary px-2 py-0.5 text-[10px] text-primary-foreground">
          Free spin
        </span>
      </Link>

      {NAV.slice(2).map(({ to, label, Icon }) => (
        <NavItem key={to} to={to} label={label} Icon={Icon} active={path === to} />
      ))}
    </nav>
  );
}

function NavItem({
  to,
  label,
  Icon,
  active,
}: {
  key?: string;
  to: string;
  label: string;
  Icon: ComponentType<{ className?: string }>;
  active: boolean;
}) {
  return (
    <Link
      to={to}
      className={`flex flex-col items-center gap-1 pt-1.5 transition-colors ${
        active ? "text-primary" : "text-muted-foreground"
      }`}
    >
      <Icon className="size-6" aria-hidden />
      <span className="label-mono">{label}</span>
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  useEffect(() => {
    initSound();
    const detach = attachGlobalClickSfx();
    return () => {
      detach();
    };
  }, []);

  return (
    <div className="flex min-h-dvh w-full max-w-full flex-col overflow-x-hidden bg-background pb-28">
      <TopBar />
      <main className="mx-auto w-full max-w-2xl flex-1 overflow-x-hidden">{children}</main>
      <BottomNav />
      <UpdateGate />
    </div>
  );
}
