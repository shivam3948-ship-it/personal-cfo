# Munim privacy policy: DRAFT (17 Oct 2026)

> **Draft for review by a lawyer. Not legal advice, and not in force.**
> - Written against the Digital Personal Data Protection Act, 2023 and the DPDP Rules, 2025 (notified 14 Nov 2025, with an 18-month phased compliance period, per the [PIB note](https://static.pib.gov.in/WriteReadData/specificdocs/documents/2025/nov/doc20251117695301.pdf)).
> - It describes what the code in `apps/web` does on 17 Oct 2026; update it whenever data flows change.
> - Items marked ⚠ must be confirmed before launch.

## Who we are
- Munim is an invite-only beta run by Shivam Singh ("we").
- Contact for privacy questions and grievances: ⚠ [name, email, phone of the grievance contact]. We reply within ⚠ [period; the Rules allow at most 90 days for access, correction and erasure requests].

## What we collect, and why
| Data | Why | Where it goes |
|---|---|---|
| Mobile number | To sign you in (one-time code) | Our database (Supabase ⚠ region) |
| Your consent choices (analyse, AI explanations, voice) | To do only what you allowed | Our database |
| Mutual fund statement (CAS) | To show your portfolio | **Read on your phone with its password.** Only fund holdings and transactions, without your name, PAN or folio numbers, are sent to us. The PDF and the password never leave your phone |
| Bank or card statements, SMS, emails, policy or loan documents you upload | To show your money picture | Processed on our server. Names, PAN, phone numbers, emails and account numbers are removed before any AI sees the text |
| Family members you add (a label such as "Papa", the relation, your statement that you have their permission) | To show their picture when you choose to | Our database |
| Actions you create (reminders, email drafts) | To remind you; drafts are never sent for you | Our database |
| Voice recordings (only if you turn voice on) | To turn speech into text | Sent to Sarvam AI for speech-to-text. We don't store the audio. ⚠ Confirm Sarvam's retention terms |

## AI
- Explanations may be written by Anthropic's Claude.
- What Claude receives: your question and figures computed by our code, with personal identifiers removed. ⚠ This may involve processing outside India; confirm with the provider and disclose the countries.
- Every number in an answer is checked against your data before you see it.
- Munim gives guidance with a disclaimer. It is not SEBI-registered investment advice.

## What we don't do
- We don't sell your data.
- We don't use it for ads.
- We don't share it with lenders or insurers.

## Your rights
You can:
- see the data we hold;
- correct it;
- withdraw consent at any time (in **You → Privacy**);
- delete everything (**You → Delete all my data**);
- name someone to act for you;
- complain to the Data Protection Board of India.

## How long we keep data
- Until you delete it, or ⚠ [N months] after your last sign-in, whichever comes first.
- Server logs hold no statement text and are kept for ⚠ [N days].

## Security
- Encrypted connections.
- Each user's rows locked to that user (row-level security).
- Rate limits on paid services.
- If a breach affects you, we will tell you without delay: what happened, the likely impact, what we did, and whom to contact.

## Children
Munim is not for people under 18.

## Changes
We will tell you in the app before any change that affects how your data is used.
