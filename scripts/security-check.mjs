import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const failures = [];

function read(relativePath) {
  return readFileSync(join(root, relativePath), "utf8");
}

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function assertIncludes(file, content, message) {
  assert(read(file).includes(content), message);
}

const trackedEnvFiles =
  process.env.CI === "true"
    ? execFileSync("git", ["ls-files", ".env", ".env.*"], {
        cwd: root,
        encoding: "utf8",
      })
        .split("\n")
        .filter(Boolean)
        .filter((file) => !file.endsWith(".example"))
    : [];

assert(trackedEnvFiles.length === 0, `Tracked environment file(s): ${trackedEnvFiles.join(", ")}`);

assert(existsSync(join(root, ".env.example")), ".env.example is missing");
assertIncludes(".gitignore", ".env", ".gitignore must ignore .env");
assertIncludes(".gitignore", "!.env.example", ".gitignore must allow .env.example");

assert(existsSync(join(root, ".github/workflows/ci.yml")), "CI workflow is missing");
assertIncludes(".github/workflows/ci.yml", "npm run lint", "CI must run lint");
assertIncludes(".github/workflows/ci.yml", "npm run test", "CI must run tests");
assertIncludes(".github/workflows/ci.yml", "npm run build", "CI must run build");

const leadCapture = read("src/lib/lead-capture.server.ts");
assert(leadCapture.includes("MAX_CAPTURE_BYTES"), "Lead capture must limit request size");
assert(leadCapture.includes("application/json"), "Lead capture must enforce JSON content");
assert(
  leadCapture.includes("LEAD_CAPTURE_ALLOWED_ORIGINS"),
  "Lead capture must support explicit origin allow-listing",
);
assert(
  leadCapture.includes("AUTOMATION_DISPATCH_SECRET"),
  "Lead capture must use dispatcher secret",
);
assert(
  leadCapture.includes('"x-dispatch-secret"'),
  "Lead capture must send dispatcher secret header",
);
assert(!leadCapture.includes("allowedSuffixes"), "Lead capture must not allow broad host suffixes");

const emailFunction = read("supabase/functions/send-automation-email/index.ts");
assert(
  emailFunction.includes("AUTOMATION_DISPATCH_SECRET"),
  "Email dispatcher must require dispatch secret",
);
assert(emailFunction.includes("constantTimeEqual"), "Email dispatcher must compare secrets safely");
assert(
  emailFunction.includes("SUPABASE_SERVICE_ROLE_KEY"),
  "Email dispatcher must use service role only server-side",
);
assert(
  emailFunction.includes("escapeHtml(k)") && emailFunction.includes("escapeHtml(v)"),
  "Email dispatcher must escape generic template payloads",
);
assert(
  emailFunction.includes('req.method !== "POST"'),
  "Email dispatcher must reject non-POST methods",
);

if (failures.length > 0) {
  console.error("Security checks failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Security checks passed");
