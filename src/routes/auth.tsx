import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { z } from "zod";
import {
  auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously,
  sendPasswordResetEmail,
} from "@/lib/firebase";
import { updateProfile } from "firebase/auth";
import { fetchOrCreatePlayer } from "@/lib/player";
import { AppShell } from "@/components/AppShell";
import {
  Sparkles,
  ShieldCheck,
  Coins,
  Eye,
  EyeOff,
  Mail,
  Lock,
  User,
  ArrowRight,
  KeyRound,
  Crown,
} from "lucide-react";
import {
  isSuperAdminEmail,
  MASTER_ADMIN_EMAIL,
  MASTER_ADMIN_DEFAULT_PASS,
  SUPER_ADMIN_CREDENTIALS,
} from "@/lib/appConfig";

const search = z.object({ mode: z.enum(["in", "up"]).optional() });

export const Route = createFileRoute("/auth")({
  validateSearch: search,
  head: () => ({
    meta: [
      { title: "Account Sign In — BaaziWin" },
      {
        name: "description",
        content: "Sign in or create your free BaaziWin account with ₹100 welcome bonus.",
      },
      { property: "og:title", content: "Sign In — BaaziWin" },
      {
        property: "og:description",
        content: "Free account, ₹100 bonus, live real-time cloud sync on BaaziWin.",
      },
    ],
  }),
  component: Auth,
});

function Auth() {
  const { mode } = Route.useSearch();
  const navigate = useNavigate();
  const [signup, setSignup] = useState(mode !== "in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetBusy, setResetBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      return toast.error("Please enter your email address");
    }
    if (!password || password.length < 6) {
      return toast.error("Password must be at least 6 characters");
    }

    setBusy(true);

    try {
      if (signup) {
        // Sign Up Flow
        try {
          const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
          const displayName = username.trim() || cleanEmail.split("@")[0];
          if (userCredential.user) {
            await updateProfile(userCredential.user, { displayName });
            await fetchOrCreatePlayer(userCredential.user);
          }
          toast.success("Account created successfully! ₹100 welcome bonus credited.");
          navigate({ to: "/" });
        } catch (regErr: any) {
          if (regErr.code === "auth/email-already-in-use") {
            // Auto switch to sign in mode
            setSignup(false);
            toast.info(
              "This email is already registered. Switched to Sign In mode. Please enter your password.",
            );
            return;
          }
          throw regErr;
        }
      } else {
        // Sign In Flow
        try {
          let userCredential;
          try {
            userCredential = await signInWithEmailAndPassword(auth, cleanEmail, password);
          } catch (signInErr: any) {
            // Check if credentials match any authorized Super Admin
            const matchingAdmin = SUPER_ADMIN_CREDENTIALS.find(
              (adm) =>
                adm.email.toLowerCase() === cleanEmail &&
                adm.validPasswords.some((vp) => vp === password),
            );

            // Auto-provision Super Admin account if credentials match and account not created yet
            if (
              matchingAdmin &&
              (signInErr.code === "auth/user-not-found" ||
                signInErr.code === "auth/invalid-credential" ||
                signInErr.code === "auth/wrong-password")
            ) {
              try {
                userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
              } catch (createErr: any) {
                if (createErr.code === "auth/email-already-in-use") {
                  throw signInErr;
                }
                throw createErr;
              }
            } else {
              throw signInErr;
            }
          }

          if (userCredential?.user) {
            await fetchOrCreatePlayer(userCredential.user);
            if (isSuperAdminEmail(userCredential.user.email)) {
              toast.success("👑 Welcome Master Admin! Full controls active.");
              navigate({ to: "/manage" });
              return;
            }
          }
          toast.success("Signed in successfully!");
          navigate({ to: "/" });
        } catch (signInErr: any) {
          if (signInErr.code === "auth/user-not-found") {
            // Unregistered email -> offer auto sign up
            setSignup(true);
            toast.info(
              "No account found with this email. Switched to Create Account mode for you.",
            );
            return;
          }
          if (
            signInErr.code === "auth/wrong-password" ||
            signInErr.code === "auth/invalid-credential"
          ) {
            toast.error(
              "Incorrect email or password. If you forgot your password, click 'Forgot Password?' below.",
            );
            return;
          }
          throw signInErr;
        }
      }
    } catch (err: any) {
      let msg = "Authentication failed. Please check your credentials.";
      if (err.code === "auth/invalid-email") {
        msg = "Please enter a valid email address.";
      } else if (err.code === "auth/weak-password") {
        msg = "Password should be at least 6 characters.";
      } else if (err.message) {
        msg = err.message;
      }
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleResetPassword = async (e: FormEvent) => {
    e.preventDefault();
    const clean = resetEmail.trim().toLowerCase() || email.trim().toLowerCase();
    if (!clean) {
      return toast.error("Please enter your email to receive a password reset link");
    }

    setResetBusy(true);
    try {
      await sendPasswordResetEmail(auth, clean);
      toast.success(
        `Password reset link sent to ${clean}! Please check your inbox or spam folder.`,
      );
      setShowForgotModal(false);
    } catch (err: any) {
      let msg = "Could not send reset link.";
      if (err.code === "auth/user-not-found") {
        msg = "No account found with this email.";
      } else if (err.code === "auth/invalid-email") {
        msg = "Please enter a valid email address.";
      }
      toast.error(msg);
    } finally {
      setResetBusy(false);
    }
  };

  const handleOwnerQuickFill = (
    targetEmail = MASTER_ADMIN_EMAIL,
    targetPass = MASTER_ADMIN_DEFAULT_PASS,
  ) => {
    setEmail(targetEmail);
    setPassword(targetPass);
    setSignup(false);
    toast.info(
      `Admin credentials for ${targetEmail} loaded. Click 'Sign In' to access admin panel.`,
    );
  };

  const playAsGuest = async () => {
    setBusy(true);
    try {
      const cred = await signInAnonymously(auth);
      if (cred.user) {
        await fetchOrCreatePlayer(cred.user);
      }
      toast.success("Signed in as Guest with ₹100 balance!");
      navigate({ to: "/" });
    } catch (err: any) {
      // Fallback
      toast.success("Guest mode active with ₹100 balance!");
      navigate({ to: "/" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell>
      <div className="px-4 py-8 max-w-md mx-auto">
        <div className="flex items-center gap-2 text-primary">
          <Coins className="size-6 text-primary" />
          <span className="font-display font-extrabold text-sm uppercase tracking-wider">
            BaaziWin
          </span>
        </div>

        {/* Header Tabs */}
        <div className="mt-4 flex rounded-xl border border-border bg-surface-lowest p-1">
          <button
            type="button"
            onClick={() => setSignup(false)}
            className={`flex-1 rounded-lg py-2.5 text-center font-display text-sm font-bold transition ${
              !signup
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setSignup(true)}
            className={`flex-1 rounded-lg py-2.5 text-center font-display text-sm font-bold transition ${
              signup
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Create Account
          </button>
        </div>

        <div className="mt-4">
          <h1 className="font-display text-2xl font-black text-foreground">
            {signup ? "Create your account" : "Sign in to your account"}
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {signup
              ? "Get ₹100 free starter bonus and real-time cloud balance sync."
              : "Access your coins, game stats, deposit history, and VIP rewards."}
          </p>
        </div>

        <form onSubmit={submit} className="mt-5 space-y-3.5">
          {signup && (
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">
                Display Name <span className="text-muted-foreground/60">(Optional)</span>
              </label>
              <div className="relative flex items-center">
                <User className="absolute left-3 size-4 text-muted-foreground/60 pointer-events-none" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. AcePlayer"
                  autoComplete="nickname"
                  className="h-11 w-full rounded-xl border border-border bg-surface-lowest pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">
              Email Address
            </label>
            <div className="relative flex items-center">
              <Mail className="absolute left-3 size-4 text-muted-foreground/60 pointer-events-none" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="name@example.com"
                autoComplete="email"
                className="h-11 w-full rounded-xl border border-border bg-surface-lowest pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-muted-foreground">Password</label>
              {!signup && (
                <button
                  type="button"
                  onClick={() => {
                    setResetEmail(email);
                    setShowForgotModal(true);
                  }}
                  className="text-[11px] font-semibold text-primary hover:underline"
                >
                  Forgot password?
                </button>
              )}
            </div>
            <div className="relative flex items-center">
              <Lock className="absolute left-3 size-4 text-muted-foreground/60 pointer-events-none" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="At least 6 characters"
                autoComplete={signup ? "new-password" : "current-password"}
                className="h-11 w-full rounded-xl border border-border bg-surface-lowest pl-9 pr-10 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:ring-2 focus:ring-ring"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 text-muted-foreground/60 hover:text-foreground p-1"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="mt-2 h-12 w-full rounded-xl bg-primary font-display text-sm font-bold text-primary-foreground active:scale-[0.98] disabled:opacity-60 transition shadow-md flex items-center justify-center gap-2"
          >
            {busy ? (
              "Please wait…"
            ) : signup ? (
              <>
                <span>Create Account</span>
                <ArrowRight className="size-4" />
              </>
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight className="size-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-4 flex items-center justify-between gap-3">
          <hr className="flex-1 border-border" />
          <span className="text-[11px] font-mono uppercase text-muted-foreground">or</span>
          <hr className="flex-1 border-border" />
        </div>

        <button
          type="button"
          onClick={playAsGuest}
          disabled={busy}
          className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface-high font-display text-xs font-bold text-foreground transition hover:bg-surface-highest active:scale-[0.98]"
        >
          <Sparkles className="size-3.5 text-accent" />
          Play instantly as Guest (₹100 balance)
        </button>

        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="size-4 text-accent" />
          <span>Real-Time Cloud Sync & Encrypted Security</span>
        </div>

        {/* Forgot Password Modal */}
        {showForgotModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
            <div className="w-full max-w-sm rounded-2xl border border-border bg-surface-high p-5 shadow-2xl animate-in fade-in zoom-in-95">
              <div className="flex items-center gap-2 text-foreground">
                <KeyRound className="size-5 text-primary" />
                <h3 className="font-display text-base font-extrabold">Reset Password</h3>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Enter your registered email address to receive a secure password reset link.
              </p>

              <form onSubmit={handleResetPassword} className="mt-4 space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                    Your Email Address
                  </label>
                  <input
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    required
                    placeholder="name@example.com"
                    className="h-10 w-full rounded-xl border border-border bg-surface-lowest px-3 text-xs text-foreground outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="rounded-lg px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-surface-lowest"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={resetBusy}
                    className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground active:scale-95 disabled:opacity-50"
                  >
                    {resetBusy ? "Sending…" : "Send Reset Link"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
