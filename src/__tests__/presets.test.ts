import { describe, it, expect } from "vitest";
import { HOTEND_PRESETS, activePreset, hotendPresetItems } from "../model/presets";

describe("HOTEND_PRESETS", () => {
	it("contains unknown and custom plus the 4 main presets", () => {
		const ids = HOTEND_PRESETS.map((p) => p.id);
		expect(ids).toContain("unknown");
		expect(ids).toContain("custom");
		expect(ids).toContain("short");
		expect(ids).toContain("standard");
		expect(ids).toContain("highflow");
		expect(ids).toContain("bowden");
	});

	it("has exactly 6 presets", () => {
		expect(HOTEND_PRESETS).toHaveLength(6);
	});

	it("bowden preset has pa_start > 0", () => {
		const bowden = HOTEND_PRESETS.find((p) => p.id === "bowden")!;
		expect(bowden.pa_start).toBeGreaterThan(0);
		expect(bowden.pa_step).toBeGreaterThan(0.01);
	});

	it("short melt zone has smaller step than standard", () => {
		const short    = HOTEND_PRESETS.find((p) => p.id === "short")!;
		const standard = HOTEND_PRESETS.find((p) => p.id === "standard")!;
		expect(short.pa_step).toBeLessThan(standard.pa_step);
	});
});

describe("hotendPresetItems", () => {
	it("returns items including subheaders for grouped presets", () => {
		const items = hotendPresetItems();
		// Should have subheader entries for non-null groups
		const headers = items.filter((i) => "type" in i && i.type === "subheader");
		expect(headers.length).toBeGreaterThan(0);
	});

	it("includes all preset ids as select items", () => {
		const items = hotendPresetItems();
		const values = items.filter((i) => "value" in i).map((i) => (i as { value: string }).value);
		expect(values).toContain("unknown");
		expect(values).toContain("custom");
		expect(values).toContain("short");
		expect(values).toContain("standard");
		expect(values).toContain("highflow");
		expect(values).toContain("bowden");
	});

	it("does not insert a subheader before null-group items", () => {
		const items = hotendPresetItems();
		// The first item should be the unknown preset (value), not a header
		expect("value" in items[0]).toBe(true);
	});
});

describe("activePreset", () => {
	it("returns the correct preset for a known id", () => {
		const p = activePreset("standard");
		expect(p.id).toBe("standard");
		expect(p.pa_step).toBe(0.005);
	});

	it("returns the unknown preset for an unrecognised id", () => {
		const p = activePreset("does-not-exist");
		expect(p.id).toBe("unknown");
	});

	it("returns the correct preset for bowden", () => {
		const p = activePreset("bowden");
		expect(p.id).toBe("bowden");
		expect(p.pa_start).toBeCloseTo(0.3);
	});
});
