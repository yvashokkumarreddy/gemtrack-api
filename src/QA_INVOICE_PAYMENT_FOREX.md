# QA Guide: Invoices, Payments & Forex Gain/Loss

Guide for testers covering how invoices, payments, and exchange gain/loss work together in Carat Logic Inventory.

---

## 1. Concepts (read this first)

### Three currencies

| Term | Also called | Meaning |
|------|-------------|---------|
| **Ledger currency** | Base / tenant currency | Currency on the company JWT (e.g. USD). Invoice totals, paid amounts, and forex P/L are **stored** in this currency. |
| **Invoice currency** | Document / target currency | Currency printed on the invoice (e.g. EUR). Locked with an exchange rate when the invoice is created. |
| **Paid-in currency** | Payment / settlement currency | Currency the customer actually pays in. Can match invoice currency, ledger currency, or a third currency. |

### Rate convention (important)

Stored rates follow:

> **1 ledger unit = `rate` invoice (or payment) units**

Example: invoice for **2,000 EUR** booked as **2,300 USD**

- Stored `target.rate` ≈ `2000 / 2300` ≈ **0.8696**
- UI often **quotes the inverse**: `1 USD = € 0.8696`

### What “booked” vs “cash” means

When recording a payment:

| Field | Meaning |
|-------|---------|
| **Booked (ledger)** | Amount applied against the invoice receivable (`payment.amount`). Always in ledger currency. |
| **Cash (ledger)** | What the money is worth at the **payment-date** rate. |
| **Forex P/L** | `cash − booked` in ledger currency. **Positive = profit/gain**, **negative = loss**. |

Equation shown on the invoice payments overview:

```text
Cash + FX loss − FX gain = Booked
```

### Invoice status after payments

Effective paid = `paidAmount` + `creditNoteAmount`.

| Condition | Status | Outstanding |
|-----------|--------|-------------|
| Effective paid = 0 | `UNPAID` | Full total |
| 0 < Effective paid < total | `PARTIAL` | Remaining |
| Effective paid ≥ total | `PAID` | `0` |

Overpayment is **blocked in the UI**. Backend also rejects a new payment when the invoice is already `PAID` with no outstanding.

### When forex is **zero**

Forex P/L is stored as `0` when any of these apply:

1. Invoice currency, ledger currency, and paid-in currency are **all the same**
2. Payment uses the **same rate** as the invoice (default UI case — “Invoice rate”)
3. Customer pays in the **ledger currency** (no payment-date FX leg)
4. Payment method is **Wallet** (always forced to 0)
5. Rate is missing, zero, or negative (calculation falls back to 0)

### Formula (backend)

```text
forexProfitOrLoss = round2( bookedAmount × invoiceRate / paymentRate − bookedAmount )
```

Worked example (loss):

| Step | Value |
|------|-------|
| Invoice | 2,000 EUR = 2,300 USD → invoice rate ≈ 0.8696 |
| Market at payment | 2,000 EUR = 2,250 USD → payment rate ≈ 0.8889 |
| Booked amount sent to API | 2,300 USD |
| Forex | `2300 × 0.8696 / 0.8889 − 2300` ≈ **−50** (loss) |
| Cash received (ledger) | 2,300 + (−50) = **2,250 USD** |

Worked example (gain) — pay EUR when EUR strengthened vs invoice rate: reverse the rate move so cash ledger > booked → **positive** forex.

---

## 2. Where to test in the UI

| Area | What to check |
|------|----------------|
| **Create / Edit Invoice** | Ledger vs invoice currency, locked rate, totals in both currencies |
| **Record Payment** | Paid-in currency, rate source (Invoice / Current / Manual), amount, Result card (Applied / Booked / FX) |
| **Invoice → Payments overview** | Currency summary, per-payment cards, Ledger table, Forex profit/loss |
| **Payments list** | Column **Forex P/L** (green gain / red loss) |
| **Payment receipt PDF / email** | Amounts and currencies on receipt |

Payment methods available: Cash, Bank Transfer, Credit/Debit Card, UPI, Cheque, Online, Wallet, Other.

---

## 3. Prerequisites / test data setup

Use a tenant whose **ledger currency is USD** (examples below assume USD). Adjust numbers if the tenant base differs.

Suggested fixtures:

1. Customer A — default currency EUR  
2. Customer B — default currency USD  
3. Customer C — with **wallet balance** in ledger currency  
4. Exchange rates available for EUR↔USD (and optionally GBP)

For each scenario, note:

- Invoice number  
- Locked invoice rate  
- Payment rate used  
- Expected booked, cash, forex, and final invoice status  

---

## 4. Test scenarios

### Scenario 1 — Same-currency invoice, full payment (no FX)

**Setup:** Create invoice in **USD** (same as ledger). Total = **1,000 USD**. Status `UNPAID`.

**Steps:**

1. Record Payment → paid-in **USD**, amount **1,000**, any non-wallet method.  
2. Submit.

**Expected:**

- Invoice → `PAID`, outstanding `0`, paidAmount `1000`  
- Payment `forexProfitOrLoss` = **0**  
- Result card: no FX difference (or FX = 0)  
- Payments overview: no Forex profit/loss line  

---

### Scenario 2 — Foreign-currency invoice paid at **invoice rate** (no FX)

**Setup:** Invoice **2,000 EUR** locked at rate so ledger total = **2,300 USD** (`target.rate` ≈ 0.8696).

**Steps:**

1. Record Payment → paid-in **EUR**.  
2. Rate source = **Invoice** (default when available).  
3. Use **Pay in full** (should fill ~2,000 EUR).  
4. Submit.

**Expected:**

- Invoice → `PAID`  
- Forex = **0** (payment rate equals invoice rate)  
- Booked = **2,300 USD**; cash ledger = **2,300 USD**  
- Overview: “No FX difference” / no forex line  

---

### Scenario 3 — Forex **loss** (EUR weaker at payment)

**Setup:** Same invoice as Scenario 2 (2,000 EUR = 2,300 USD).

**Steps:**

1. Paid-in **EUR**.  
2. Rate source = **Manual** (or Current if market moved).  
3. Set rate so **2,000 EUR = 2,250 USD** (EUR bought less USD than at invoice).  
4. Pay in full (~2,000 EUR).  
5. Submit.

**Expected:**

- Invoice → `PAID`  
- Forex P/L ≈ **−50 USD** (loss, red)  
- Booked ≈ **2,300**; cash ≈ **2,250**  
- Overview equation: `Cash + FX loss = Booked`  
- Payments list **Forex P/L** shows negative / loss styling  

---

### Scenario 4 — Forex **gain** (EUR stronger at payment)

**Setup:** Same invoice (2,000 EUR = 2,300 USD).

**Steps:**

1. Paid-in **EUR**.  
2. Manual rate so **2,000 EUR = 2,400 USD**.  
3. Pay in full.  
4. Submit.

**Expected:**

- Invoice → `PAID`  
- Forex P/L ≈ **+100 USD** (gain, green)  
- Cash ≈ **2,400**; booked ≈ **2,300**  
- Overview: `Cash − FX gain = Booked`  

---

### Scenario 5 — Partial payment with proportional FX loss

**Setup:** Same invoice (2,000 EUR / 2,300 USD). Status `UNPAID`.

**Steps:**

1. Paid-in **EUR**, same loss rate as Scenario 3 (market 2,000 EUR = 2,250 USD).  
2. Enter **1,000 EUR** (half).  
3. Submit.

**Expected:**

- Invoice → `PARTIAL`  
- Outstanding ≈ **1,000 EUR** / **1,150 USD**  
- Forex ≈ **−25 USD** (half of −50)  
- Second payment of remaining 1,000 EUR at same rate → invoice `PAID`, second forex ≈ −25; **sum of forex ≈ −50**  

---

### Scenario 6 — Multiple payments, mixed rates

**Setup:** Invoice 2,000 EUR = 2,300 USD.

**Steps:**

1. Pay **1,000 EUR** at **invoice rate** → forex **0**.  
2. Pay remaining **1,000 EUR** at loss rate (half of Scenario 3 market) → forex ≈ **−25**.

**Expected:**

- Final status `PAID`  
- Overview shows two payment cards; ledger FX total ≈ **−25**  
- First card: no forex line; second: forex loss  

---

### Scenario 7 — Pay in **ledger currency** against foreign invoice (no forex)

**Setup:** Invoice 2,000 EUR = 2,300 USD, outstanding full.

**Steps:**

1. Change paid-in currency to **USD**.  
2. Enter **2,300** (or Pay in full).  
3. Rate source may show **Invoice** (invoice rate available for ledger settlement).  
4. Submit.

**Expected:**

- Invoice → `PAID`  
- Forex = **0** (paying in base/ledger skips payment-date FX)  
- Booked = cash = **2,300 USD**  

---

### Scenario 8 — Third currency (e.g. invoice EUR, pay GBP, ledger USD)

**Setup:** Invoice EUR / ledger USD. Paid-in **GBP**.

**Steps:**

1. Select paid-in **GBP**.  
2. Confirm UI asks for settle rate (EUR↔GBP) **and** ledger rate (GBP↔USD) when all three differ.  
3. Enter rates that produce a known gain, e.g. booked **1,000 USD** with payment rates yielding forex **+125** (unit-test case: invoice rate 0.9, payment rate 0.8).  
4. Submit a partial or full amount that does not exceed outstanding.

**Expected:**

- Both rate fields required when layout shows primary + ledger  
- Forex ≠ 0 when rates differ from a no-FX path  
- Payment `target.currency` = **GBP**  
- Overview shows GBP badge on the payment card  

---

### Scenario 9 — Wallet payment (forex always 0)

**Setup:** Foreign invoice with outstanding; customer has wallet balance ≥ outstanding ledger amount.

**Steps:**

1. Payment method = **Wallet**.  
2. Confirm paid-in currency snaps to **ledger** (USD).  
3. Pay full outstanding.  
4. Submit.

**Expected:**

- Invoice → `PAID`  
- Forex **always 0** even if invoice was foreign currency  
- Wallet balance decreases by booked ledger amount  
- Cannot overpay beyond wallet balance (UI error)  

---

### Scenario 10 — Overpayment blocked

**Setup:** Invoice outstanding = 1,000 EUR.

**Steps:**

1. Enter amount that converts to **more** than outstanding (e.g. 1,050 EUR).  
2. Attempt submit.

**Expected:**

- Amount error: exceeds outstanding by X (invoice currency)  
- Submit disabled / payment not created  
- Invoice unchanged  

---

### Scenario 11 — Payment on already fully paid invoice

**Setup:** Invoice already `PAID`, outstanding `0`.

**Steps:**

1. Try Record Payment against that invoice (if selectable).  
2. Or call create payment API for that invoice id.

**Expected:**

- Error: invoice already marked as paid / no outstanding (`IMS-40035`)  
- No second payment created  

---

### Scenario 12 — FX difference handling: **Write off** vs **Leave open**

**Setup:** Foreign invoice; pay in a **non-invoice** currency (or create a small shortfall ≤ **5%** of outstanding when not paying in invoice currency).

**Steps:**

1. Enter amount/rate so Result card shows an FX difference and handling options.  
2. Choose **Write off** → note Applied, Written off (FX difference), Outstanding after, Realised FX.  
3. Cancel / reset; choose **Leave open** → note different Outstanding after and FX.  
4. Submit one of the options and verify saved payment matches the preview.

**Expected:**

- Write off: may close invoice and absorb small gap as FX write-off  
- Leave open: credits at invoice rate; may leave residual outstanding  
- Leave open that would over-credit outstanding is treated as overpayment (blocked)  
- Saved payment forex matches Result card realised FX  

---

### Scenario 13 — Rate sources: Invoice / Current / Manual

**Setup:** Foreign invoice with locked rate; market rate different.

**Steps:**

1. Paid-in = invoice currency.  
2. Toggle **Invoice** → primary rate = locked invoice rate → FX preview **0** at pay-in-full.  
3. Toggle **Current** → rate fetches live → FX preview may be non-zero.  
4. Type a custom rate → source becomes **Manual**.  
5. Type a rate that matches the quoted invoice/current value → tab snaps back to that source (avoids phantom cents of FX).

**Expected:**

- Invoice rate available only when paid-in currency matches invoice currency (or ledger settlement of foreign invoice — see layout rules)  
- If paid-in is a third currency, UI shows why invoice rate is unavailable  
- Refresh current rate updates the Current value  

---

### Scenario 14 — Credit note + payment interaction

**Setup:** Invoice total 2,300 USD / 2,000 EUR. Issue a credit note for part of the invoice (e.g. 500 USD ledger / proportional EUR). Then record a payment for the rest.

**Steps:**

1. Create credit note → `creditNoteAmount` increases; outstanding drops; status may become `PARTIAL` or `PAID` if credit covers all.  
2. If still outstanding, record payment for remaining at invoice rate.

**Expected:**

- Status uses **paidAmount + creditNoteAmount** vs total  
- Payment forex still based only on that payment’s rates (credit notes do not create forex P/L)  
- Cannot pay more than remaining outstanding  

---

### Scenario 15 — Edit payment amount / rate (recalculate forex)

**Setup:** Existing payment with known forex (e.g. Scenario 3).

**Steps:**

1. Update payment amount and/or `target.rate` (API or edit UI if available).  
2. Reload payment and invoice.

**Expected:**

- `forexProfitOrLoss` recalculated with new amount/rate  
- Invoice `paidAmount` / status / outstanding adjusted by net amount change  
- If edit would overpay invoice, validate behaviour (UI block or adjusted outstanding clamped at 0)  

---

### Scenario 16 — Same-currency leftovers: rate forced to 1

**Setup:** Create invoice or payment where selected currency equals ledger currency but a non-1 rate was somehow entered.

**Steps:**

1. Save document/payment with currency = ledger.

**Expected:**

- Stored `target.rate` normalized to **1** (no leftover FX rate on same-currency docs)  
- Forex remains 0  

---

### Scenario 17 — Zero / invalid rate safety

**Setup:** Attempt payment with rate `0` or negative (API / bypass UI if possible).

**Expected:**

- UI: “Enter the exchange rate” / cannot submit with rate ≤ 0  
- Backend calculation: forex falls back to **0** if rates missing or ≤ 0  
- Prefer confirming UI validation; API should not silently book bad FX  

---

### Scenario 18 — Payments list + overview display

**Setup:** Mix of payments from Scenarios 1–6 on one or more invoices.

**Steps:**

1. Open Payments list → check **Forex P/L** column.  
2. Open invoice payments overview → currency summary, cards, ledger table, equation text.

**Expected:**

| Forex value | Display |
|-------------|---------|
| `0` | No forex line / “No FX difference” |
| `< 0` | “Forex loss” / “Realised FX loss”, destructive (red) tone |
| `> 0` | “Forex profit” / “Realised FX gain”, paid/green tone |

- Receipt link works when `pdfUrl` present  
- Multi-payment ledger table sums cash and FX across payments  

---

## 5. Quick reference — currency combinations

| Invoice ccy | Paid-in ccy | Ledger | Typical FX? | Notes |
|-------------|-------------|--------|-------------|-------|
| USD | USD | USD | No | Scenario 1 |
| EUR | EUR @ invoice rate | USD | No | Scenario 2 |
| EUR | EUR @ different rate | USD | Yes | Scenarios 3–5 |
| EUR | USD | USD | No | Scenario 7 |
| EUR | GBP | USD | Yes (if rates differ) | Scenario 8 |
| EUR | USD (wallet) | USD | No (forced) | Scenario 9 |

---

## 6. Pass / fail checklist (per payment)

- [ ] Invoice status and outstanding match applied amount  
- [ ] Booked ledger amount = `payment.amount`  
- [ ] Forex P/L matches formula / Result card preview  
- [ ] Cash ledger = booked + forex  
- [ ] Wallet payments always show forex 0  
- [ ] Overpayment cannot be submitted  
- [ ] Paid invoice rejects another payment  
- [ ] UI colours/labels match gain vs loss  
- [ ] Receipt / overview amounts consistent with payment record  

---

## 7. Known product rules (for bug triage)

1. **API stores booked amount**, not cash. FE reconstructs cash as `amount + forexProfitOrLoss`.  
2. **Default fee rate path = invoice rate** → zero FX unless user/current/manual rate differs.  
3. **Write-off tolerance** for small non-invoice-currency shortfalls is currently **5% of outstanding** (FE constant; tenant setting not yet wired).  
4. **Wallet** always ledger currency + `forceZero` forex.  
5. Credit notes reduce outstanding via `creditNoteAmount` but do not post forex on the credit note itself.

---

## 8. Suggested numeric fixtures (copy/paste)

**Fixture A — EUR invoice**

| Field | Value |
|-------|-------|
| Ledger | USD |
| Invoice total (EUR) | 2,000.00 |
| Invoice total (USD) | 2,300.00 |
| Stored invoice rate | 2000/2300 ≈ 0.869565 |
| Loss payment rate | 2000/2250 ≈ 0.888889 → forex **−50** on full pay |
| Gain payment rate | 2000/2400 ≈ 0.833333 → forex **+100** on full pay |

**Fixture B — all USD**

| Field | Value |
|-------|-------|
| Total | 1,000.00 USD |
| Any payment | forex **0** |

Use Fixture A for Scenarios 2–7, 12–13, 18; Fixture B for Scenario 1 and 16.
