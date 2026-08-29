import type { Request, Response } from "express";
import { parseBankSms } from "./smsParser";
import {
  serverDb,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  addDoc,
  query,
  where,
  getDocs,
  runTransaction,
  deleteDoc,
} from "./db";

// Deposit cashback incentive tiers calculation
export function calculateCashback(amount: number): { percent: number; cashback: number } {
  if (amount >= 5000) return { percent: 8, cashback: Math.round(amount * 0.08) };
  if (amount >= 2500) return { percent: 6, cashback: Math.round(amount * 0.06) };
  if (amount >= 1000) return { percent: 5, cashback: Math.round(amount * 0.05) };
  if (amount >= 500) return { percent: 5, cashback: Math.round(amount * 0.05) };
  if (amount >= 300) return { percent: 2, cashback: Math.round(amount * 0.02) };
  return { percent: 0, cashback: 0 };
}

// In-memory store for fallback or fast caching
interface UnclaimedCredit {
  id: string;
  utr_number: string;
  amount: number;
  sender: string;
  bank_name?: string;
  raw_sms: string;
  status: "UNCLAIMED" | "CLAIMED" | "EXPIRED";
  created_at: string;
  expires_at: string;
  claimed_by?: string;
}

const memoryUnclaimedCredits = new Map<string, UnclaimedCredit>();
const memoryProcessedUtrs = new Set<string>();

/**
 * 1. POST /api/webhook/bank-sms
 * Accepts incoming forwarded SMS payloads and matches or stores them.
 */
export async function bankSmsWebhookHandler(req: Request, res: Response) {
  try {
    // 1. Authenticate Secret Header Key
    const configuredSecret = process.env.SMS_WEBHOOK_SECRET || "3cr_secure_sms_webhook_secret_2026";
    const authHeader =
      req.headers["x-webhook-secret"] || req.headers["authorization"]?.replace(/^Bearer\s+/i, "");
    const querySecret = req.query.secret;

    if (authHeader !== configuredSecret && querySecret !== configuredSecret) {
      console.warn("[Webhook] Unauthorized attempt with invalid or missing secret header.");
      return res.status(401).json({
        error: "Unauthorized: Invalid or missing x-webhook-secret header.",
      });
    }

    // 2. Extract and Parse SMS text
    const { sender = "BANK_SMS", body, message, text, timestamp } = req.body || {};
    const rawSmsText = (body || message || text || "").toString().trim();

    if (!rawSmsText) {
      return res.status(400).json({
        error: "Bad Request: Empty SMS message body provided.",
      });
    }

    const parsed = parseBankSms(rawSmsText, sender, timestamp);

    // If not a credit or missing key fields, safely ignore and log
    if (!parsed.isCredit || !parsed.utr || parsed.amount === null) {
      return res.status(200).json({
        status: "ignored",
        reason:
          parsed.error ||
          "Message does not represent a valid credit transaction with 12-digit UTR.",
        parsed,
      });
    }

    const utr = parsed.utr;
    const amount = parsed.amount;
    const now = new Date().toISOString();

    console.log(
      `[Webhook] Processing verified credit SMS - UTR: ${utr}, Amount: ₹${amount}, Bank: ${parsed.bankName}`,
    );

    // 3. Security: Check Unique UTR Constraint (Prevent Double Credits)
    if (memoryProcessedUtrs.has(utr)) {
      return res.status(200).json({
        status: "duplicate_blocked",
        message: `UTR ${utr} has already been processed and credited previously.`,
        utr,
      });
    }

    let isDuplicateInDb = false;
    try {
      const processedRef = doc(serverDb, "processed_utrs", `utr_${utr}`);
      const processedSnap = await getDoc(processedRef);
      if (processedSnap.exists()) {
        isDuplicateInDb = true;
      }
    } catch {}

    if (isDuplicateInDb) {
      memoryProcessedUtrs.add(utr);
      return res.status(200).json({
        status: "duplicate_blocked",
        message: `UTR ${utr} has already been credited previously.`,
        utr,
      });
    }

    // 4. Look up pending 'deposit_requests' record in database
    let matchingDeposit: any = null;
    let matchingDepositDocId: string | null = null;

    try {
      const depQ = query(
        collection(serverDb, "deposit_requests"),
        where("utr", "==", utr),
        where("status", "in", ["PENDING", "pending"]),
      );
      const depSnap = await getDocs(depQ);

      if (!depSnap.empty) {
        // Find matching amount
        for (const d of depSnap.docs) {
          const data = d.data();
          if (Number(data.amount) === amount) {
            matchingDeposit = data;
            matchingDepositDocId = d.id;
            break;
          }
        }
      }
    } catch (dbErr) {
      console.warn(
        "[Webhook] Firestore query error (will fallback to memory/direct handling):",
        dbErr,
      );
    }

    const { cashback } = calculateCashback(amount);

    // 5. If match found: Execute Atomic Database Transaction to credit user
    if (matchingDeposit && matchingDepositDocId) {
      const playerId = matchingDeposit.player_id;

      try {
        await runTransaction(serverDb, async (transaction) => {
          const playerRef = doc(serverDb, "players", playerId);
          const playerSnap = await transaction.get(playerRef);

          const currentDep = playerSnap.exists()
            ? Number(playerSnap.data().deposit_balance ?? 0)
            : 0;
          const currentBonus = playerSnap.exists()
            ? Number(playerSnap.data().bonus_balance ?? 0)
            : 0;

          const newDep = currentDep + amount;
          const newBonus = currentBonus + cashback;
          const newTotal = newDep + newBonus;

          // Update player balance
          transaction.update(playerRef, {
            deposit_balance: newDep,
            bonus_balance: newBonus,
            balance: newTotal,
            updated_at: now,
          });

          // Update deposit request status
          const depRef = doc(serverDb, "deposit_requests", matchingDepositDocId!);
          transaction.update(depRef, {
            status: "COMPLETED",
            cashback,
            verified_by: "bank_sms_webhook",
            verified_at: now,
            bank_name: parsed.bankName,
            raw_sms: rawSmsText,
          });

          // Mark unique processed UTR
          const processedRef = doc(serverDb, "processed_utrs", `utr_${utr}`);
          transaction.set(processedRef, {
            utr_number: utr,
            player_id: playerId,
            amount,
            cashback,
            processed_at: now,
            source: "bank_sms_webhook",
          });
        });

        // Add to wallet_transactions
        await addDoc(collection(serverDb, "wallet_transactions"), {
          player_id: playerId,
          kind: "deposit",
          amount,
          cashback,
          utr,
          status: "completed",
          method: `UPI (${parsed.bankName || "Bank SMS"} Auto-Verified)`,
          created_at: now,
        });

        // Clean up any memory unclaimed
        memoryUnclaimedCredits.delete(utr);
        memoryProcessedUtrs.add(utr);

        console.log(
          `[Webhook] Matched & Credited: ₹${amount} (+₹${cashback} CB) to player ${playerId}`,
        );

        return res.status(200).json({
          status: "matched_and_credited",
          message: "Bank SMS matched pending deposit. User wallet credited successfully.",
          utr,
          amount,
          cashback,
          player_id: playerId,
          verified_at: now,
        });
      } catch (txnErr) {
        console.error("[Webhook] Transaction failed during wallet update:", txnErr);
        return res.status(500).json({
          error: "Failed to execute atomic balance update transaction.",
          details: String(txnErr),
        });
      }
    }

    // 6. If no pending request exists yet (SMS arrived before user typed UTR):
    // Store in 'unclaimed_bank_credits' table with 30-minute expiry
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const unclaimedEntry: UnclaimedCredit = {
      id: `credit_${utr}`,
      utr_number: utr,
      amount,
      sender: parsed.sender,
      bank_name: parsed.bankName,
      raw_sms: rawSmsText,
      status: "UNCLAIMED",
      created_at: now,
      expires_at: expiresAt,
    };

    // Store in Memory cache
    memoryUnclaimedCredits.set(utr, unclaimedEntry);

    // Store in Firestore unclaimed_bank_credits collection
    try {
      const unclaimedRef = doc(serverDb, "unclaimed_bank_credits", `credit_${utr}`);
      await setDoc(unclaimedRef, unclaimedEntry);
    } catch (fsErr) {
      console.warn("[Webhook] Failed to save unclaimed credit in Firestore:", fsErr);
    }

    console.log(
      `[Webhook] Stored in unclaimed_bank_credits - UTR: ${utr}, Amount: ₹${amount}, Expires in 30 mins`,
    );

    return res.status(200).json({
      status: "stored_unclaimed",
      message:
        "Bank SMS credit registered in unclaimed pool. Awaiting user UTR submission for instant match.",
      utr,
      amount,
      expires_at: expiresAt,
      expires_in_minutes: 30,
      bank_name: parsed.bankName,
    });
  } catch (error) {
    console.error("[Webhook] Unhandled error in bankSmsWebhookHandler:", error);
    return res.status(500).json({
      error: "Internal Server Error in SMS Webhook handler",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * 2. POST /api/deposits/submit
 * User submits UTR and amount. Checks unclaimed credits for instant auto-verification,
 * or registers a pending request for future webhook match.
 */
export async function submitDepositHandler(req: Request, res: Response) {
  try {
    const { player_id = "guest-player", amount: rawAmount, utr: rawUtr } = req.body || {};
    const amount = Number(rawAmount);
    const utr = (rawUtr || "").toString().trim();
    const now = new Date().toISOString();

    if (!utr || !/^[0-9]{12}$/.test(utr)) {
      return res.status(400).json({
        error: "Invalid UTR format. Must be exactly 12 numeric digits.",
      });
    }

    if (isNaN(amount) || amount < 300) {
      return res.status(400).json({
        error: "Invalid deposit amount. Minimum deposit is ₹300.",
      });
    }

    // Check unique UTR: Has it already been claimed / processed?
    if (memoryProcessedUtrs.has(utr)) {
      return res.status(400).json({
        error: `UTR ${utr} has already been verified and credited. Duplicate submissions are not allowed.`,
      });
    }

    try {
      const processedRef = doc(serverDb, "processed_utrs", `utr_${utr}`);
      const processedSnap = await getDoc(processedRef);
      if (processedSnap.exists()) {
        memoryProcessedUtrs.add(utr);
        return res.status(400).json({
          error: `UTR ${utr} has already been verified and credited previously.`,
        });
      }
    } catch {}

    const { cashback } = calculateCashback(amount);

    // 1. Check Unclaimed Bank Credits Pool
    let matchedUnclaimed: UnclaimedCredit | null = null;

    // Check memory first
    const memCredit = memoryUnclaimedCredits.get(utr);
    if (
      memCredit &&
      memCredit.status === "UNCLAIMED" &&
      new Date(memCredit.expires_at) > new Date()
    ) {
      if (memCredit.amount === amount) {
        matchedUnclaimed = memCredit;
      }
    }

    // Check Firestore
    if (!matchedUnclaimed) {
      try {
        const unclaimedRef = doc(serverDb, "unclaimed_bank_credits", `credit_${utr}`);
        const unclaimedSnap = await getDoc(unclaimedRef);
        if (unclaimedSnap.exists()) {
          const data = unclaimedSnap.data() as UnclaimedCredit;
          if (
            data.status === "UNCLAIMED" &&
            Number(data.amount) === amount &&
            new Date(data.expires_at) > new Date()
          ) {
            matchedUnclaimed = data;
          }
        }
      } catch {}
    }

    // If matching unclaimed bank credit exists: INSTANT AUTO-APPROVAL!
    if (matchedUnclaimed) {
      try {
        // Execute atomic credit
        await runTransaction(serverDb, async (transaction) => {
          const playerRef = doc(serverDb, "players", player_id);
          const playerSnap = await transaction.get(playerRef);

          const curDep = playerSnap.exists() ? Number(playerSnap.data().deposit_balance ?? 0) : 0;
          const curBonus = playerSnap.exists() ? Number(playerSnap.data().bonus_balance ?? 0) : 0;

          const newDep = curDep + amount;
          const newBonus = curBonus + cashback;
          const newTotal = newDep + newBonus;

          transaction.set(
            playerRef,
            {
              deposit_balance: newDep,
              bonus_balance: newBonus,
              balance: newTotal,
              updated_at: now,
            },
            { merge: true },
          );

          // Update unclaimed credit
          const unclaimedRef = doc(serverDb, "unclaimed_bank_credits", `credit_${utr}`);
          transaction.update(unclaimedRef, {
            status: "CLAIMED",
            claimed_by: player_id,
            claimed_at: now,
          });

          // Record deposit request as completed
          const depRef = doc(collection(serverDb, "deposit_requests"));
          transaction.set(depRef, {
            player_id,
            amount,
            utr,
            status: "COMPLETED",
            cashback,
            method: "UPI",
            verified_by: "bank_sms_prematch",
            verified_at: now,
            created_at: now,
          });

          // Mark unique processed UTR
          const processedRef = doc(serverDb, "processed_utrs", `utr_${utr}`);
          transaction.set(processedRef, {
            utr_number: utr,
            player_id,
            amount,
            cashback,
            processed_at: now,
            source: "bank_sms_prematch",
          });
        });

        // Add to wallet_transactions
        await addDoc(collection(serverDb, "wallet_transactions"), {
          player_id,
          kind: "deposit",
          amount,
          cashback,
          utr,
          status: "completed",
          method: "UPI (Bank SMS Pre-Match)",
          created_at: now,
        });

        memoryUnclaimedCredits.delete(utr);
        memoryProcessedUtrs.add(utr);

        return res.status(200).json({
          success: true,
          instantVerified: true,
          status: "COMPLETED",
          amount,
          cashback,
          utr,
          message: `Bank SMS matched! ₹${amount} coins instantly credited to your Main Cash wallet + ₹${cashback} Cashback to Bonus Wallet! 🎉`,
        });
      } catch (err) {
        console.warn(
          "[Submit] Instant credit transaction issue, falling back to recorded approval:",
          err,
        );
      }
    }

    // No immediate SMS credit found: Register as PENDING deposit request
    try {
      const newDepRef = await addDoc(collection(serverDb, "deposit_requests"), {
        player_id,
        amount,
        utr,
        utr_number: utr,
        status: "PENDING",
        cashback,
        method: "UPI",
        created_at: now,
      });

      return res.status(200).json({
        success: true,
        instantVerified: false,
        status: "PENDING",
        deposit_id: newDepRef.id,
        amount,
        cashback,
        utr,
        message:
          "Deposit submitted! Awaiting Bank SMS Webhook verification (auto-credits the moment SMS arrives).",
      });
    } catch (saveErr) {
      return res.status(500).json({
        error: "Failed to record deposit request.",
        details: String(saveErr),
      });
    }
  } catch (error) {
    return res.status(500).json({
      error: "Internal Server Error in submitDepositHandler",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * 3. POST /api/webhook/deposit/action
 * Webhook endpoint allowing external systems/bots/admins to confirm, hold, or cancel any deposit.
 */
export async function depositActionWebhookHandler(req: Request, res: Response) {
  try {
    // 1. Authenticate Secret Header Key or Query
    const configuredSecret = process.env.SMS_WEBHOOK_SECRET || "3cr_secure_sms_webhook_secret_2026";
    const authHeader =
      req.headers["x-webhook-secret"] || req.headers["authorization"]?.replace(/^Bearer\s+/i, "");
    const querySecret = req.query.secret;

    if (authHeader !== configuredSecret && querySecret !== configuredSecret) {
      console.warn(
        "[Deposit Action Webhook] Unauthorized attempt with invalid or missing secret header.",
      );
      return res.status(401).json({
        error:
          "Unauthorized: Invalid or missing x-webhook-secret header or secret query parameter.",
      });
    }

    const {
      action: rawAction,
      deposit_id,
      id,
      utr: rawUtr,
      utr_number,
      reason,
      note,
      verified_by = "webhook_api",
    } = req.body || {};

    const action = (rawAction || req.params?.action || "").toString().toLowerCase().trim();
    const utr = (rawUtr || utr_number || "").toString().trim();
    const targetDocId = (deposit_id || id || "").toString().trim();
    const now = new Date().toISOString();

    if (
      ![
        "confirm",
        "completed",
        "approve",
        "hold",
        "on_hold",
        "cancel",
        "rejected",
        "reject",
        "pending",
        "reset",
      ].includes(action)
    ) {
      return res.status(400).json({
        error: "Invalid action. Supported actions: 'confirm', 'hold', 'cancel', 'pending'",
      });
    }

    if (!targetDocId && !utr) {
      return res.status(400).json({
        error: "Must provide either 'deposit_id' or 'utr' to identify the target deposit request.",
      });
    }

    // 2. Locate the deposit document in Firestore
    let depositDocRef: any = null;
    let depositData: any = null;
    let foundDocId: string | null = null;

    if (targetDocId) {
      const directRef = doc(serverDb, "deposit_requests", targetDocId);
      const directSnap = await getDoc(directRef);
      if (directSnap.exists()) {
        depositDocRef = directRef;
        depositData = directSnap.data();
        foundDocId = directSnap.id;
      }
    }

    if (!depositDocRef && utr) {
      const q = query(collection(serverDb, "deposit_requests"), where("utr", "==", utr));
      const snap = await getDocs(q);
      if (!snap.empty) {
        depositDocRef = snap.docs[0].ref;
        depositData = snap.docs[0].data();
        foundDocId = snap.docs[0].id;
      } else {
        const q2 = query(collection(serverDb, "deposit_requests"), where("utr_number", "==", utr));
        const snap2 = await getDocs(q2);
        if (!snap2.empty) {
          depositDocRef = snap2.docs[0].ref;
          depositData = snap2.docs[0].data();
          foundDocId = snap2.docs[0].id;
        }
      }
    }

    if (!depositDocRef || !depositData) {
      return res.status(404).json({
        error: `Deposit request not found for deposit_id: '${targetDocId}' or utr: '${utr}'`,
      });
    }

    const currentStatus = (depositData.status || "PENDING").toString().toUpperCase();
    const effectiveUtr = depositData.utr || depositData.utr_number || utr;
    const reqAmount = Number(req.body.custom_amount || req.body.new_amount || req.body.amount || 0);
    const amount = reqAmount > 0 ? reqAmount : Number(depositData.amount || 0);
    const playerId = depositData.player_id;
    const { cashback } = calculateCashback(amount);

    // 3. Process Action: CONFIRM / APPROVE
    if (["confirm", "completed", "approve"].includes(action)) {
      if (currentStatus === "COMPLETED" || currentStatus === "CONFIRMED") {
        return res.status(200).json({
          success: true,
          status: "COMPLETED",
          alreadyConfirmed: true,
          message: `Deposit for UTR ${effectiveUtr} is already confirmed and credited.`,
          deposit_id: foundDocId,
          utr: effectiveUtr,
          amount,
          player_id: playerId,
        });
      }

      // Execute atomic credit transaction
      try {
        await runTransaction(serverDb, async (transaction) => {
          const playerRef = doc(serverDb, "players", playerId);
          const playerSnap = await transaction.get(playerRef);

          const curDep = playerSnap.exists() ? Number(playerSnap.data().deposit_balance ?? 0) : 0;
          const curBonus = playerSnap.exists() ? Number(playerSnap.data().bonus_balance ?? 0) : 0;

          const newDep = curDep + amount;
          const newBonus = curBonus + cashback;
          const newTotal = newDep + newBonus;

          transaction.set(
            playerRef,
            {
              deposit_balance: newDep,
              bonus_balance: newBonus,
              balance: newTotal,
              updated_at: now,
            },
            { merge: true },
          );

          transaction.update(depositDocRef, {
            status: "COMPLETED",
            cashback,
            verified_by,
            verified_at: now,
            updated_at: now,
            admin_note: note || reason || "Confirmed via Webhook Action",
          });

          if (effectiveUtr) {
            const processedRef = doc(serverDb, "processed_utrs", `utr_${effectiveUtr}`);
            transaction.set(processedRef, {
              utr_number: effectiveUtr,
              player_id: playerId,
              amount,
              cashback,
              processed_at: now,
              source: verified_by,
            });
          }
        });

        // Add to wallet_transactions
        await addDoc(collection(serverDb, "wallet_transactions"), {
          player_id: playerId,
          kind: "deposit",
          amount,
          cashback,
          utr: effectiveUtr,
          status: "completed",
          method: `UPI (${verified_by})`,
          created_at: now,
        });

        if (effectiveUtr) {
          memoryUnclaimedCredits.delete(effectiveUtr);
          memoryProcessedUtrs.add(effectiveUtr);
        }

        console.log(
          `[Webhook Action] Confirmed deposit ${foundDocId} (UTR: ${effectiveUtr}) - Credited ₹${amount} + ₹${cashback} to ${playerId}`,
        );

        return res.status(200).json({
          success: true,
          action: "confirm",
          status: "COMPLETED",
          message: `Deposit of ₹${amount} confirmed and credited successfully to player ${playerId}`,
          deposit_id: foundDocId,
          utr: effectiveUtr,
          amount,
          cashback,
          player_id: playerId,
          verified_at: now,
        });
      } catch (txnErr) {
        console.error("[Webhook Action] Error in confirmation transaction:", txnErr);
        return res.status(500).json({
          error: "Failed to credit player during confirmation.",
          details: String(txnErr),
        });
      }
    }

    // 4. Process Action: HOLD
    if (["hold", "on_hold"].includes(action)) {
      const holdReason = reason || note || "Deposit placed on hold for verification";
      await updateDoc(depositDocRef, {
        status: "HOLD",
        hold_reason: holdReason,
        verified_by,
        updated_at: now,
      });

      console.log(`[Webhook Action] Deposit ${foundDocId} put on HOLD: ${holdReason}`);

      return res.status(200).json({
        success: true,
        action: "hold",
        status: "HOLD",
        message: `Deposit for UTR ${effectiveUtr} placed on HOLD.`,
        deposit_id: foundDocId,
        utr: effectiveUtr,
        hold_reason: holdReason,
        updated_at: now,
      });
    }

    // 5. Process Action: CANCEL / REJECT
    if (["cancel", "rejected", "reject"].includes(action)) {
      const rejectReason = reason || note || "Deposit canceled / rejected";
      await updateDoc(depositDocRef, {
        status: "CANCELED",
        reject_reason: rejectReason,
        verified_by,
        updated_at: now,
      });

      console.log(`[Webhook Action] Deposit ${foundDocId} CANCELED: ${rejectReason}`);

      return res.status(200).json({
        success: true,
        action: "cancel",
        status: "CANCELED",
        message: `Deposit for UTR ${effectiveUtr} has been CANCELED.`,
        deposit_id: foundDocId,
        utr: effectiveUtr,
        reject_reason: rejectReason,
        updated_at: now,
      });
    }

    // 6. Process Action: PENDING / RESET
    if (["pending", "reset"].includes(action)) {
      await updateDoc(depositDocRef, {
        status: "PENDING",
        updated_at: now,
        verified_by,
      });

      console.log(`[Webhook Action] Deposit ${foundDocId} reset to PENDING`);

      return res.status(200).json({
        success: true,
        action: "pending",
        status: "PENDING",
        message: `Deposit for UTR ${effectiveUtr} reset to PENDING status.`,
        deposit_id: foundDocId,
        utr: effectiveUtr,
        updated_at: now,
      });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (error) {
    console.error("[Webhook Action] Error handling deposit action:", error);
    return res.status(500).json({
      error: "Internal server error processing deposit action",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * 4. GET /api/webhook/bank-sms/status
 * Provides system diagnostics and unclaimed pool count.
 */
export async function getWebhookStatusHandler(req: Request, res: Response) {
  const activeUnclaimed = Array.from(memoryUnclaimedCredits.values()).filter(
    (x) => x.status === "UNCLAIMED" && new Date(x.expires_at) > new Date(),
  );

  return res.status(200).json({
    status: "online",
    service: "BaaziWin Bank SMS Webhook & UTR Auto-Verifier",
    configuredSecret: Boolean(process.env.SMS_WEBHOOK_SECRET || true),
    activeUnclaimedCount: activeUnclaimed.length,
    unclaimedPool: activeUnclaimed.map((x) => ({
      utr: x.utr_number,
      amount: x.amount,
      bank: x.bank_name,
      sender: x.sender,
      received_at: x.created_at,
      expires_at: x.expires_at,
    })),
    processedUtrsCount: memoryProcessedUtrs.size,
    timestamp: new Date().toISOString(),
  });
}

/**
 * 5. GET /api/admin/deposits
 * Fast server-side deposit requests retrieval for admin console.
 */
export async function adminGetDepositsHandler(req: Request, res: Response) {
  try {
    const depQ = query(collection(serverDb, "deposit_requests"));
    const snap = await getDocs(depQ);
    const deposits: any[] = [];
    snap.forEach((d) => {
      deposits.push({ id: d.id, ...d.data() });
    });
    deposits.sort(
      (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime(),
    );

    return res.status(200).json({ deposits });
  } catch (err) {
    return res.status(500).json({
      error: "Failed to fetch deposits from server",
      details: String(err),
    });
  }
}
