/**
 * bd_pressure sensor setup/diagnostic GCode builders + reply parsers.
 * PURE — no Vue/DWC imports.
 *
 * Mirrors the standalone /macros/bd_*.g files, but built for the Setup tab's native UI instead of
 * the macros' own M291 popups. The sensor firmware (see bd_pressure/firmware_src/Core-ALPS/Src/main.c)
 * answers UART commands three different ways, which is why these builders aren't all shaped the same:
 *
 *  - Some commands (`s;`) make the SENSOR inject a full `M291 ... S2` popup back over the wire — RRF
 *    runs it because the port is in raw/gcode-passthrough mode. That popup is DWC's own native dialog
 *    regardless of what triggered it; there's nothing here to parse, only a trigger to send.
 *  - Some commands (`v;`, `e;`, `r;`, `c;`, `L;`/`l;`, `d;`/`D;`) make the sensor emit `M118 P0 S"..."`
 *    — plain console text. Not capturable from a plugin's sendCode() reply, so these stay fire-and-forget.
 *  - Some commands (`ver;`, `mode;`, `Q;`) return a single raw byte, read into a GCode-local `var` via
 *    `M260.2`/`M261.2`. That `var` only survives within one GCode execution scope, so it's read back
 *    with an `echo` at the end of the SAME multi-line command — a macro-local `var` can't be read
 *    across two separate sendCode() calls. This is what lets Version/Mode/Threshold actually render
 *    natively in the tab instead of "check the console".
 *
 * The byte-read commands require the port to already be switched into device mode
 * (`buildDeviceModeCommand`) and switched back afterwards (`buildRawModeCommand`) — callers are
 * expected to send the switch-back in a `finally` so a failed read can't strand the port in device
 * mode (the macros this is based on don't guard against that).
 */

/** Baud rates in the order the sensor firmware's table expects (index is what `b<N>;` selects). */
export const BAUD_TABLE = [115200, 57600, 38400, 230400] as const;

/** Switch the aux port into device mode (I2C-like addressed read/write via M260.2/M261.2). */
export function buildDeviceModeCommand(port: number, baud: number): string {
	return `M575 P${port} S7 B${baud}`;
}

/** Switch the aux port back to raw/gcode-passthrough mode — the sensor's normal operating mode. */
export function buildRawModeCommand(port: number, baud: number): string {
	return `M575 P${port} S2 B${baud}`;
}

function parseKeyValue(text: string): Record<string, string> {
	const obj: Record<string, string> = {};
	for (const pair of text.trim().split(/\s+/)) {
		const eq = pair.indexOf("=");
		if (eq > 0) obj[pair.slice(0, eq)] = pair.slice(eq + 1);
	}
	return obj;
}

// ── Fire-and-forget triggers ─────────────────────────────────────────────────────────────────────
// Sent while the port is in its normal raw/passthrough mode — same as the standalone bd_*.g macros.

export function buildStatusCommand(uart: number): string {
	return `M118 P${uart} S"s;"`;
}
export function buildRebootCommand(uart: number): string {
	return `M118 P${uart} S"r;"`;
}
export function buildPaModeCommand(uart: number): string {
	return `M118 P${uart} S"c;"`;
}
export function buildEndstopModeCommand(uart: number): string {
	return `M118 P${uart} S"e;"`;
}
export function buildTriggerLoggingCommand(uart: number, on: boolean): string {
	return `M118 P${uart} S"${on ? "L" : "l"};"`;
}
export function buildAdcOutputCommand(uart: number, on: boolean): string {
	return `M118 P${uart} S"${on ? "d" : "D"};"`;
}

/** Threshold is a single value 1–99, same as bd_set_threshold.g's `{floor(input)};`. */
export function buildThresholdSetCommand(uart: number, value: number): string {
	const v = Math.min(99, Math.max(1, Math.floor(value)));
	return `M118 P${uart} S"${v};"`;
}

// ── Baud rate change ─────────────────────────────────────────────────────────────────────────────
// Mirrors bd_baud.g: trigger the sensor's own baud switch + reboot, then re-point the Duet's port at
// the new rate. `global.bd_baud` is only updated for the running session — bd_globals.g itself must
// still be edited by hand for it to survive a Duet reboot, exactly as bd_baud.g's own popup says.

export function buildBaudChangeCommand(uart: number, baudIndex: number): string {
	return `M118 P${uart} S"b${baudIndex};"`;
}
export function buildSetStoredBaudCommand(newBaud: number): string {
	return `set global.bd_baud = ${newBaud}`;
}

// ── Sensor info read (Version / Mode / Threshold) ───────────────────────────────────────────────
// Combines the three byte-read queries into one device-mode session. Must run between
// buildDeviceModeCommand()/buildRawModeCommand().

export function buildSensorInfoReadCommand(port: number): string {
	return [
		`M260.2 P${port} S"ver;"`,
		`G4 P300`,
		`M261.2 P${port} B1 V"bd_ver_raw"`,
		`M260.2 P${port} S"mode;"`,
		`G4 P300`,
		`M261.2 P${port} B1 V"bd_mode_raw"`,
		`M260.2 P${port} S"Q;"`,
		`G4 P200`,
		`M261.2 P${port} B1 V"bd_threshold_raw"`,
		`echo "ver_raw=" ^ var.bd_ver_raw[0] ^ " mode_raw=" ^ var.bd_mode_raw[0] ^ " threshold=" ^ var.bd_threshold_raw[0]`,
	].join("\n");
}

export interface SensorInfo {
	versionMajor: number;
	versionMinor: number;
	mode: "pa" | "endstop";
	threshold: number;
}

export function parseSensorInfoReply(reply: string): SensorInfo | null {
	const obj = parseKeyValue(reply);
	const verRaw = obj.ver_raw !== undefined ? parseInt(obj.ver_raw, 10) : NaN;
	const modeRaw = obj.mode_raw !== undefined ? parseInt(obj.mode_raw, 10) : NaN;
	const threshold = obj.threshold !== undefined ? parseInt(obj.threshold, 10) : NaN;
	if (!Number.isFinite(verRaw) || !Number.isFinite(modeRaw) || !Number.isFinite(threshold)) return null;
	const versionMajor = Math.floor(verRaw / 100);
	return {
		versionMajor,
		versionMinor: verRaw - versionMajor * 100,
		mode: modeRaw === 0 ? "pa" : "endstop",
		threshold,
	};
}

// ── UART self-test ───────────────────────────────────────────────────────────────────────────────
// Mirrors bd_uart_test.g's ver;/mode;/c;/mode;/e; sequence exactly, but reports results via `echo`
// (captured in the sendCode() reply) instead of `M118 P0` console lines, so the plugin can render
// pass/fail natively instead of pointing the user at the console.

export function buildUartTestCommand(port: number): string {
	return [
		`M260.2 P${port} S"ver;"`,
		`G4 P300`,
		`M261.2 P${port} B1 V"bd_ver_raw"`,
		`M260.2 P${port} S"mode;"`,
		`G4 P300`,
		`M261.2 P${port} B1 V"bd_mode_raw"`,
		`M260.2 P${port} S"c;"`,
		`G4 P500`,
		`M260.2 P${port} S"mode;"`,
		`G4 P300`,
		`M261.2 P${port} B1 V"bd_mode2_raw"`,
		`M260.2 P${port} S"e;"`,
		`G4 P200`,
		`echo "ver_raw=" ^ var.bd_ver_raw[0] ^ " mode_raw=" ^ var.bd_mode_raw[0] ^ " mode2_raw=" ^ var.bd_mode2_raw[0]`,
	].join("\n");
}

export interface UartTestResult {
	versionMajor: number;
	versionMinor: number;
	/** Mode read before `c;` is sent — expected to be "endstop" (the sensor's normal resting mode). */
	modeBeforeOk: boolean;
	/** Mode read after `c;` is sent — expected to be "pa", confirming the mode switch took effect. */
	modeAfterOk: boolean;
}

export function parseUartTestReply(reply: string): UartTestResult | null {
	const obj = parseKeyValue(reply);
	const verRaw = obj.ver_raw !== undefined ? parseInt(obj.ver_raw, 10) : NaN;
	const modeRaw = obj.mode_raw !== undefined ? parseInt(obj.mode_raw, 10) : NaN;
	const mode2Raw = obj.mode2_raw !== undefined ? parseInt(obj.mode2_raw, 10) : NaN;
	if (!Number.isFinite(verRaw) || !Number.isFinite(modeRaw) || !Number.isFinite(mode2Raw)) return null;
	const versionMajor = Math.floor(verRaw / 100);
	return {
		versionMajor,
		versionMinor: verRaw - versionMajor * 100,
		modeBeforeOk: modeRaw === 1,
		modeAfterOk: mode2Raw === 0,
	};
}
