# Permanent Account Removal Fix — 2026-09-25

## Behavior

The Prop Firm Setup **Remove** action now permanently deletes the selected account row from `public.accounts` instead of archiving it.

Saved journal trades are intentionally preserved. Before deleting the account, matching trades have their `account_id` and `account_uuid` cleared so the database is not left with references to a deleted account.

The primary account remains protected from deletion.

## Failure behavior

The UI removes the account immediately for responsiveness. If Supabase deletion fails, the authoritative account list is refreshed so the UI does not falsely claim that the account was permanently deleted.

## Confirmation

The confirmation explicitly states that the deletion is permanent and that existing journal trades are preserved but detached from the account.

## QA

- Permanent account deletion QA: 10/10
- Prop-firm cost QA: 12/12
- Multi-account QA: 15/15
- Full active verification: 36/36
