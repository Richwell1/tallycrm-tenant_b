# CLAUDE.md

## Multi-tenant propagation rules

This is the **central** repo. Each customer runs their own fork of it against their own
Supabase project and their own deployment. Changes flow **downward** from here into
tenant repos by `git merge`, and **never back up**. Some features go to every tenant;
some go to one named tenant only.

These rules are not advisory. Follow them on every change.

### 1. Declare the scope before writing code

Every feature is either:

- **`all`** — every tenant inherits it, or
- **`named`** — only specific tenants get it.

**If a request does not state which, ASK. Do not guess.** Scope determines where the
code may live and who is affected by a mistake; guessing wrong is expensive to undo
after the code has merged downstream.

Record the answer in a `feature.json` in the feature's **own directory**:

```json
{
  "key": "credit_notes",
  "name": "Credit notes",
  "scope": "all",
  "audience": [],
  "has_migration": true,
  "version": "1.0.0"
}
```

`audience` lists the tenant names for `scope: "named"`, and is `[]` for `scope: "all"`.

### 2. Feature code goes in new files and new directories

A feature confined to its own files can be present in one tenant and absent from another
indefinitely, with no merge conflict, forever. A feature that edits shared files
conflicts on **every future update**, permanently — the cost is not paid once, it is paid
on every merge for the life of the tenant.

So: new route files, a new `src/components/<feature>/` directory, a new
`src/lib/<feature>-data.ts`, a new migration. Reuse shared helpers by **importing** them,
never by editing them.

#### The only shared files a feature may touch

| File                                 | Why it is unavoidable                                                                                                                                  | How to handle it                                                                                                                                                   |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/components/layout/Sidebar.tsx`  | The `SECTIONS` array is the only navigation registry.                                                                                                  | **One appended line** in the right group, plus its `lucide-react` icon import. Nothing else.                                                                       |
| `src/routeTree.gen.ts`               | Tracked, not gitignored. The `tanstackStart` Vite plugin regenerates it from `src/routes/`. Without it, typed `<Link to="/app/...">` will not compile. | **Generated — never hand-edit and never hand-merge.** On conflict, take either side, run `npm run dev` (or `npm run build`) once, and commit the regenerated file. |
| `src/integrations/supabase/types.ts` | Generated `supabase gen types` output. A new table or enum must appear here or the data layer will not typecheck.                                      | **Generated — never hand-merge.** On conflict, regenerate from the migrated schema. Keep the `Enums` type block and the runtime `Constants.Enums` block in sync.   |
| `src/lib/settings-data.ts`           | `DEFAULT_APP_SETTINGS` is typed as the full generated `app_settings` Row, so a new `app_settings` column breaks the build until a default is added.    | **One line** per new column. Nothing else.                                                                                                                         |

**If a feature appears to require editing any other shared file, STOP and explain rather
than editing.** Say what you need and why, and let a human decide. Do not quietly widen
the blast radius.

### 3. Files that must never be edited by a feature

These hold **per-tenant values**. Editing them here overwrites a tenant's own
configuration on the next merge:

- `supabase/config.toml` — contains the tenant's Supabase `project_id`
- `vite.config.ts` — the `allowedHosts` list is per-tenant
- any `.env` file (`.env`, `.env.staging`, `.env.local`, …) — `.env*.example` files are
  the only tracked ones, and they must never contain real values
- anything containing a Supabase project ref, URL, or key

### 4. No connection fallback. Ever.

`src/integrations/supabase/client.ts` reads the Supabase URL and publishable key from the
environment and **throws** when either is missing.

It previously fell back to hardcoded values. That meant a misconfigured tenant build
connected **silently** to another tenant's production database — wrong data, wrong
customer, no error. That is the worst failure this codebase can have.

Therefore: **no default, no fallback, no demo client, no mock client, no offline mode**
may be added back, for any reason, including "just for local development" or "just to
make the build pass". A build that fails for want of an environment variable is
**intended behaviour** — it is the safety mechanism working. Fix the environment, not
the client.

Only the publishable (anon) key belongs in this file. The service role key is
server-side only.

### 5. Migrations

- **Timestamp later than every existing migration.** Check
  `ls supabase/migrations/ | sort | tail -1` first.
- **Merge from upstream before creating one**, so your timestamp is genuinely last.
- **Never edit an applied migration.** Correct it with a new one.
- **Never cherry-pick a subset of migrations.** Later migrations redefine objects created
  by earlier ones; they only work as a **complete ordered set**. Half a set produces a
  schema that matches no known state.
- Make every migration **re-runnable**: `IF NOT EXISTS` on `CREATE TABLE` / `CREATE INDEX`
  / `CREATE SEQUENCE`, `DROP ... IF EXISTS` before every `CREATE TRIGGER` and
  `CREATE POLICY`, and the exception-swallowing `DO` block for enums. Migrations here
  have in fact been re-run.
- **Every new table needs RLS**, following the existing role-based pattern:
  `public.has_role(auth.uid(), 'admin'|'manager'|'rep')` with scoped
  select/insert/update/delete policies. Copy the shapes from the receipts and invoices
  migrations. Do not invent a different scheme.
- Every function is `SECURITY DEFINER SET search_path = public`, with explicit
  `REVOKE`/`GRANT` — internal recalculators are `service_role` only.

### 6. Verification gate

Before merging a feature branch to `main`, **and again after merging**, run the full
check and **paste the passing output**:

```bash
npm run ci         # eslint . && node scripts/security-check.mjs && vite build
npm run test:unit
```

Know what these actually do:

- `npm run test` **is only a security lint** (`scripts/security-check.mjs`). It runs no
  unit tests and no typechecking. Passing it means very little on its own.
- `npm run build` is what **typechecks** your code. It is the real gate.
- `npm run test:unit` runs the one unit test file.

**Work is not complete on the strength of code looking correct.** If you did not run it,
say you did not run it. Never report success on unverified code.

### 7. Report after every change

State, every time:

- **Which tenants inherit this, and why** (because scope is `all`, or because they are
  named in `audience`).
- **What each tenant needs after the merge**, explicitly, each as yes or no:
  - a migration pushed (`supabase db push`)
  - an edge function deployed
  - a secret set
  - an environment variable added

**The repo, each tenant's database, and each tenant's deployment are three separate
things. Pushing code ships none of the others.** A merged migration file is not an
applied migration. Saying "done" after a merge, when a tenant still needs
`supabase db push`, is a false report.

### 8. Propagating to a tenant

From this repo, with the tenant configured as a remote:

```bash
git checkout -B work-<tenant> <tenant>/main
git merge main --no-edit
git push <tenant> work-<tenant>:main
git checkout main
```

- **Never `git push <tenant> main`.** The tenant has its own commits; that push is either
  rejected or it discards them.
- **Never merge a tenant branch back into `main`.** Propagation is one-directional.
  Useful tenant work is promoted deliberately — read it, rewrite it for the general case,
  commit it here — never synced up wholesale.
- Resolve conflicts in favour of the tenant's per-tenant config (section 3) and in favour
  of regenerating the generated files (section 2).
