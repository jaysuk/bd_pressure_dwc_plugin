import { describe, it, expect } from "vitest";
import { parseStatus, parseLogRows, parseCSV } from "../model/parse";

// ── parseStatus ───────────────────────────────────────────────────────────────

describe("parseStatus", () => {
	it("parses a typical status line", () => {
		const s = parseStatus("state=running step=5 steps=50 pa=0.025");
		expect(s.state).toBe("running");
		expect(s.step).toBe(5);
		expect(s.steps).toBe(50);
		expect(s.pa).toBeCloseTo(0.025);
	});

	it("parses done state with best_pa", () => {
		const s = parseStatus("state=done best_pa=0.042 best_res=123");
		expect(s.state).toBe("done");
		expect(s.best_pa).toBeCloseTo(0.042);
		expect(s.best_res).toBe(123);
	});

	it("returns empty object for blank input", () => {
		const s = parseStatus("   ");
		expect(Object.keys(s).length).toBe(0);
	});

	it("handles malformed pairs gracefully", () => {
		const s = parseStatus("state=starting garbage noequals");
		expect(s.state).toBe("starting");
		// garbage and noequals are skipped
		expect(s.garbage).toBeUndefined();
	});

	it("parses warmup integer", () => {
		const s = parseStatus("state=warmup warmup=3");
		expect(s.warmup).toBe(3);
	});

	it("handles a log path with equals in it gracefully", () => {
		const s = parseStatus("state=done log=0:/sys/PA Calibration/pa_20250101_120000.csv");
		expect(s.state).toBe("done");
		expect(typeof s.log).toBe("string");
	});
});

// ── parseLogRows ──────────────────────────────────────────────────────────────

describe("parseLogRows", () => {
	const validCSV = [
		"iter,pa,res,lk,rk,Hk,Ha",
		"0,0.000,850,45,42,220,218",
		"1,0.005,800,40,38,221,219",
		"2,0.010,720,35,34,222,220",
	].join("\n");

	it("parses valid CSV rows", () => {
		const rows = parseLogRows(validCSV);
		expect(rows).toHaveLength(3);
		expect(rows[0].iter).toBe(0);
		expect(rows[1].pa).toBeCloseTo(0.005);
		expect(rows[2].res).toBe(720);
	});

	it("skips comment lines", () => {
		const text = "# date=2025-01-01\niter,pa,res,lk,rk,Hk,Ha\n0,0.000,900,50,48,200,198";
		const rows = parseLogRows(text);
		expect(rows).toHaveLength(1);
	});

	it("skips rows with fewer than 7 fields", () => {
		const text = "iter,pa,res,lk,rk,Hk,Ha\n0,0.000,900,50,48\n1,0.005,800,40,38,220,218";
		const rows = parseLogRows(text);
		expect(rows).toHaveLength(1);
		expect(rows[0].iter).toBe(1);
	});

	it("returns empty array for empty text", () => {
		expect(parseLogRows("")).toHaveLength(0);
	});
});

// ── parseCSV ──────────────────────────────────────────────────────────────────

describe("parseCSV", () => {
	const fullCSV = [
		"# date=2025-01-01 nozzle_temp=215 hotend_preset=standard",
		"# pa_start=0.000 pa_step=0.005 steps=50",
		"iter,pa,res,lk,rk,Hk,Ha",
		"0,0.000,900,50,48,200,198",
		"1,0.005,850,45,43,210,208",
		"2,0.010,780,38,36,215,213",
	].join("\n");

	it("extracts metadata from # comment lines", () => {
		const result = parseCSV(fullCSV);
		expect(result.meta.date).toBe("2025-01-01");
		expect(result.meta.nozzle_temp).toBe("215");
		expect(result.meta.hotend_preset).toBe("standard");
		expect(result.meta.pa_step).toBe("0.005");
	});

	it("parses data rows correctly", () => {
		const result = parseCSV(fullCSV);
		expect(result.rows).toHaveLength(3);
		expect(result.rows[2].res).toBe(780);
	});

	it("returns error for empty file", () => {
		const result = parseCSV("   \n  ");
		expect(result.error).toBeTruthy();
		expect(result.rows).toHaveLength(0);
	});

	it("returns error when no valid data rows found", () => {
		const result = parseCSV("# comment\niter,pa,res,lk,rk,Hk,Ha\nbad,data");
		expect(result.error).toBeTruthy();
	});

	it("handles file with no metadata (no # lines)", () => {
		const text = "iter,pa,res,lk,rk,Hk,Ha\n0,0.000,900,50,48,200,198";
		const result = parseCSV(text);
		expect(result.error).toBeUndefined();
		expect(result.rows).toHaveLength(1);
		expect(Object.keys(result.meta)).toHaveLength(0);
	});
});
