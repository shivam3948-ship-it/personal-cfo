// Spoken status (D-104): while Munim works, the voice says what it is looking at, driven by the tool that is actually running,
// instead of a fixed "one second". Fixed lines: no figures, no fund or product names, no instruction, so nothing here needs the
// answer checks. Male first person ("देख रहा हूँ") matches the voice (D-103, `shubh_hi_customer`); change both together.
// Safe to import on the phone: plain strings only.

type Line = { hi: string; en: string };
const LOOK = (hi: string, en: string): Line => ({ hi: `${hi} देख रहा हूँ।`, en });

export const STATUS: Record<string, Line> = {
  sunday_briefing: LOOK('इस हफ़्ते का हाल', 'Pulling up this week.'),
  money_overview: LOOK('पूरी तस्वीर', 'Looking at the full picture.'),
  spending_breakdown: LOOK('ख़र्च का हिसाब', 'Going through the spending.'),
  subscriptions_and_leaks: LOOK('सब्सक्रिप्शन', 'Checking the subscriptions.'),
  unusual_spending: LOOK('कोई अलग ख़र्च तो नहीं, ये', 'Checking for unusual spends.'),
  upcoming_dues: LOOK('आने वाले बिल और EMI', 'Checking upcoming bills and EMIs.'),
  loans_overview: LOOK('लोन', 'Looking at the loans.'),
  simulate_prepayment: { hi: 'लोन जल्दी चुकाने का हिसाब लगा रहा हूँ।', en: 'Working out an early payment.' },
  loan_negotiation: LOOK('लोन की ब्याज दर', 'Looking at the loan rates.'),
  insurance_overview: LOOK('बीमा', 'Looking at the insurance.'),
  claim_helper: LOOK('क्लेम के काग़ज़', 'Looking up the claim steps.'),
  credit_health: LOOK('क्रेडिट कार्ड', 'Checking the credit cards.'),
  emergency_fund: LOOK('इमरजेंसी फ़ंड', 'Checking the emergency fund.'),
  portfolio_xray: LOOK('म्यूचुअल फ़ंड', 'Looking at the mutual funds.'),
  search_documents: LOOK('काग़ज़ात', 'Searching the documents.'),
  money_audit: LOOK('पूरा हिसाब', 'Going through everything.'),
  sip_calculator: { hi: 'SIP का हिसाब लगा रहा हूँ।', en: 'Working out the SIP.' },
  create_reminder: { hi: 'रिमाइंडर तैयार कर रहा हूँ।', en: 'Setting up the reminder.' },
  draft_email: { hi: 'ईमेल का ड्राफ़्ट लिख रहा हूँ।', en: 'Drafting the email.' },
  create_savings_goal: { hi: 'बचत का लक्ष्य तैयार कर रहा हूँ।', en: 'Setting up the savings goal.' },
  save_prepayment_plan: { hi: 'प्लान सेव कर रहा हूँ।', en: 'Saving the plan.' },
};
const OTHER: Line = { hi: 'हिसाब लगा रहा हूँ।', en: 'Working it out.' };

/** The line to say while `tool` runs. Tools without their own line (advice ones included) get the plain "working it out". */
export const statusLine = (tool: string, lang: 'hi' | 'en'): string => (Object.hasOwn(STATUS, tool) ? STATUS[tool] : OTHER)[lang];

/** At most two status lines a turn, never the same one twice, and none once the answer itself has started. */
export function statusGate(max = 2) {
  const said = new Set<string>(); let answered = false;
  return {
    next(tool: string, lang: 'hi' | 'en'): string | null {
      if (answered || said.size >= max) return null;
      const line = statusLine(tool, lang);
      if (said.has(line)) return null;
      said.add(line); return line;
    },
    answering() { answered = true; },
  };
}
