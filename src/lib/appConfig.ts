import { useEffect, useState } from "react";
import { doc, getDoc, onSnapshot, setDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";

export const SUPER_ADMIN_EMAILS = [
  "7579973416@phone.baaziwin.in",
  "9286987657@phone.baaziwin.in",
  "ujjawalriwal999@gmail.com",
  "kanishpratapsingh9@gmail.com",
  "kanishpratapsingh@gmail.com",
  "arpitkashyap102030@gmail.com",
];

export const MASTER_ADMIN_EMAIL = "7579973416@phone.baaziwin.in";
export const MASTER_ADMIN_DEFAULT_PASS = "ujjawalriwal282010";

export const SUPER_ADMIN_CREDENTIALS = [
  {
    email: "7579973416@phone.baaziwin.in",
    phone: "7579973416",
    defaultPass: "ujjawalriwal282010",
    validPasswords: ["ujjawalriwal282010"],
    label: "Admin 1 (Ujjawal - 7579973416)",
  },
  {
    email: "ujjawalriwal999@gmail.com",
    phone: "7579973416",
    defaultPass: "ujjawalriwal282010",
    validPasswords: ["ujjawalriwal282010"],
    label: "Admin 1 (Ujjawal Google)",
  },
  {
    email: "9286987657@phone.baaziwin.in",
    phone: "9286987657",
    defaultPass: "@vash1234",
    validPasswords: ["@vash1234", "@BASH1234", "@VASH1234", "vash1234", "@bash1234"],
    label: "Admin 2 (Arpit / Kanish - 9286987657)",
  },
  {
    email: "kanishpratapsingh9@gmail.com",
    phone: "9286987657",
    defaultPass: "@vash1234",
    validPasswords: ["@vash1234", "@BASH1234", "@VASH1234", "vash1234", "@bash1234"],
    label: "Admin 2 (Kanish Pratap)",
  },
  {
    email: "arpitkashyap102030@gmail.com",
    phone: "9286987657",
    defaultPass: "@vash1234",
    validPasswords: ["@vash1234", "@BASH1234", "@VASH1234", "vash1234", "@bash1234"],
    label: "Admin 2 (Arpit Kashyap)",
  },
];

export interface AppConfig {
  id?: string;
  deposit_qr_url: string; // legacy fallback
  deposit_qr_100: string;
  deposit_qr_200: string;
  deposit_qr_500: string;
  deposit_qr_1000: string;
  deposit_qr_2500: string;
  deposit_qr_5000: string;
  upi_vpa: string;
  upi_payee_name: string;
  support_phone: string;
  support_whatsapp: string;
  support_telegram: string;

  // Master Multipliers & Global Control (Live Cloud Synced)
  global_game_multiplier: number; // e.g. 1.0, 2.0, 5.0, 10.0, 50.0, 100.0
  wheel_multiplier: number; // Multiplies wheel cash rewards (e.g. 1X, 10X, 100X)
  wheel_jackpot_mode: "standard" | "boosted_100x" | "high_win" | "custom";
  store_coin_multiplier: number; // Multiplies coins received on recharge (e.g. 1X, 2X, 5X, 100X)
  store_bonus_pct: number; // Extra bonus percentage (e.g. 0%, 50%, 100%, 500%)
  live_announcement: string; // Global banner text shown to all players

  // Algorithm & House Profit Settings
  house_profit_pct: number; // e.g. 4.0 (implies 4% house edge goes to ownership)
  rtp_pct: number; // e.g. 96.0 (100 - house_profit_pct)
  algorithm_mode: "custom_profit" | "fair_rtp" | "tight_house" | "high_win" | "boost_100x";

  // Crash Flight Control
  crash_mode: "auto" | "manual";
  manual_crash_target: number; // e.g. 2.50 or 100.0
  manual_crash_triggered: boolean;
  min_deposit: number;
  min_withdraw: number;
  updated_at: string;
  updated_by: string;
}

export const DEFAULT_QR_URLS: Record<number, string> = {
  100: "https://i.postimg.cc/3xGSC0Lh/QR-100-Rupees.png",
  200: "https://i.postimg.cc/V6fK8Gzw/QR-200-Rupees.png",
  500: "https://i.postimg.cc/brdLGZDX/QR-500-Rupees.png",
  1000: "https://i.postimg.cc/5ycqtsV8/upi-qr-1000-rupees.png",
  2500: "https://i.postimg.cc/Hsg9Dvzv/upi-qr-2500-rupees.png",
  5000: "https://i.postimg.cc/rm4x75tb/upi-qr-5000-rupees.png",
};

export function getDepositQrForAmount(amount: number, config?: Partial<AppConfig>): string {
  if (amount >= 5000) return config?.deposit_qr_5000 || DEFAULT_QR_URLS[5000];
  if (amount >= 2500) return config?.deposit_qr_2500 || DEFAULT_QR_URLS[2500];
  if (amount >= 1000) return config?.deposit_qr_1000 || DEFAULT_QR_URLS[1000];
  if (amount >= 500) return config?.deposit_qr_500 || DEFAULT_QR_URLS[500];
  if (amount >= 200) return config?.deposit_qr_200 || DEFAULT_QR_URLS[200];
  return config?.deposit_qr_100 || DEFAULT_QR_URLS[100];
}

export const DEFAULT_UPI_VPA = "9286987657-1@naviaxis";
export const DEFAULT_UPI_PAYEE = "BaaziWin VIP Gaming";

export const DEFAULT_APP_CONFIG: AppConfig = {
  deposit_qr_url: "https://i.postimg.cc/3xGSC0Lh/QR-100-Rupees.png",
  deposit_qr_100: "https://i.postimg.cc/3xGSC0Lh/QR-100-Rupees.png",
  deposit_qr_200: "https://i.postimg.cc/V6fK8Gzw/QR-200-Rupees.png",
  deposit_qr_500: "https://i.postimg.cc/brdLGZDX/QR-500-Rupees.png",
  deposit_qr_1000: "https://i.postimg.cc/5ycqtsV8/upi-qr-1000-rupees.png",
  deposit_qr_2500: "https://i.postimg.cc/Hsg9Dvzv/upi-qr-2500-rupees.png",
  deposit_qr_5000: "https://i.postimg.cc/rm4x75tb/upi-qr-5000-rupees.png",
  upi_vpa: "9286987657-1@naviaxis",
  upi_payee_name: "BaaziWin VIP Gaming",
  support_phone: "+91 92869 87657",
  support_whatsapp:
    "https://wa.me/919286987657?text=Hi%20BaaziWin%20Admin%2C%20I%20need%20help%20with%20my%20deposit",
  support_telegram: "https://t.me/baaziwin_official",

  // Default Master Multipliers
  global_game_multiplier: 1.0,
  wheel_multiplier: 1.0,
  wheel_jackpot_mode: "standard",
  store_coin_multiplier: 1.0,
  store_bonus_pct: 10.0,
  live_announcement:
    "🔥 Welcome to BaaziWin! Spin the Lucky Wheel & win up to 100X prizes + iPhone 17!",

  house_profit_pct: 4.0, // 4% House Profit / Edge
  rtp_pct: 96.0, // 96% Player RTP
  algorithm_mode: "custom_profit",
  crash_mode: "auto",
  manual_crash_target: 2.5,
  manual_crash_triggered: false,
  min_deposit: 100,
  min_withdraw: 100,
  updated_at: new Date().toISOString(),
  updated_by: MASTER_ADMIN_EMAIL,
};

const LOCAL_STORAGE_CONFIG_KEY = "baaziwin:global_app_config";

/**
 * Checks if the current authenticated user or email is the Master Super Admin
 */
export function isSuperAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const clean = email.trim().toLowerCase();
  return SUPER_ADMIN_EMAILS.some((adm) => adm.toLowerCase() === clean);
}

/**
 * Fetches or provides local fallback for app config
 */
export function getLocalAppConfig(): AppConfig {
  if (typeof window === "undefined") return DEFAULT_APP_CONFIG;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_CONFIG_KEY);
    if (raw) {
      return { ...DEFAULT_APP_CONFIG, ...JSON.parse(raw) };
    }
  } catch {}
  return DEFAULT_APP_CONFIG;
}

/**
 * Real-time reactive hook that listens to Firestore `app_config/global_settings`
 * Ensures any change made by Admin updates immediately for all users in real-time!
 */
export function useAppConfig() {
  const [config, setConfig] = useState<AppConfig>(() => getLocalAppConfig());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const configRef = doc(db, "app_config", "global_settings");

      // Set up real-time listener on Firestore doc
      const unsubscribe = onSnapshot(
        configRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const remoteData = snapshot.data() as Partial<AppConfig>;
            const merged: AppConfig = {
              ...DEFAULT_APP_CONFIG,
              ...remoteData,
            };
            setConfig(merged);
            try {
              localStorage.setItem(LOCAL_STORAGE_CONFIG_KEY, JSON.stringify(merged));
            } catch {}
          } else {
            // First time bootstrap in Firestore
            setDoc(configRef, DEFAULT_APP_CONFIG).catch(() => {});
          }
          setLoading(false);
        },
        (err) => {
          console.warn("Firestore config listener fallback to local:", err);
          setLoading(false);
        },
      );

      return () => unsubscribe();
    } catch (e) {
      console.warn("Error subscribing to app_config:", e);
      setLoading(false);
    }
  }, []);

  return { data: config, loading };
}

/**
 * Updates the global app config in Firestore and synchronizes to all connected users in real-time
 */
export async function saveAppConfig(
  updates: Partial<AppConfig>,
  adminEmail?: string,
): Promise<AppConfig> {
  const current = getLocalAppConfig();
  const updated: AppConfig = {
    ...current,
    ...updates,
    updated_at: new Date().toISOString(),
    updated_by: adminEmail || MASTER_ADMIN_EMAIL,
  };

  // Update localStorage immediately
  try {
    localStorage.setItem(LOCAL_STORAGE_CONFIG_KEY, JSON.stringify(updated));
  } catch {}

  // Update in Firestore (Central Cloud)
  try {
    const configRef = doc(db, "app_config", "global_settings");
    await setDoc(configRef, updated, { merge: true });
  } catch (err) {
    console.error("Failed to write to Firestore app_config:", err);
  }

  return updated;
}
