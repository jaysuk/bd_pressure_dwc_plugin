import { describe, it, expect } from "vitest";
import {
	BAUD_TABLE,
	buildDeviceModeCommand, buildRawModeCommand,
	buildStatusCommand, buildRebootCommand, buildPaModeCommand, buildEndstopModeCommand,
	buildTriggerLoggingCommand, buildAdcOutputCommand, buildThresholdSetCommand,
	buildBaudChangeCommand, buildSetStoredBaudCommand,
	buildSensorInfoReadCommand, parseSensorInfoReply,
	buildUartTestCommand, parseUartTestReply,
} from "../model/sensorCommands";

// ── mode switches ─────────────────────────────────────────────────────────────

describe("buildDeviceModeCommand / buildRawModeCommand", () => {
	it("switches to device mode (S7) with the given port and baud", () => {
		expect(buildDeviceModeCommand(1, 115200)).toBe("M575 P1 S7 B115200");
	});
	it("switches back to raw mode (S2) with the given port and baud", () => {
		expect(buildRawModeCommand(1, 115200)).toBe("M575 P1 S2 B115200");
	});
});

// ── fire-and-forget triggers ─────────────────────────────────────────────────

describe("fire-and-forget triggers", () => {
	it("buildStatusCommand sends s;", () => {
		expect(buildStatusCommand(2)).toBe('M118 P2 S"s;"');
	});
	it("buildRebootCommand sends r;", () => {
		expect(buildRebootCommand(2)).toBe('M118 P2 S"r;"');
	});
	it("buildPaModeCommand sends c;", () => {
		expect(buildPaModeCommand(2)).toBe('M118 P2 S"c;"');
	});
	it("buildEndstopModeCommand sends e;", () => {
		expect(buildEndstopModeCommand(2)).toBe('M118 P2 S"e;"');
	});
	it("buildTriggerLoggingCommand sends L; when on, l; when off", () => {
		expect(buildTriggerLoggingCommand(2, true)).toBe('M118 P2 S"L;"');
		expect(buildTriggerLoggingCommand(2, false)).toBe('M118 P2 S"l;"');
	});
	it("buildAdcOutputCommand sends d; when on, D; when off", () => {
		expect(buildAdcOutputCommand(2, true)).toBe('M118 P2 S"d;"');
		expect(buildAdcOutputCommand(2, false)).toBe('M118 P2 S"D;"');
	});
});

// ── threshold ─────────────────────────────────────────────────────────────────

describe("buildThresholdSetCommand", () => {
	it("sends the floored value followed by ;", () => {
		expect(buildThresholdSetCommand(2, 42)).toBe('M118 P2 S"42;"');
		expect(buildThresholdSetCommand(2, 7.9)).toBe('M118 P2 S"7;"');
	});
	it("clamps to the 1–99 range", () => {
		expect(buildThresholdSetCommand(2, 0)).toBe('M118 P2 S"1;"');
		expect(buildThresholdSetCommand(2, 500)).toBe('M118 P2 S"99;"');
	});
});

// ── baud change ───────────────────────────────────────────────────────────────

describe("baud change", () => {
	it("BAUD_TABLE matches the firmware's index order", () => {
		expect(BAUD_TABLE).toEqual([115200, 57600, 38400, 230400]);
	});
	it("buildBaudChangeCommand sends b<index>;", () => {
		expect(buildBaudChangeCommand(2, 0)).toBe('M118 P2 S"b0;"');
		expect(buildBaudChangeCommand(2, 3)).toBe('M118 P2 S"b3;"');
	});
	it("buildSetStoredBaudCommand sets the global", () => {
		expect(buildSetStoredBaudCommand(57600)).toBe("set global.bd_baud = 57600");
	});
});

// ── sensor info read ──────────────────────────────────────────────────────────

describe("buildSensorInfoReadCommand / parseSensorInfoReply", () => {
	it("builds a device-mode read sequence ending in an echo", () => {
		const cmd = buildSensorInfoReadCommand(1);
		expect(cmd).toContain('M260.2 P1 S"ver;"');
		expect(cmd).toContain('M260.2 P1 S"mode;"');
		expect(cmd).toContain('M260.2 P1 S"Q;"');
		expect(cmd.trim().split("\n").pop()).toContain("echo");
	});

	it("parses a well-formed reply", () => {
		const info = parseSensorInfoReply("ver_raw=224 mode_raw=1 threshold=4");
		expect(info).toEqual({ versionMajor: 2, versionMinor: 24, mode: "endstop", threshold: 4 });
	});

	it("decodes mode_raw=0 as pa", () => {
		const info = parseSensorInfoReply("ver_raw=100 mode_raw=0 threshold=10");
		expect(info?.mode).toBe("pa");
	});

	it("returns null when the reply is unparseable", () => {
		expect(parseSensorInfoReply("")).toBeNull();
		expect(parseSensorInfoReply("garbage output, no keys here")).toBeNull();
	});

	it("returns null when a key is missing", () => {
		expect(parseSensorInfoReply("ver_raw=224 mode_raw=1")).toBeNull();
	});
});

// ── UART self-test ────────────────────────────────────────────────────────────

describe("buildUartTestCommand / parseUartTestReply", () => {
	it("builds the ver;/mode;/c;/mode;/e; sequence ending in an echo", () => {
		const cmd = buildUartTestCommand(1);
		const lines = cmd.split("\n");
		expect(lines.filter((l) => l.includes('S"ver;"')).length).toBe(1);
		expect(lines.filter((l) => l.includes('S"mode;"')).length).toBe(2);
		expect(lines.filter((l) => l.includes('S"c;"')).length).toBe(1);
		expect(lines.filter((l) => l.includes('S"e;"')).length).toBe(1);
		expect(lines[lines.length - 1]).toContain("echo");
	});

	it("reports pass when mode goes endstop -> pa across c;", () => {
		const result = parseUartTestReply("ver_raw=224 mode_raw=1 mode2_raw=0");
		expect(result).toEqual({ versionMajor: 2, versionMinor: 24, modeBeforeOk: true, modeAfterOk: true });
	});

	it("reports failure when c; did not take effect", () => {
		const result = parseUartTestReply("ver_raw=224 mode_raw=1 mode2_raw=1");
		expect(result?.modeAfterOk).toBe(false);
	});

	it("returns null when the reply is unparseable", () => {
		expect(parseUartTestReply("nonsense")).toBeNull();
	});
});
