#!/usr/bin/env node
/**
 * Static footer appended to every GitHub Release body: install instructions, the DuetWebControl
 * version built against, and the machine-readable `dwc-plugin-update` marker the in-app update checker
 * looks for. DWC details come from the release workflow's environment; they fall back when run locally.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(join(here, "..", "plugin.json"), "utf8"));
const pkgVersion = manifest.version;

const dwcVersion = process.env.DWC_VERSION || "";
function resolveDwcRequirement(value, reference) {
	if (value === "auto") return reference;
	if (value === "auto-major") return reference.split(".").slice(0, 2).join(".");
	return value || "";
}
const requiredDwc = resolveDwcRequirement(manifest.dwcVersion, dwcVersion);
const dwcSha = process.env.DWC_SHA || "";
const dwcRef = process.env.DWC_REF || "v3.7-dev";
const dwcBuiltAgainst = dwcVersion
	? `**DuetWebControl ${dwcVersion}**${dwcSha ? ` (\`${dwcSha}\`, ref \`${dwcRef}\`)` : ` (ref \`${dwcRef}\`)`}`
	: `DuetWebControl (ref \`${dwcRef}\`)`;

const out = `
---

### Install
1. Download \`BdPressurePA-${pkgVersion}.zip\` from the **Assets** below.
2. In DuetWebControl, go to **Settings -> General -> Plugins** and click **Install Plugin**.
3. Select the downloaded ZIP and accept the third-party-plugin prompt.
4. Reload DWC, then open **Plugins -> PA Calibration**.

> Built against ${dwcBuiltAgainst}. Use a DuetWebControl build at or near this version.
> Requires a Duet board with a bd_pressure strain-gauge sensor wired to the UART and Z-probe input.

<!-- dwc-plugin-update ${JSON.stringify({ version: pkgVersion, dwcVersion: requiredDwc, asset: `BdPressurePA-${pkgVersion}.zip` })} -->
`;

process.stdout.write(out.replace(/^\n/, ""));
