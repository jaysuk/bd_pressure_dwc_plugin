import { describe, it, expect } from "vitest";
import { buildM572, buildStartCommands, buildStopCommand, buildStatusClearCommand, buildRunCommand } from "../model/gcode";
import type { CalibParams } from "../model/gcode";

const DEFAULT_PARAMS: CalibParams = {
	tool:          0,
	nozzle_temp:   215,
	pa_start:      0.0,
	pa_step:       0.005,
	steps:         50,
	warmup_steps:  8,
	bidirectional: false,
	low_speed:     1020,
	high_speed:    10740,
	travel_speed:  18000,
	z_height:      50,
};

// ── buildM572 ─────────────────────────────────────────────────────────────────

describe("buildM572", () => {
	it("produces the correct M572 string with 4 decimal places", () => {
		expect(buildM572(0, 0.042, 4)).toBe("M572 D0 S0.0420");
	});

	it("uses the given extruder index", () => {
		expect(buildM572(1, 0.1, 4)).toBe("M572 D1 S0.1000");
	});

	it("respects decimal places", () => {
		expect(buildM572(0, 0.03125, 5)).toBe("M572 D0 S0.03125");
	});

	it("rounds to the given decimal places", () => {
		expect(buildM572(0, 0.123456789, 6)).toBe("M572 D0 S0.123457");
	});
});

// ── buildStartCommands ────────────────────────────────────────────────────────

describe("buildStartCommands", () => {
	it("returns an array of strings", () => {
		const cmds = buildStartCommands(DEFAULT_PARAMS, "standard");
		expect(Array.isArray(cmds)).toBe(true);
		expect(cmds.length).toBeGreaterThan(0);
	});

	it("includes all required set global.* lines", () => {
		const cmds = buildStartCommands(DEFAULT_PARAMS, "standard");
		const joined = cmds.join("\n");
		expect(joined).toContain("global.bd_live_tool");
		expect(joined).toContain("global.bd_live_nozzle_temp");
		expect(joined).toContain("global.bd_live_pa_start");
		expect(joined).toContain("global.bd_live_pa_step");
		expect(joined).toContain("global.bd_live_steps");
		expect(joined).toContain("global.bd_live_warmup_steps");
		expect(joined).toContain("global.bd_live_bidirectional");
		expect(joined).toContain("global.bd_live_hotend_preset");
		expect(joined).toContain("global.bd_live_low_speed");
		expect(joined).toContain("global.bd_live_high_speed");
		expect(joined).toContain("global.bd_live_travel_speed");
		expect(joined).toContain("global.bd_live_z_height");
	});

	it("sets hotend_preset with quotes", () => {
		const cmds = buildStartCommands(DEFAULT_PARAMS, "bowden");
		const presetLine = cmds.find((c) => c.includes("hotend_preset"));
		expect(presetLine).toBeDefined();
		expect(presetLine).toContain('"bowden"');
	});

	it("encodes bidirectional as true/false (not 1/0)", () => {
		const biOn  = buildStartCommands({ ...DEFAULT_PARAMS, bidirectional: true  }, "standard");
		const biOff = buildStartCommands({ ...DEFAULT_PARAMS, bidirectional: false }, "standard");
		const onLine  = biOn.find((c)  => c.includes("bidirectional"))!;
		const offLine = biOff.find((c) => c.includes("bidirectional"))!;
		expect(onLine).toContain("true");
		expect(offLine).toContain("false");
	});

	it("uses correct param values", () => {
		const cmds = buildStartCommands({ ...DEFAULT_PARAMS, nozzle_temp: 230, steps: 75 }, "standard");
		const tempLine  = cmds.find((c) => c.includes("nozzle_temp"))!;
		const stepsLine = cmds.find((c) => c.includes("bd_live_steps"))!;
		expect(tempLine).toContain("230");
		expect(stepsLine).toContain("75");
	});
});

// ── buildStopCommand ──────────────────────────────────────────────────────────

describe("buildStopCommand", () => {
	it("returns M108", () => {
		expect(buildStopCommand()).toBe("M108");
	});
});

// ── buildStatusClearCommand ───────────────────────────────────────────────────

describe("buildStatusClearCommand", () => {
	it("contains the status file path and state=starting", () => {
		const cmd = buildStatusClearCommand();
		expect(cmd).toContain("pa_live_status.txt");
		expect(cmd).toContain("state=starting");
	});
});

// ── buildRunCommand ───────────────────────────────────────────────────────────

describe("buildRunCommand", () => {
	it("references the calibration macro", () => {
		const cmd = buildRunCommand();
		expect(cmd).toContain("pa_calibrate_live.g");
	});
});
