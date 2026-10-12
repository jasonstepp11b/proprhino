# Project Brief: PropFirm Ledger & Performance OS (v1.0 MVP)

## 1. Executive Summary
The **PropFirm Ledger & Performance OS** is a specialized web application designed for retail traders who operate prop firm accounts (e.g., Topstep, Apex, FundedNext). Unlike traditional trading journals that focus solely on charts, this application approaches prop trading as a rigorous **business operation**. It tracks capital allocation, expense burn rates, evaluation costs, resets, payouts, and trade-level execution to provide a crystal-clear answer to one core question: *“Is my prop trading operation profitable after all overhead and fees?”*

---

## 2. Target Audience & Personas
* **The Scale Prop Trader:** Manages 3 to 10 evaluation or funded accounts concurrently across multiple firms. Struggles to track hidden costs (resets, platform fees, activation fees) relative to actual payouts.
* **The Rule-Conscious Trader:** Needs constant visibility into prop firm constraints such as consistency rules (e.g., max single-day profit limits) and payout eligibility criteria.

---

## 3. Product Goals & Objectives (MVP v1.0)
1. **Capital Transparency:** Centralize all financial inflows (payouts) and outflows (purchases, resets, subscriptions) into an automated Net P&L engine.
2. **Frictionless Trade Ingestion:** Enable quick CSV uploads for Tradovate and NinjaTrader exports to map trades directly to specific accounts.
3. **Risk & Compliance Tracking:** Monitor consistency rules and minimum active trading days to prevent accidental payout disqualifications.
4. **Actionable Business Analytics:** Surface high-level financial metrics, equity curves, and performance breakdowns by setup and mistake tags.

---

## 4. Scope & Feature Specifications (v1.0 MVP)

### Module A: Account & Financial Ledger Management
* **Account Profiles:** Create, edit, and archive accounts. Track metadata: Firm Name, Account Size, Platform (Tradovate/NinjaTrader), Account Type (`Evaluation`, `Funded`, `Passed`, `Blown`), and Current Status.
* **Expense Tracking:** Log costs against specific accounts or as general business overhead. Categories: `Challenge Purchase`, `Reset Fee`, `Activation Fee`, `Platform/Data Subscription`.
* **Payout Logging:** Record gross payouts, firm profit split percentage (e.g., 80/20), net received amount, and payout date.
* **Net Business P&L Calculator:** Real-time calculation: 
  $$\text{Net P\&L} = \sum \text{Net Payouts} - \sum (\text{Purchases} + \text{Resets} + \text{Activations} + \text{Subs})$$

### Module B: CSV Trade Log Ingestion & Parsing
* **Dedicated Parsers:** Client-side parsing engine supporting standard CSV export formats from **Tradovate** and **NinjaTrader**.
* **Data Extraction:** Automatically extracts Date/Time, Symbol (focused on USD futures: MES, MNQ, ES, NQ, etc.), Direction (Long/Short), Size, Gross P&L, and Net P&L (after commissions).
* **Account Mapping:** Link imported trade batches to a specific registered prop firm account ID.

### Module C: Business Executive Dashboard
* **Top-Level KPI Cards:** Net Business P&L, Total Capital Invested, Overall ROI %, and Active Funded vs. Blown Account counts.
* **Monthly Financial Calendar Heatmap:** Grid view highlighting daily Net P&L, payout days, and expense events.
* **Firm Performance Breakdown Table:** Comparative performance matrix showing total spend vs. total payouts across different prop firms.

### Module D: Payout Compliance & Rule Engine
* **Consistency Rule Tracker:** Visual progress bar/indicator calculating whether a trader's single highest profit day exceeds the firm's allowance (e.g., 30% rule).
* **Minimum Trading Days Counter:** Tracks completed active trading days required before a payout request can be filed.

### Module E: Playbook & Mistake Tagging
* **Custom Trade Tagging:** Tag individual or bulk trades with custom **Setups** (e.g., `VWAP Pullback`, `Opening Range Breakout`) and **Mistakes** (e.g., `FOMO Entry`, `Moved Stop Loss`).
* **Tag Performance Summary:** Bar graphs displaying Net P&L by Setup and aggregate capital lost due to specific mistakes.

---

## 5. Technology Stack
* **Frontend Framework:** Vite + React + TypeScript
* **Styling & UI Components:** Tailwind CSS + shadcn/ui components (clean, high-density financial dashboard aesthetic)
* **Data Visualization:** Recharts (for equity curves and ROI graphs)
* **Tables & Data Grids:** TanStack Table (for trade and expense ledgers)
* **CSV Parsing:** PapaParse (client-side execution for speed and data privacy)
* **Backend & Database:** Supabase (PostgreSQL with Row Level Security for multi-tenant data isolation and authentication)

---

## 6. Non-Functional Requirements
* **Currency:** USD-exclusive for v1.0 simplicity.
* **Data Security:** Secure user authentication via Supabase Auth; strict RLS policies ensuring users only view their own accounts and trade records.
* **Performance:** Fast client-side CSV parsing supporting batch files up to 10,000 rows without UI locking.

---

## 7. Out of Scope for v1.0 (Post-MVP Roadmap)
* Direct live broker API WebSockets / auto-sync (Rithmic API, Tradovate API).
* Multi-currency support (EUR, GBP).
* Advanced execution metrics (MAE/MFE chart overlays, tick-level replay).
* Automated tax bracket projection and 1099 auto-filing exports.