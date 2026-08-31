import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { z } from "zod";
import {
  auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously,
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
  Lock,
  User,
  ArrowRight,
  HelpCircle,
  MessageCircle,
  Gift,
} from "lucide-react";
import { isSuperAdminEmail, SUPER_ADMIN_CREDENTIALS, useAppConfig } from "@/lib/appConfig";

const search = z.object({ mode: z.enum(["in", "up"]).optional() });

export const Route = createFileRoute("/auth")({
  validateSearch: search,
  head: () => ({
    meta: [
      { title: "Mobile Login & Sign Up — BaaziWin" },
      {
        name: "description",
        content:
          "Sign in or register with your Mobile Number & Password to get an instant ₹100 welcome bonus on BaaziWin.",
      },
      { property: "og:title", content: "Mobile Login & Sign Up — BaaziWin" },
      {
        property: "og:description",
        content:
          "Fast Mobile Login, ₹100 Free Starter Bonus, Instant UPI deposits & fast withdrawals.",
      },
    ],
  }),
  component: Auth,
});

/**
 * Normalizes phone number into Firebase Auth internal email identifier
 */
function toAuthIdentifier(rawInput: string): string {
  const trimmed = rawInput.trim();
  if (trimmed.includes("@")) {
    // Admin email directly supported
    return trimmed.toLowerCase();
  }
  const digits = trimmed.replace(/\D/g, "");
  const normalizedDigits =
    digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
  return `${normalizedDigits}@phone.baaziwin.in`;
}

function Auth() {
  const { mode } = Route.useSearch();
  const navigate = useNavigate();
  const { data: config } = useAppConfig();

  const [signup, setSignup] = useState(mode !== "in");
  const [phone, setPhone] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);

  const cleanPhoneDigits = phone.replace(/\D/g, "");

  const submit = async (e: FormEvent) => {
    e.preventDefault();

    // 1. Phone number validation
    const rawInput = phone.trim();
    if (!rawInput) {
      return toast.error("Please enter your 10-digit mobile number");
    }

    const isEmailFormat = rawInput.includes("@");
    const digitsOnly = rawInput.replace(/\D/g, "");

    if (!isEmailFormat && digitsOnly.length < 10) {
      return toast.error("Please enter a valid 10-digit mobile number");
    }

    // 2. Sign Up validations
    if (signup) {
      const cleanName = fullName.trim();
      if (!cleanName || cleanName.length < 2) {
        return toast.error("Please enter your full name (minimum 2 characters)");
      }
    }

    // 3. Password validation
    if (!password || password.length < 6) {
      return toast.error("Password must be at least 6 characters");
    }

    setBusy(true);
    const authIdentifier = toAuthIdentifier(rawInput);
    const normalizedPhone = !isEmailFormat ? digitsOnly.slice(-10) : "";

    try {
      if (signup) {
        // Sign Up Flow: Name + Phone Number + Password
        const cleanName = fullName.trim();
        try {
          const userCredential = await createUserWithEmailAndPassword(
            auth,
            authIdentifier,
            password,
          );
          if (userCredential.user) {
            await updateProfile(userCredential.user, { displayName: cleanName });
            await fetchOrCreatePlayer(userCredential.user, {
              username: cleanName,
              phone: normalizedPhone || undefined,
            });
          }
          toast.success("Account created successfully! ₹100 welcome bonus credited.");
          navigate({ to: "/" });
        } catch (regErr: any) {
          if (regErr.code === "auth/email-already-in-use") {
            // Already registered -> switch to sign in
            setSignup(false);
            toast.info(
              "This mobile number is already registered. Please enter password to sign in.",
            );
            return;
          }
          throw regErr;
        }
      } else {
        // Sign In Flow: Phone Number + Password (NO Name required)
        try {
          let userCredential;
          try {
            userCredential = await signInWithEmailAndPassword(auth, authIdentifier, password);
          } catch (signInErr: any) {
            // Check if credentials match any authorized Super Admin
            const matchingAdmin = SUPER_ADMIN_CREDENTIALS.find(
              (adm) =>
                (adm.email.toLowerCase() === rawInput.toLowerCase() ||
                  (adm.phone && adm.phone === normalizedPhone) ||
                  adm.email.toLowerCase() === authIdentifier.toLowerCase()) &&
                adm.validPasswords.some((vp) => vp === password),
            );

            if (
              matchingAdmin &&
              (signInErr.code === "auth/user-not-found" ||
                signInErr.code === "auth/invalid-credential" ||
                signInErr.code === "auth/wrong-password")
            ) {
              try {
                userCredential = await createUserWithEmailAndPassword(
                  auth,
                  matchingAdmin.email,
                  password,
                );
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
            await fetchOrCreatePlayer(userCredential.user, {
              phone: normalizedPhone || undefined,
            });
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
            setSignup(true);
            toast.info("No account found with this mobile number. Sign up form is ready for you.");
            return;
          }
          if (
            signInErr.code === "auth/wrong-password" ||
            signInErr.code === "auth/invalid-credential"
          ) {
            toast.error("Incorrect mobile number or password. Please check and try again.");
            return;
          }
          throw signInErr;
        }
      }
    } catch (err: any) {
      let msg = "Authentication failed. Please check your details.";
      if (err.code === "auth/invalid-email" || err.code === "auth/invalid-phone-number") {
        msg = "Please enter a valid 10-digit mobile number.";
      } else if (err.code === "auth/weak-password") {
        msg = "Password must be at least 6 characters long.";
      } else if (err.message) {
        msg = err.message;
      }
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const playAsGuest = async () => {
    setBusy(true);
    try {
      const cred = await signInAnonymously(auth);
      if (cred.user) {
        await fetchOrCreatePlayer(cred.user);
      }
      toast.success("Guest mode active! ₹100 demo balance available.");
      navigate({ to: "/" });
    } catch {
      toast.success("Guest mode active! ₹100 demo balance available.");
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

        {/* Tab Switcher: Sign In vs Sign Up */}
        <div className="mt-4 flex rounded-xl border border-border bg-surface-lowest p-1 shadow-inner">
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
            Sign Up
          </button>
        </div>

        {/* Header Title */}
        <div className="mt-4">
          <h1 className="font-display text-2xl font-black text-foreground flex items-center gap-2">
            {signup ? "Create Account" : "Sign In to Your Account"}
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {signup
              ? "Register now and get an instant ₹100 welcome bonus."
              : "Enter your mobile number and password to start playing."}
          </p>
        </div>

        {/* Welcome Bonus Callout */}
        {signup && (
          <div className="mt-3.5 flex items-center gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-emerald-400">
            <Gift className="size-5 shrink-0" />
            <div className="text-xs">
              <span className="font-bold">₹100 Free Welcome Bonus:</span> Credited instantly on new
              accounts!
            </div>
          </div>
        )}

        <form onSubmit={submit} className="mt-4 space-y-3.5">
          {/* Sign Up ONLY: Full Name Field */}
          {signup && (
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">
                Full Name <span className="text-destructive">*</span>
              </label>
              <div className="relative flex items-center">
                <User className="absolute left-3 size-4 text-muted-foreground/60 pointer-events-none" />
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  placeholder="Enter your full name (e.g. Rahul Kumar)"
                  autoComplete="name"
                  className="h-11 w-full rounded-xl border border-border bg-surface-lowest pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
          )}

          {/* Mobile Number Field (Required in both Sign In & Sign Up) */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">
              Mobile Number <span className="text-destructive">*</span>
            </label>
            <div className="relative flex items-center">
              <div className="absolute left-3 flex items-center gap-1 text-muted-foreground pointer-events-none">
                <span className="text-xs">🇮🇳</span>
                <span className="font-mono text-xs font-bold text-foreground/80">+91</span>
                <span className="text-border">|</span>
              </div>
              <input
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                maxLength={15}
                placeholder="10-digit mobile number (e.g. 9876543210)"
                autoComplete="tel"
                className="h-11 w-full rounded-xl border border-border bg-surface-lowest pl-20 pr-3 text-sm font-mono text-foreground outline-none placeholder:text-muted-foreground/50 placeholder:font-sans focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          {/* Password Field */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-muted-foreground">
                Password <span className="text-destructive">*</span>
              </label>
              {!signup && (
                <button
                  type="button"
                  onClick={() => setShowForgotModal(true)}
                  className="text-[11px] font-semibold text-primary hover:underline"
                >
                  Forgot Password?
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
                placeholder="Minimum 6 characters"
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

          {/* Submit Button */}
          <button
            type="submit"
            disabled={busy}
            className="mt-2 h-12 w-full rounded-xl bg-primary font-display text-sm font-bold text-primary-foreground active:scale-[0.98] disabled:opacity-60 transition shadow-md flex items-center justify-center gap-2"
          >
            {busy ? (
              "Please wait…"
            ) : signup ? (
              <>
                <span>Sign Up &amp; Claim ₹100</span>
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
          <span className="text-[11px] font-mono uppercase text-muted-foreground">OR</span>
          <hr className="flex-1 border-border" />
        </div>

        {/* Play as Guest Option */}
        <button
          type="button"
          onClick={playAsGuest}
          disabled={busy}
          className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface-high font-display text-xs font-bold text-foreground transition hover:bg-surface-highest active:scale-[0.98]"
        >
          <Sparkles className="size-3.5 text-accent" />
          Play as Guest (₹100 Demo Balance)
        </button>

        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="size-4 text-accent" />
          <span>Secure Mobile Login &amp; 100% Data Protection</span>
        </div>

        {/* Forgot Password / Help Modal */}
        {showForgotModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
            <div className="w-full max-w-sm rounded-2xl border border-border bg-surface-high p-5 shadow-2xl animate-in fade-in zoom-in-95">
              <div className="flex items-center gap-2 text-foreground">
                <HelpCircle className="size-5 text-primary" />
                <h3 className="font-display text-base font-extrabold">Password Reset Help</h3>
              </div>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                If you forgot your password, contact our 24x7 WhatsApp support from your registered
                mobile number. Your password will be reset within 1 minute.
              </p>

              <div className="mt-4 space-y-2">
                <a
                  href={`https://wa.me/919286987657?text=Hi%20BaaziWin%20Support%2C%20I%20forgot%20my%20password%20for%20mobile%20number%3A%20${cleanPhoneDigits || ""}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 h-11 w-full rounded-xl bg-emerald-500 font-display text-xs font-bold text-black hover:bg-emerald-400 active:scale-98 transition shadow"
                >
                  <MessageCircle className="size-4" />
                  <span>Reset Password on WhatsApp</span>
                </a>

                <button
                  type="button"
                  onClick={() => setShowForgotModal(false)}
                  className="h-10 w-full rounded-xl border border-border bg-surface-lowest text-xs font-semibold text-muted-foreground hover:text-foreground"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
