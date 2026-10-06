# Account deletion setup

The Prop Firm Setup permanent-delete action calls `public.tradelog_delete_account(text)`.

Run this migration once in the Supabase SQL Editor:

`supabase/migrations/20261006_account_delete_rpc.sql`

The RPC is intentionally safe:
- requires an authenticated user;
- only operates on that user's `account_id`;
- refuses `primary`;
- refuses permanent deletion when journal or missed trades exist;
- deletes related broker connection/sync rows when present;
- then deletes the account row;
- refreshes the PostgREST schema cache.

Accounts with journal history should be archived instead of permanently deleted.
