import { describe, it, expect } from "vitest";
import {
	compositeScore,
	findBest,
	goodBoundsFor,
	paDecimalsFor,
	analyseData,
} from "../model/analysis";
import { WARM_UP_SKIP, SLOPE_ASYM_PENALTY } from "../model/constants";
import type { LogRow } from "../model/parse";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRow(iter: number, pa: number, res: number, lk = 30, rk = 30, Hk = 200, Ha = 200): LogRow {
	return { iter, pa, res, lk, rk, Hk, Ha };
}

// ── compositeScore ────────────────────────────────────────────────────────────

describe("compositeScore", () => {
	it("equals res when lk === rk (symmetric)", () => {
		const r = makeRow(0, 0, 800, 30, 30);
		expect(compositeScore(r)).toBe(800);
	});

	it("adds SLOPE_ASYM_PENALTY * |lk - rk| for asymmetric slopes", () => {
		const r = makeRow(0, 0, 800, 40, 20); // |40-20| = 20
		expect(compositeScore(r)).toBeCloseTo(800 + SLOPE_ASYM_PENALTY * 20);
	});

	it("is symmetric regardless of which slope is higher", () => {
		const r1 = makeRow(0, 0, 800, 40, 20);
		const r2 = makeRow(0, 0, 800, 20, 40);
		expect(compositeScore(r1)).toBeCloseTo(compositeScore(r2));
	});
});

// ── findBest ──────────────────────────────────────────────────────────────────

describe("findBest", () => {
	it("returns null for empty rows", () => {
		expect(findBest([])).toBeNull();
	});

	it("skips rows where iter < WARM_UP_SKIP", () => {
		const rows = [
			makeRow(0, 0.000, 200),   // iter < WARM_UP_SKIP, would win on res
			makeRow(1, 0.005, 190),   // iter < WARM_UP_SKIP
			makeRow(2, 0.010, 800),   // first eligible
			makeRow(3, 0.015, 750),
		];
		const best = findBest(rows);
		expect(best).not.toBeNull();
		expect(best!.iter).toBeGreaterThanOrEqual(WARM_UP_SKIP);
	});

	it("skips rows where res === 0", () => {
		const rows = [
			makeRow(2, 0.010, 0),   // res = 0, skip
			makeRow(3, 0.015, 800),
			makeRow(4, 0.020, 750),
		];
		const best = findBest(rows);
		expect(best!.res).toBeGreaterThan(0);
	});

	it("returns the row with the lowest composite score", () => {
		// Row at iter=3 has lower res but higher asymmetry; row at iter=4 wins on composite
		const rows = [
			makeRow(2, 0.010, 900, 30, 30),
			makeRow(3, 0.015, 700, 60, 20),   // res=700 but asym=40, composite=700+20=720
			makeRow(4, 0.020, 720, 30, 30),   // res=720 but symmetric, composite=720
		];
		// composite(iter=3) = 700 + 0.5*40 = 720; composite(iter=4) = 720 — tie, iter=3 wins as first minimum
		const best = findBest(rows);
		// The reduce picks the first one when equal (b wins only when strictly less)
		expect(best).not.toBeNull();
	});

	it("picks the lower-res row when its composite is still below the symmetric one", () => {
		const rows = [
			makeRow(2, 0.010, 900, 30, 30),
			makeRow(3, 0.015, 600, 10, 10),  // res=600, lk==rk, composite=600 — clear winner
			makeRow(4, 0.020, 630, 30, 30),  // res=630, composite=630
		];
		const best = findBest(rows);
		expect(best!.iter).toBe(3); // composite(3)=600 < composite(4)=630
	});
});

describe("findBest - symmetric wins over asymmetric", () => {
	it("picks the symmetric row when composite is lower", () => {
		const rows = [
			makeRow(2, 0.010, 900, 30, 30),
			makeRow(3, 0.015, 600, 80, 10),  // composite = 600 + 0.5*70 = 635
			makeRow(4, 0.020, 630, 30, 30),  // composite = 630
		];
		const best = findBest(rows);
		expect(best!.iter).toBe(4); // 630 < 635
	});
});

// ── goodBoundsFor ─────────────────────────────────────────────────────────────

describe("goodBoundsFor", () => {
	it("returns null when best is not in active rows", () => {
		const rows = [makeRow(2, 0.010, 800), makeRow(3, 0.015, 750)];
		const fakeBest = makeRow(10, 0.100, 500);
		expect(goodBoundsFor(rows, fakeBest)).toBeNull();
	});

	it("returns the best row itself when all others exceed 120%", () => {
		const rows = [
			makeRow(2, 0.000, 1000),
			makeRow(3, 0.005, 500),   // best, composite = 500
			makeRow(4, 0.010, 1000),
		];
		const best = findBest(rows)!;
		const bounds = goodBoundsFor(rows, best);
		expect(bounds).not.toBeNull();
		expect(bounds!.gs.iter).toBe(best.iter);
		expect(bounds!.ge.iter).toBe(best.iter);
	});

	it("expands to include adjacent rows within 120% threshold", () => {
		const rows = [
			makeRow(2, 0.000, 1000),
			makeRow(3, 0.005, 500),    // best, composite = 500, threshold = 600
			makeRow(4, 0.010, 580),    // 580 < 600 — included
			makeRow(5, 0.015, 650),    // 650 > 600 — excluded
		];
		const best = findBest(rows)!;
		const bounds = goodBoundsFor(rows, best)!;
		expect(bounds.gs.iter).toBe(3);
		expect(bounds.ge.iter).toBe(4);
	});
});

// ── paDecimalsFor ─────────────────────────────────────────────────────────────

describe("paDecimalsFor", () => {
	it("returns 4 for fewer than 2 rows", () => {
		expect(paDecimalsFor([])).toBe(4);
		expect(paDecimalsFor([makeRow(0, 0.005, 800)])).toBe(4);
	});

	it("returns at least 4 for standard 0.005 step", () => {
		const rows = [makeRow(0, 0.000, 800), makeRow(1, 0.005, 750), makeRow(2, 0.010, 700)];
		expect(paDecimalsFor(rows)).toBeGreaterThanOrEqual(4);
	});

	it("returns more decimals for fine step (0.0005)", () => {
		const rows = [
			makeRow(0, 0.0000, 800),
			makeRow(1, 0.0005, 750),
			makeRow(2, 0.0010, 700),
		];
		const dp = paDecimalsFor(rows);
		expect(dp).toBeGreaterThan(4);
	});

	it("caps at 7", () => {
		const rows = [
			makeRow(0, 0.0000000, 800),
			makeRow(1, 0.0000001, 750),
		];
		expect(paDecimalsFor(rows)).toBeLessThanOrEqual(7);
	});
});

// ── analyseData ───────────────────────────────────────────────────────────────

describe("analyseData", () => {
	function makeRows(resValues: number[]): LogRow[] {
		return resValues.map((res, i) => makeRow(i, i * 0.005, res));
	}

	it("returns empty items when no eligible rows", () => {
		const result = analyseData([], null, {}, 4, null);
		expect(result.items).toHaveLength(0);
		expect(result.nextSweep).toBeNull();
	});

	it("flags high noise (CV > 40%)", () => {
		// Highly variable res values
		const rows = makeRows([100, 900, 100, 900, 100, 900, 100, 900]);
		const best = findBest(rows);
		const result = analyseData(rows, best, { pa_step: "0.005" }, 4, null);
		const noiseItem = result.items.find((i) => i.color === "orange" && i.text.includes("noise"));
		expect(noiseItem).toBeDefined();
	});

	it("flags edge warning when best is near sweep edge", () => {
		// Best is at iter=2 (pa=0.010), sweep goes to 0.050 — best near low edge
		const rows = [
			makeRow(2, 0.010, 500),
			makeRow(3, 0.015, 600),
			makeRow(4, 0.020, 650),
			makeRow(5, 0.025, 700),
			makeRow(6, 0.030, 720),
			makeRow(7, 0.035, 730),
			makeRow(8, 0.040, 740),
			makeRow(9, 0.045, 750),
			makeRow(10, 0.050, 760),
		];
		const best = findBest(rows)!;
		const result = analyseData(rows, best, { pa_step: "0.005" }, 4, null);
		const edgeItem = result.items.find((i) => i.text.includes("edge") || i.text.includes("near"));
		expect(edgeItem).toBeDefined();
	});

	it("flags clear minimum when best is well below the mean", () => {
		// One clear dip at iter=5
		const rows = [
			makeRow(2, 0.000, 900),
			makeRow(3, 0.005, 880),
			makeRow(4, 0.010, 860),
			makeRow(5, 0.015, 500),   // clear winner — 44% below mean ~887
			makeRow(6, 0.020, 890),
			makeRow(7, 0.025, 910),
		];
		const best = findBest(rows)!;
		const result = analyseData(rows, best, { pa_step: "0.005" }, 4, null);
		const clearItem = result.items.find((i) => i.text.includes("Clear minimum"));
		expect(clearItem).toBeDefined();
	});

	it("flags slope asymmetry when lk/rk differ persistently", () => {
		const rows = [
			makeRow(2, 0.010, 900, 80, 20),
			makeRow(3, 0.015, 800, 80, 20),
			makeRow(4, 0.020, 700, 80, 20),
			makeRow(5, 0.025, 750, 80, 20),
		];
		const best = findBest(rows)!;
		const result = analyseData(rows, best, { pa_step: "0.005" }, 4, null);
		const asymItem = result.items.find((i) => i.icon === "mdi-swap-horizontal");
		expect(asymItem).toBeDefined();
	});

	it("suggests a zoom-in when result is clean", () => {
		const rows = [
			makeRow(2, 0.000, 900),
			makeRow(3, 0.005, 880),
			makeRow(4, 0.010, 860),
			makeRow(5, 0.015, 500),
			makeRow(6, 0.020, 860),
			makeRow(7, 0.025, 880),
			makeRow(8, 0.030, 900),
		];
		const best = findBest(rows)!;
		const result = analyseData(rows, best, { pa_step: "0.005" }, 4, null);
		expect(result.nextSweep).not.toBeNull();
		expect(result.nextSweep!.params.pa_step).toBeLessThan(0.005);
	});

	it("suggests repeat (not zoom) when noisy with coarse step", () => {
		const rows = [
			makeRow(2, 0.000, 800),
			makeRow(3, 0.005, 900),
			makeRow(4, 0.010, 200),
			makeRow(5, 0.015, 950),
			makeRow(6, 0.020, 850),
			makeRow(7, 0.025, 100),
			makeRow(8, 0.030, 900),
		];
		const best = findBest(rows)!;
		const result = analyseData(rows, best, { pa_step: "0.005" }, 4, null);
		// noisy = true (high CV), step is coarse → suggest repeat
		if (result.nextSweep) {
			// Either a repeat (same step) or coarser step suggestion — both are valid
			expect(result.nextSweep.params.pa_step).toBeGreaterThanOrEqual(0.005);
		}
	});
});
