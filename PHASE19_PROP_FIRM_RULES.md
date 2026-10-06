# Phase 19 — Prop Firm Rules Engine

Adds a prop-firm/program selector, versioned normalized rule snapshots, official-source tracking, a Netlify refresh endpoint, and account initialization from selected rules.

Initial catalog: Apex Trader Funding, Topstep, FundedNext Futures, FTMO, The5ers, Tradeify.

The refresh endpoint verifies that configured official source pages are reachable and returns the normalized catalog snapshot. Rules are not silently inferred from arbitrary HTML; each program is explicitly versioned and source-attributed.
