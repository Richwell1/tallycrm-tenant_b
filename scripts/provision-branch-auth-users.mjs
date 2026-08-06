import { createClient } from "@supabase/supabase-js";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { applyCloudFallbackFromEnvFiles, loadEnvFile } from "./lib/env.mjs";

const DEFAULT_BRANCH_PASSWORD = "OpportunityOS-Branch-2026!";

loadEnvFile(".env.branch");
applyCloudFallbackFromEnvFiles([".env.production", ".env"]);

const args = new Set(process.argv.slice(2));
const resetPasswords = args.has("--reset-passwords");
const cloudUrl = process.env.CLOUD_SUPABASE_URL;
const cloudServiceKey = process.env.CLOUD_SUPABASE_SERVICE_ROLE_KEY;
const branchPassword = process.env.BRANCH_TEST_PASSWORD || DEFAULT_BRANCH_PASSWORD;
const branchPasswordSql = `'${branchPassword.replaceAll("'", "''")}'`;

if (!cloudUrl || !cloudServiceKey) {
  throw new Error("Missing CLOUD_SUPABASE_URL or CLOUD_SUPABASE_SERVICE_ROLE_KEY");
}

const cloud = createClient(cloudUrl, cloudServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const users = [];
for (let page = 1; ; page += 1) {
  const { data, error } = await cloud.auth.admin.listUsers({ page, perPage: 100 });
  if (error) throw error;
  users.push(...data.users.filter((user) => user.email));
  if (data.users.length < 100) break;
}

const userIds = users.map((user) => user.id);
const { data: cloudRoles, error: cloudRolesError } =
  userIds.length > 0
    ? await cloud.from("user_roles").select("user_id,role,created_at").in("user_id", userIds)
    : { data: [], error: null };
if (cloudRolesError) throw cloudRolesError;

const payload = JSON.stringify(
  users.map((user) => ({
    id: user.id,
    email: user.email,
    created_at: user.created_at,
  })),
);
const rolesPayload = JSON.stringify(cloudRoles ?? []);

const userSql = `
with source_users as (
  select * from jsonb_to_recordset($json$${payload}$json$::jsonb)
    as u(id uuid, email text, created_at timestamptz)
)
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change,
  email_change_token_current,
  phone_change,
  phone_change_token,
  reauthentication_token,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  is_sso_user,
  is_anonymous
)
select
  '00000000-0000-0000-0000-000000000000'::uuid,
  id,
  'authenticated',
  'authenticated',
  email,
  crypt(${branchPasswordSql}, gen_salt('bf')),
  now(),
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"email_verified":true}'::jsonb,
  coalesce(created_at, now()),
  now(),
  false,
  false
from source_users
on conflict (id) do update set
  email = excluded.email,
  encrypted_password = ${resetPasswords ? "excluded.encrypted_password" : "auth.users.encrypted_password"},
  email_confirmed_at = excluded.email_confirmed_at,
  confirmation_token = excluded.confirmation_token,
  recovery_token = excluded.recovery_token,
  email_change_token_new = excluded.email_change_token_new,
  email_change = excluded.email_change,
  email_change_token_current = excluded.email_change_token_current,
  phone_change = excluded.phone_change,
  phone_change_token = excluded.phone_change_token,
  reauthentication_token = excluded.reauthentication_token,
  raw_app_meta_data = excluded.raw_app_meta_data,
  raw_user_meta_data = excluded.raw_user_meta_data,
  updated_at = now();
`;

const identitySql = `
with source_users as (
  select * from jsonb_to_recordset($json$${payload}$json$::jsonb)
    as u(id uuid, email text)
)
insert into auth.identities (
  provider_id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
select
  id::text,
  id,
  jsonb_build_object('sub', id::text, 'email', email, 'email_verified', false, 'phone_verified', false),
  'email',
  now(),
  now(),
  now()
from source_users
on conflict (provider_id, provider) do update set
  user_id = excluded.user_id,
  identity_data = excluded.identity_data,
  updated_at = now();
`;

const roleDeleteSql = `
with source_users as (
  select * from jsonb_to_recordset($json$${payload}$json$::jsonb)
    as u(id uuid)
)
delete from public.user_roles
where user_id in (select id from source_users);
`;

const roleInsertSql = `
with source_roles as (
  select * from jsonb_to_recordset($json$${rolesPayload}$json$::jsonb)
    as r(user_id uuid, role public.app_role, created_at timestamptz)
)
insert into public.user_roles (user_id, role, created_at)
select user_id, role, coalesce(created_at, now())
from source_roles
on conflict (user_id, role) do nothing;
`;

for (const [name, sql] of [
  ["users", userSql],
  ["identities", identitySql],
  ["role-delete", roleDeleteSql],
  ["role-insert", roleInsertSql],
]) {
  const sqlPath = path.join(os.tmpdir(), `branch-provision-auth-${name}.sql`);
  fs.writeFileSync(sqlPath, sql, { mode: 0o600 });

  const result = spawnSync("supabase", ["db", "query", "--local", "--file", sqlPath], {
    encoding: "utf8",
    stdio: "pipe",
  });

  fs.rmSync(sqlPath, { force: true });

  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout);
    process.exit(result.status || 1);
  }
}

console.log(`Provisioned ${users.length} local branch auth users.`);
if (resetPasswords) {
  console.log("Reset existing local branch passwords to the configured temporary password.");
} else {
  console.log("Existing local branch passwords were kept unchanged.");
}
console.log(`Temporary password for newly created local users: ${branchPassword}`);
