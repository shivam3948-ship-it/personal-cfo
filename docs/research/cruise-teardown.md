# Cruise Money: app teardown (22 Oct 2026)

**Source:** Shivam's screen recording (Android, 7m 51s), reviewed frame by frame. His personal details and portfolio figures are left out on purpose. The recording itself stays out of the repo because it shows his PAN, phone number and OTPs.

## The flow
1. **Mood check.** A slider ("somewhat") and a quadrant (overwhelmed ↔ in control, anxious ↔ confident), with "12,400+ others also answered and we mapped where they stand". Then role and career pickers. Social proof plus self-reflection before any data.
2. **Sign-up asks for a lot up front.** Name as per PAN, phone, OTP, and two checkboxes: fetch demographic details from the credit bureau, and fetch bank account details by phone number (via a partner). Then a long Terms & Conditions screen.
3. **"Let's begin with the simplest yet most potent step: reviewing your mutual funds."** It uses fear-of-loss cards: "Those who review portfolios annually outperform others by 2.1%" (no source given) and "Your money may be running in circles" (overlap).
4. **Data in:** MF Central inside the app. PAN, then OTP, then CAS preferences (regular + direct, transactions, all fund houses), then generate a QR code, then "fetching your portfolio… may take a few minutes". Particle animations play while it waits.
5. **"MF Wrapped" story** (Spotify-Wrapped style, one full screen per insight):
   - "You've built ₹X in N years. Here's what's working", with an XIRR shown as "steady, compound wealth";
   - "100% direct plans: every rupee compounds without broker drag";
   - "N funds, well-spread: genuinely diversified, not overlapped";
   - "**Exit loads will cost you ₹X if you leave today.** Wait 12 more days and this cost vanishes";
   - "Your portfolio is healthy… now let's make it even stronger", followed by a pitch for a personalised plan.
6. **Home:** Assets (hidden by default, "show"), WealthSpan "unknown", Standing "unknown". Plan and Spend tiles. A feed of cards:
   - "**Important**: link your bank to unlock your full WealthSpan score", with a hospital-bed illustration and a long essay on savings rate (20–30% "recommended");
   - "Your MF Wrapped is here";
   - an editorial piece, "A rising portfolio and a comfortable bank balance. Neither one tells you if you're on track" (a long essay);
   - a video, "What is Cruise Money? Your financial superintelligence".
7. **Ask anything:** chat with suggested follow-ups ("What counts as savings?", "Is it safe to link my bank?").
8. **Goals:** pick a goal (emergency fund, wedding, down payment, international trip), then "I want to build my emergency fund worth ~₹3 lakhs in the next 2 years", then "**invest ₹11,290/month for 24 months**, costs ₹2.7L in total" with a straight-line chart. "About the fund mix" points to **index funds, because "your aggressive risk profile"**. Then "Proceed with this route" and "Verification in progress".

## What's good (worth learning from)
- **Insights with a rupee figure, a reason and a date**, especially the exit-load card ("₹X if you leave today; wait 12 days"). That's the same pattern as our X-ray v2.
- **One insight per screen, told as a story** (Wrapped). It's memorable and easy to share.
- **The thesis matches ours.** "Neither the bank balance nor the green portfolio tells you if you're on track" is our top job, "is my money really working?", in their words.
- **Grounded chat with suggested next questions.**
- **CAS through MF Central inside the app.** No PDF, no password; the user only enters OTPs.

## What's weak (where Munim should differ)
1. **Data before value.** PAN, phone, credit-bureau and bank-detail consents come before a single insight. PowerUp's reviews show that this exact pattern drives "spam calls" and "data misuse" complaints (91 of 576 negative reviews). Munim reads the CAS on the phone, shows value first, and asks for the least possible.
2. **Positive by default, with no benchmark.** It calls the portfolio "steady" and "healthy" without comparing the return to anything (an FD, the user's own funds, an index). Our "your money vs your funds" and the index-fund card say how good the number actually is.
3. **The emergency fund goes into equity index funds over 24 months** because of an "aggressive risk profile". That contradicts what an emergency fund is for (D-040: bank, liquid and debt funds you can withdraw in days). Risk appetite is being used where risk capacity matters. That's idea B1 from the JM review.
4. **The goal amount is the user's guess** ("~₹3 lakhs"). Munim computes it: 6 months of essentials from the bank statement.
5. **Fear and nagging.** A hospital-bed drawing on an "Important" card, essay-length copy, and the WealthSpan score stays "unknown" until you link a bank.
6. **Unsourced statistics** ("outperform others by 2.1%", "20–30% recommended") stated as fact.
7. **Look:** dark purple, glowing particles, all-lowercase serif headings, long English text. It looks premium but is heavy: animations everywhere, minutes-long loading screens, English only. That's a poor fit for low-end phones and tier-2/3 users.

## Ideas to borrow (proposals)
- **C1. "Wrapped" story** after the first CAS read: 4–5 full-screen cards built from X-ray v2 insights, ending in one action. Shareable without amounts.
- **C2. Exit-load timing card:** "₹X exit load if you sell today; nil after <date>". It needs exit-load data per scheme, which isn't in the CAS (D-OPEN-3 territory).
- **C3. MF Central fetch inside the app (OTP + QR)** as a second way in beside the PDF upload. Check whether MF Central allows third-party apps and what consent it needs.
- **C4. Suggested follow-up questions under every Ask Munim answer.**
