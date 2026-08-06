import fs from "node:fs";

const configPath = ".output/server/wrangler.json";

if (!fs.existsSync(configPath)) {
  throw new Error(`${configPath} does not exist. Run npm run build:staging first.`);
}

const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
config.name = "crm-core-components-staging";
config.vars = { ...(config.vars ?? {}), APP_ENV: "staging" };
delete config.env;

fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
console.log(`Prepared ${configPath} for crm-core-components-staging`);
