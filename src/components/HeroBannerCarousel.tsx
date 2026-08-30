import { useState, useEffect, useRef } from "react";
import { Link } from "@tanstack/react-router";
import {
  Sparkles,
  ShieldCheck,
  Zap,
  Plane,
  Gift,
  Users,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import heroCoins from "@/assets/hero-bonus-coins.png";
import inviteFriends from "@/assets/invite-friends.png";
import aviatorCover from "@/assets/cover-aviator.jpg";

interface HeroBannerCarouselProps {
  user: any;
}

interface BannerSlide {
  id: string;
  badge: string;
  badgeColor: string;
  title: string;
  highlightText: string;
  highlightColor: string;
  description: string;
  ctaText: string;
  ctaLink: string;
  ctaSearch?: Record<string, any>;
  bgGradient: string;
  borderColor: string;
  glowColor: string;
  icon: typeof Sparkles;
  image?: string;
  imageAlt?: string;
  customVisual?: "upi-apps" | "aviator" | "bonus" | "referral" | "welcome";
}

export function HeroBannerCarousel({ user }: HeroBannerCarouselProps) {
  const [current, setCurrent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const banners: BannerSlide[] = [
    {
      id: "welcome",
      badge: "Welcome Offer · 100% Free",
      badgeColor: "bg-amber-400/20 text-amber-300 border-amber-400/30",
      title: "Sign up & get",
      highlightText: "₹100 Free Bonus",
      highlightColor: "text-amber-300",
      description: "Instant coins on signup + daily spin wheel rewards",
      ctaText: user ? "Spin Daily Wheel" : "Claim ₹100 Free",
      ctaLink: user ? "/wheel" : "/auth",
      ctaSearch: user ? undefined : { mode: "up" },
      bgGradient: "from-amber-600/30 via-surface-high to-surface-low",
      borderColor: "border-amber-500/40",
      glowColor: "rgba(245, 158, 11, 0.35)",
      icon: Gift,
      image: heroCoins,
      imageAlt: "Coins Bonus",
      customVisual: "welcome",
    },
    {
      id: "secure-upi",
      badge: "100% Safe & Instant Gateway",
      badgeColor: "bg-emerald-400/20 text-emerald-300 border-emerald-400/30",
      title: "Fast Deposit & 1-5 Min",
      highlightText: "Express Withdrawals",
      highlightColor: "text-emerald-400",
      description: "Paytm, PhonePe, Google Pay, BHIM & all UPI Apps",
      ctaText: user ? "Add Cash / Withdraw" : "Deposit Now",
      ctaLink: user ? "/wallet" : "/auth",
      ctaSearch: user ? { tab: "deposit" } : { mode: "in" },
      bgGradient: "from-emerald-950/60 via-surface-high to-surface-low",
      borderColor: "border-emerald-500/40",
      glowColor: "rgba(16, 185, 129, 0.3)",
      icon: ShieldCheck,
      customVisual: "upi-apps",
    },
    {
      id: "aviator-crash",
      badge: "Top Multiplayer Game · 100x",
      badgeColor: "bg-rose-500/20 text-rose-300 border-rose-500/30",
      title: "Play Aviator & JetX",
      highlightText: "Cash Out Before Crash!",
      highlightColor: "text-rose-400",
      description: "Multiply your coins up to 100x in real-time",
      ctaText: "Play Aviator Now",
      ctaLink: "/game/aviator",
      bgGradient: "from-rose-950/60 via-surface-high to-surface-low",
      borderColor: "border-rose-500/40",
      glowColor: "rgba(244, 63, 94, 0.3)",
      icon: Plane,
      image: aviatorCover,
      imageAlt: "Aviator Game",
      customVisual: "aviator",
    },
    {
      id: "deposit-bonus",
      badge: "Double Your First Deposit",
      badgeColor: "bg-primary/20 text-primary border-primary/30",
      title: "Up to 18% Extra Bonus",
      highlightText: "+ Instant Reload Cashback",
      highlightColor: "text-primary",
      description: "Get extra bonus coins automatically on every deposit",
      ctaText: "Get Deposit Bonus",
      ctaLink: user ? "/wallet" : "/auth",
      ctaSearch: user ? { tab: "deposit" } : { mode: "in" },
      bgGradient: "from-primary/20 via-surface-high to-surface-low",
      borderColor: "border-primary/40",
      glowColor: "var(--glow-primary)",
      icon: Sparkles,
      image: heroCoins,
      imageAlt: "Bonus Coins",
      customVisual: "bonus",
    },
    {
      id: "referral",
      badge: "Daily Passive Commission",
      badgeColor: "bg-sky-500/20 text-sky-300 border-sky-500/30",
      title: "Invite Friends & Earn",
      highlightText: "₹10 Direct Cash",
      highlightColor: "text-sky-300",
      description: "Give ₹10, Get ₹10 on every friend who joins",
      ctaText: "Invite & Earn",
      ctaLink: "/invite",
      bgGradient: "from-sky-950/60 via-surface-high to-surface-low",
      borderColor: "border-sky-500/40",
      glowColor: "rgba(14, 165, 233, 0.3)",
      icon: Users,
      image: inviteFriends,
      imageAlt: "Invite Friends",
      customVisual: "referral",
    },
  ];

  // Auto-slide every 3.5 seconds
  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      setCurrent((prev) => (prev + 1) % banners.length);
    }, 3500);
    return () => clearInterval(interval);
  }, [isPaused, banners.length]);

  const nextSlide = () => setCurrent((prev) => (prev + 1) % banners.length);
  const prevSlide = () => setCurrent((prev) => (prev - 1 + banners.length) % banners.length);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (diff > 40) {
      nextSlide();
    } else if (diff < -40) {
      prevSlide();
    }
    touchStartX.current = null;
  };

  const slide = banners[current];
  const IconComponent = slide.icon;

  return (
    <div
      className="relative w-full overflow-hidden"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div
        className={`relative min-h-[190px] sm:min-h-[200px] overflow-hidden rounded-2xl border ${slide.borderColor} bg-gradient-to-br ${slide.bgGradient} p-4 sm:p-5 shadow-xl transition-all duration-500`}
      >
        {/* Glow ambient background */}
        <div
          className="pointer-events-none absolute inset-0 opacity-40 transition-opacity duration-700"
          style={{
            backgroundImage: `radial-gradient(circle at 85% 20%, ${slide.glowColor}, transparent 65%)`,
          }}
        />

        {/* Slide Content */}
        <div className="relative z-10 flex flex-col justify-between h-full max-w-[70%] sm:max-w-[65%]">
          <div>
            {/* Top Badge */}
            <div className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider backdrop-blur-md shadow-xs transition-all duration-300">
              <IconComponent className="size-3 shrink-0" />
              <span className={slide.badgeColor.split(" ")[1]}>{slide.badge}</span>
            </div>

            {/* Title & Highlight */}
            <h2 className="mt-2 font-display text-lg sm:text-2xl font-black leading-tight text-foreground tracking-tight">
              {slide.title}
              <br />
              <span className={`${slide.highlightColor} drop-shadow-sm font-extrabold`}>
                {slide.highlightText}
              </span>
            </h2>

            {/* Description / Subtitle */}
            <p className="mt-1 text-[11px] sm:text-xs text-muted-foreground line-clamp-1">
              {slide.description}
            </p>
          </div>

          {/* Action CTA Button */}
          <div className="mt-3.5 flex items-center gap-2">
            <Link
              to={slide.ctaLink}
              search={slide.ctaSearch}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 font-display text-xs font-black text-slate-950 shadow-md transition active:scale-95 hover:brightness-110"
            >
              <span>{slide.ctaText}</span>
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>

        {/* Right-Side Graphic or Visuals */}
        <div className="pointer-events-none absolute -right-2 -bottom-2 top-2 w-[34%] sm:w-[32%] flex items-center justify-center">
          {slide.customVisual === "upi-apps" ? (
            <div className="flex flex-col items-center justify-center gap-1.5 scale-90 sm:scale-100 pr-2">
              <div className="flex items-center gap-1">
                <span className="rounded-lg bg-sky-500/20 border border-sky-400/40 px-2 py-1 font-mono text-[10px] font-black text-sky-300 shadow-sm">
                  Paytm
                </span>
                <span className="rounded-lg bg-purple-500/20 border border-purple-400/40 px-2 py-1 font-mono text-[10px] font-black text-purple-300 shadow-sm">
                  PhonePe
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span className="rounded-lg bg-emerald-500/20 border border-emerald-400/40 px-2 py-1 font-mono text-[10px] font-black text-emerald-300 shadow-sm">
                  GPay
                </span>
                <span className="rounded-lg bg-amber-500/20 border border-amber-400/40 px-2 py-1 font-mono text-[10px] font-black text-amber-300 shadow-sm">
                  BHIM UPI
                </span>
              </div>
              <div className="mt-1 flex items-center gap-1 rounded-full bg-emerald-500/30 border border-emerald-400/60 px-2.5 py-0.5 font-mono text-[9px] font-extrabold text-emerald-200">
                <CheckCircle2 className="size-3 text-emerald-400" /> 0% Fee · 1-5m
              </div>
            </div>
          ) : slide.image ? (
            <img
              src={slide.image}
              alt={slide.imageAlt || "Banner Graphic"}
              className="max-h-36 sm:max-h-40 object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.6)] rotate-3 transition-transform duration-500"
              referrerPolicy="no-referrer"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          ) : (
            <div className="size-24 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center">
              <Sparkles className="size-12 text-primary animate-pulse" />
            </div>
          )}
        </div>

        {/* Carousel Navigation Arrows */}
        <button
          type="button"
          onClick={prevSlide}
          aria-label="Previous slide"
          className="absolute left-1.5 top-1/2 -translate-y-1/2 size-7 rounded-full bg-slate-950/60 border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-slate-950/90 transition z-20 active:scale-90"
        >
          <ChevronLeft className="size-4" />
        </button>
        <button
          type="button"
          onClick={nextSlide}
          aria-label="Next slide"
          className="absolute right-1.5 top-1/2 -translate-y-1/2 size-7 rounded-full bg-slate-950/60 border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-slate-950/90 transition z-20 active:scale-90"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      {/* Dot Indicators */}
      <div className="mt-2.5 flex items-center justify-center gap-1.5">
        {banners.map((b, idx) => (
          <button
            key={b.id}
            type="button"
            onClick={() => setCurrent(idx)}
            aria-label={`Go to slide ${idx + 1}`}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              current === idx
                ? "w-6 bg-primary"
                : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/60"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
