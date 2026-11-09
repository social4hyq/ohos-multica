const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { afterEach, test } = require("node:test");

const roots = [];

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "multica-sign-test-"));
  roots.push(root);
  const cli = path.join(root, "cli.js");
  const profile = path.join(root, "build-profile.json5");
  const hap = path.join(root, "unsigned.hap");
  const output = path.join(root, "signed.hap");
  const tool = path.join(root, "hap-sign-tool");
  const report = path.join(root, "tool-result.json");

  fs.writeFileSync(cli, `var Rs=class{static decryptPwd(config, value, field) {
    if (field === "storePassword" && value === "ENC_STORE") return "STORE_SECRET";
    if (field === "keyPassword" && value === "ENC_KEY") return "KEY_SECRET";
    throw new Error("unexpected protected value");
  }};\n`);
  fs.writeFileSync(profile, JSON.stringify({
    app: { signingConfigs: [{ material: {
      certpath: path.join(root, "debug.cer"),
      keyAlias: "debugKey",
      keyPassword: "ENC_KEY",
      profile: path.join(root, "debug.p7b"),
      signAlg: "SHA256withECDSA",
      storeFile: path.join(root, "debug.p12"),
      storePassword: "ENC_STORE",
    } }] },
  }));
  for (const name of ["debug.cer", "debug.p7b", "debug.p12"]) fs.writeFileSync(path.join(root, name), "fixture");
  fs.writeFileSync(hap, "unsigned payload");
  fs.writeFileSync(tool, `#!/usr/bin/env node
const fs = require("node:fs");
const a = process.argv.slice(2);
const get = (flag) => a[a.indexOf(flag) + 1];
const ok = a[0] === "sign-app" && a.includes("-mode") && get("-mode") === "localSign" &&
  get("-keyAlias") === "debugKey" && get("-keyPwd") === "KEY_SECRET" &&
  get("-keystorePwd") === "STORE_SECRET" && get("-signAlg") === "SHA256withECDSA" &&
  fs.existsSync(get("-inFile")) && fs.existsSync(get("-appCertFile")) &&
  fs.existsSync(get("-profileFile")) && fs.existsSync(get("-keystoreFile"));
if (ok) fs.copyFileSync(get("-inFile"), get("-outFile"));
fs.writeFileSync(process.env.TOOL_REPORT, JSON.stringify({ ok }));
console.log("signature tool finished");
process.exit(ok ? 0 : 3);
`);
  fs.chmodSync(tool, 0o755);
  return { root, cli, profile, hap, output, tool, report };
}

test("signs the bottle HAP with the selected project's generated materials", () => {
  const f = fixture();
  const script = path.resolve(__dirname, "../scripts/sign-hap.cjs");
  const result = spawnSync(process.execPath, [script, "--hap", f.hap, "--profile", f.profile, "--output", f.output], {
    encoding: "utf8",
    env: { ...process.env, DEVECO_CLI_JS: f.cli, HAP_SIGN_TOOL: f.tool, TOOL_REPORT: f.report },
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.deepEqual(JSON.parse(fs.readFileSync(f.report, "utf8")), { ok: true });
  assert.equal(fs.readFileSync(f.output, "utf8"), "unsigned payload");
  assert.doesNotMatch(result.stdout + result.stderr, /STORE_SECRET|KEY_SECRET|ENC_STORE|ENC_KEY/);
});

test("fails closed when the DevEco CLI signing decoder changes", () => {
  const f = fixture();
  fs.writeFileSync(f.cli, "const unrelated = 1;\n");
  const script = path.resolve(__dirname, "../scripts/sign-hap.cjs");
  const result = spawnSync(process.execPath, [script, "--hap", f.hap, "--profile", f.profile, "--output", f.output], {
    encoding: "utf8",
    env: { ...process.env, DEVECO_CLI_JS: f.cli, HAP_SIGN_TOOL: f.tool, TOOL_REPORT: f.report },
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /decoder|decryptPwd/i);
  assert.equal(fs.existsSync(f.report), false);
  assert.equal(fs.existsSync(f.output), false);
});
