export interface ParsedBankSms {
  isCredit: boolean;
  utr: string | null;
  amount: number | null;
  sender: string;
  rawText: string;
  bankName?: string;
  timestamp: string;
  error?: string;
}

/**
 * Parses raw Bank / Payment SMS notifications to extract 12-digit UTR and credited amount.
 */
export function parseBankSms(
  text: string,
  sender: string = "BANK_SMS",
  timestamp?: string,
): ParsedBankSms {
  const rawText = text || "";
  const time = timestamp || new Date().toISOString();

  // 1. Identify Bank from sender or message
  const bankPatterns: { [key: string]: RegExp } = {
    SBI: /(?:SBI|State Bank|SBIN)/i,
    HDFC: /HDFC/i,
    ICICI: /ICICI/i,
    AXIS: /AXIS/i,
    KOTAK: /KOTAK/i,
    PAYTM: /PAYTM/i,
    PHONEPE: /PHONEPE/i,
    GPAY: /(?:GPAY|GOOGLE PAY)/i,
    PNB: /PNB/i,
    BOB: /(?:BOB|Bank of Baroda)/i,
  };

  let detectedBank: string = "UPI / Bank";
  for (const [bank, regex] of Object.entries(bankPatterns)) {
    if (regex.test(sender) || regex.test(rawText)) {
      detectedBank = bank;
      break;
    }
  }

  // 2. Validate Credit Transaction
  const creditKeywords =
    /(?:credited|received|deposited|added|payment received|transfer received)/i;
  const debitKeywords = /(?:debited|sent to|paid to|transferred from|withdrawn|declined|failed)/i;

  const hasCredit = creditKeywords.test(rawText);
  const hasDebit = debitKeywords.test(rawText);

  // If message explicitly says "debited" and has no "credited", discard
  if (!hasCredit || (hasDebit && !rawText.toLowerCase().includes("credited to"))) {
    return {
      isCredit: false,
      utr: null,
      amount: null,
      sender,
      rawText,
      bankName: detectedBank,
      timestamp: time,
      error: "Message is not a credit transaction.",
    };
  }

  // 3. Extract 12-Digit UTR / UPI Ref Number
  // Pattern 1: With explicit prefix
  const utrPrefixRegex =
    /(?:UPI\s*Ref(?:erence)?(?:\s*No|\s*Num)?|UTR(?:\s*No)?|Ref\s*No|Txn\s*ID|Transaction\s*ID|RRN|Ref)[ :#-]*([0-9]{12})/i;
  // Pattern 2: Inside UPI path format (e.g. UPI/123456789012 or RRN:123456789012)
  const utrSlashRegex = /(?:UPI|RRN|IMPS|Txn)\/([0-9]{12})/i;
  // Pattern 3: Any standalone 12-digit number (fallback)
  const utrStandaloneRegex = /\b([0-9]{12})\b/;

  let extractedUtr: string | null = null;
  const matchUtr1 = rawText.match(utrPrefixRegex);
  if (matchUtr1 && matchUtr1[1]) {
    extractedUtr = matchUtr1[1];
  } else {
    const matchUtr2 = rawText.match(utrSlashRegex);
    if (matchUtr2 && matchUtr2[1]) {
      extractedUtr = matchUtr2[1];
    } else {
      const matchUtr3 = rawText.match(utrStandaloneRegex);
      if (matchUtr3 && matchUtr3[1]) {
        extractedUtr = matchUtr3[1];
      }
    }
  }

  // 4. Extract Amount
  // Pattern A: "Rs. 500 credited" or "INR 1000.00 received"
  const amountPatternA =
    /(?:Rs\.?|INR)\s*([0-9]+(?:\.[0-9]{1,2})?)\s*(?:is|has been)?\s*(?:credited|received|deposited|added)/i;
  // Pattern B: "credited by Rs. 500" or "received with INR 1000"
  const amountPatternB =
    /(?:credited|received|deposited|added)(?:\s+by|\s+with|\s+of)?\s*(?:Rs\.?|INR)?\s*([0-9]+(?:\.[0-9]{1,2})?)/i;
  // Pattern C: "Payment of INR 500 received"
  const amountPatternC =
    /(?:payment|transfer|credit)\s+of\s+(?:Rs\.?|INR)?\s*([0-9]+(?:\.[0-9]{1,2})?)/i;
  // Pattern D: Generic currency followed by number
  const amountPatternD = /(?:Rs\.?|INR)\s*([0-9]+(?:\.[0-9]{1,2})?)/i;

  let extractedAmount: number | null = null;
  const matchAmtA = rawText.match(amountPatternA);
  if (matchAmtA && matchAmtA[1]) {
    extractedAmount = parseFloat(matchAmtA[1]);
  } else {
    const matchAmtB = rawText.match(amountPatternB);
    if (matchAmtB && matchAmtB[1]) {
      extractedAmount = parseFloat(matchAmtB[1]);
    } else {
      const matchAmtC = rawText.match(amountPatternC);
      if (matchAmtC && matchAmtC[1]) {
        extractedAmount = parseFloat(matchAmtC[1]);
      } else {
        const matchAmtD = rawText.match(amountPatternD);
        if (matchAmtD && matchAmtD[1]) {
          extractedAmount = parseFloat(matchAmtD[1]);
        }
      }
    }
  }

  // Sanity check
  if (!extractedUtr || extractedAmount === null || isNaN(extractedAmount) || extractedAmount <= 0) {
    return {
      isCredit: true,
      utr: extractedUtr,
      amount: extractedAmount,
      sender,
      rawText,
      bankName: detectedBank,
      timestamp: time,
      error: !extractedUtr
        ? "Unable to find 12-digit UTR in SMS text"
        : "Unable to extract valid credited amount",
    };
  }

  return {
    isCredit: true,
    utr: extractedUtr,
    amount: Math.round(extractedAmount * 100) / 100,
    sender,
    rawText,
    bankName: detectedBank,
    timestamp: time,
  };
}
