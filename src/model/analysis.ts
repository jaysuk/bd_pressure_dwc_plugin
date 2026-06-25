/**
 * Analysis logic for PA Calibration log data.
 * PURE — no Vue/DWC imports.
 */

import type { LogRow, LogMeta } from "./parse";
import type { HotendPreset } from "./presets";
import { WARM_UP_SKIP, SLOPE_ASYM_PENALTY } from "./constants";

export interface AnalysisItem {
	icon: string;
	color: string;
	text: string;
}

export interface NextSweep {
	reason: string;
	code: string;
	params: { pa_start: number; pa_step: number; steps: number };
}

export interface AnalysisResult {
	items: AnalysisItem[];
	nextSweep: NextSweep | null;
}

export interface ChartData {
	pa: string[];
	res: number[];
	lk: number[];
	rk: number[];
	Hk: number[];
	Ha: number[];
}

/** Composite score: res plus slope-asymmetry penalty. Lower is better. */
export function compositeScore(r: LogRow): number {
	return r.res + SLOPE_ASYM_PENALTY * Math.abs(r.lk - r.rk);
}

/**
 * Find the best row: from rows where iter >= WARM_UP_SKIP and res > 0,
 * return the one with the lowest composite score.
 */
export function findBest(rows: LogRow[]): LogRow | null {
	const candidates = rows.filter((r) => r.iter >= WARM_UP_SKIP && r.res > 0);
	if (!candidates.length) return null;
	return candidates.reduce((a, b) => (compositeScore(b) < compositeScore(a) ? b : a));
}

/**
 * Walk left/right from best within 120% of bestScore to find the "good zone" bounds.
 * Returns null if best is not found in the active rows.
 */
export function goodBoundsFor(rows: LogRow[], best: LogRow): { gs: LogRow; ge: LogRow } | null {
	const bestScore = compositeScore(best);
	const threshold = bestScore * 1.20;
	const active = rows.filter((r) => r.iter >= WARM_UP_SKIP && r.res > 0);
	const bestIdx = active.findIndex((r) => r.iter === best.iter);
	if (bestIdx < 0) return null;
	let lo = bestIdx;
	while (lo > 0 && compositeScore(active[lo - 1]) <= threshold) lo--;
	let hi = bestIdx;
	while (hi < active.length - 1 && compositeScore(active[hi + 1]) <= threshold) hi++;
	return { gs: active[lo], ge: active[hi] };
}

/**
 * Minimum 4 decimals, max 7, based on smallest consecutive PA diff.
 */
export function paDecimalsFor(rows: LogRow[]): number {
	if (rows.length < 2) return 4;
	let minDiff = Infinity;
	for (let i = 1; i < rows.length; i++) {
		const d = Math.abs(rows[i].pa - rows[i - 1].pa);
		if (d > 0 && d < minDiff) minDiff = d;
	}
	if (!isFinite(minDiff)) return 4;
	const needed = Math.ceil(-Math.log10(minDiff)) + 1;
	return Math.min(Math.max(needed, 4), 7);
}

/** Analyse a set of log rows and return annotated items + nextSweep recommendation. */
export function analyseData(
	rows: LogRow[],
	best: LogRow | null,
	meta: LogMeta,
	dp: number,
	preset: HotendPreset | null,
): AnalysisResult {
	const actualDp = dp || 4;
	const items: AnalysisItem[] = [];
	const active = rows.filter((r) => r.iter >= WARM_UP_SKIP && r.res > 0);
	if (!active.length || !best) return { items, nextSweep: null };

	const resVals = active.map((r) => r.res);
	const paVals  = active.map((r) => r.pa);
	const n       = active.length;
	const mean    = resVals.reduce((a, b) => a + b, 0) / n;
	const variance = resVals.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
	const stddev  = Math.sqrt(variance);
	const cvPct   = mean > 0 ? (stddev / mean) * 100 : 0;
	const paMin   = paVals[0];
	const paMax   = paVals[paVals.length - 1];
	const paRange = paMax - paMin;
	const step    = meta.pa_step ? parseFloat(meta.pa_step) : null;
	const edgeFrac = paRange > 0
		? Math.min((best.pa - paMin) / paRange, (paMax - best.pa) / paRange)
		: 0.5;

	// Hotend preset range check
	if (preset && preset.id !== "custom" && preset.pa_max_expected !== null) {
		if (best.pa > preset.pa_max_expected) {
			items.push({
				icon: "mdi-alert-circle-outline", color: "orange",
				text: `Best PA (${best.pa.toFixed(actualDp)}) is higher than typical for a ${preset.group} hotend (expected up to ${preset.pa_max_expected}). Check your hotend selection is correct, or widen the sweep range to confirm there is no lower minimum at a lower PA value.`,
			});
		} else if (preset.pa_min_expected > 0 && best.pa < preset.pa_min_expected) {
			items.push({
				icon: "mdi-information-outline", color: "yellow",
				text: `Best PA (${best.pa.toFixed(actualDp)}) is lower than typical for a ${preset.group} hotend (usually above ${preset.pa_min_expected}). The result may be valid — check the sweep started from PA=0 to rule out a missed minimum.`,
			});
		}
	}

	// Variability / noise assessment
	const noisy = cvPct > 30;
	if (cvPct > 40) {
		items.push({
			icon: "mdi-alert-outline", color: "orange",
			text: `High noise in res scores (CV ${cvPct.toFixed(0)}%). The minimum may be a random dip rather than a real PA optimum. Repeat the sweep to confirm, or check the sensor is firmly mounted and the nozzle has fully stabilised.`,
		});
	} else if (cvPct > 20) {
		items.push({
			icon: "mdi-information-outline", color: "yellow",
			text: `Moderate variability (CV ${cvPct.toFixed(0)}%). The result is usable but a second run would improve confidence.`,
		});
	} else {
		items.push({
			icon: "mdi-check-circle-outline", color: "green",
			text: `Low variability (CV ${cvPct.toFixed(0)}%) — sweep conditions were consistent.`,
		});
	}

	// Range / edge check
	const firstScore = active[0] ? active[0].res : best.res;
	const lowEndCutOff = best.pa - paMin < paMax - best.pa;
	const firstClearlyWorse = firstScore > best.res * 1.5;
	const edgeWarning = edgeFrac < 0.15 && !(lowEndCutOff && firstClearlyWorse);
	if (edgeWarning) {
		const dir = lowEndCutOff ? "lower" : "higher";
		items.push({
			icon: "mdi-alert-circle-outline", color: "orange",
			text: `Best PA (${best.pa.toFixed(actualDp)}) is near the sweep edge — the true optimum may be ${dir}. Shift the range before zooming in.`,
		});
	} else if (edgeFrac < 0.25 && !(lowEndCutOff && firstClearlyWorse)) {
		items.push({
			icon: "mdi-information-outline", color: "yellow",
			text: `Best PA (${best.pa.toFixed(actualDp)}) is close to one edge — consider a follow-up centred on this value.`,
		});
	} else {
		items.push({
			icon: "mdi-check-circle-outline", color: "green",
			text: `Best PA (${best.pa.toFixed(actualDp)}) is well within the sweep range.`,
		});
	}

	// Minimum sharpness
	const separationPct = mean > 0 ? ((mean - best.res) / mean) * 100 : 0;
	const clearMinimum  = separationPct > 25;
	if (!clearMinimum) {
		items.push({
			icon: "mdi-information-outline", color: "yellow",
			text: `The res curve has no clear minimum (best res is only ${separationPct.toFixed(0)}% below the sweep average). The recommended PA is the best available from this data but should be treated as approximate.`,
		});
	} else {
		items.push({
			icon: "mdi-check-circle-outline", color: "green",
			text: `Clear minimum — best res is ${separationPct.toFixed(0)}% below the sweep average.`,
		});
	}

	// Slope asymmetry
	const lkMean = active.reduce((s, r) => s + r.lk, 0) / n;
	const rkMean = active.reduce((s, r) => s + r.rk, 0) / n;
	if (lkMean > 0 && rkMean > 0) {
		const asymRatio = Math.abs(lkMean - rkMean) / Math.max(lkMean, rkMean);
		if (asymRatio > 0.4) {
			items.push({
				icon: "mdi-swap-horizontal", color: "orange",
				text: `Persistent slope asymmetry across the sweep (lk avg ${lkMean.toFixed(1)}, rk avg ${rkMean.toFixed(1)}). This is a hotend characteristic — often seen with short melt-zone designs (e.g. HF/HV nozzles) — rather than a calibration problem. The recommended PA compensates as well as possible for this geometry.`,
			});
		} else {
			items.push({
				icon: "mdi-check-circle-outline", color: "green",
				text: `Slopes are reasonably symmetric (lk avg ${lkMean.toFixed(1)}, rk avg ${rkMean.toFixed(1)}).`,
			});
		}
	}

	// Composite score note
	const rawBest = active.reduce((a, b) => (b.res < a.res ? b : a));
	if (rawBest.iter !== best.iter) {
		items.push({
			icon: "mdi-information-outline", color: "blue",
			text: `Slope-weighted scoring selected PA ${best.pa.toFixed(actualDp)} (res=${best.res}, asym=${Math.abs(best.lk - best.rk)}) over the raw res minimum PA ${rawBest.pa.toFixed(actualDp)} (res=${rawBest.res}, asym=${Math.abs(rawBest.lk - rawBest.rk)}) — better slope symmetry.`,
		});
	}

	// Next sweep recommendation
	let nextSweep: NextSweep | null = null;
	if (step !== null) {
		const minUsefulStep = 0.0005;
		const stepIsFine    = step <= minUsefulStep;

		if (noisy && stepIsFine) {
			items.push({
				icon: "mdi-alert-outline", color: "orange",
				text: `The step size (${step}) is already fine but the results are noisy — zooming in further will not improve accuracy. Try repeating this sweep to get a consensus result, or run a coarser sweep (step >= 0.005) to confirm the rough PA region first.`,
			});
			const coarseStep  = 0.005;
			const coarseStart = parseFloat(Math.max(0, best.pa - coarseStep * 10).toPrecision(4));
			const coarseEnd   = parseFloat((coarseStart + coarseStep * 20).toPrecision(4));
			const coarseSteps = 20;
			nextSweep = {
				reason: "Run a coarser confirmation sweep centred on the current best PA to check whether this result is consistent.",
				code:   `pa_start = ${coarseStart}\npa_step  = ${coarseStep}\nsteps    = ${coarseSteps}  ; covers ${coarseStart.toFixed(4)}–${coarseEnd.toFixed(4)}`,
				params: { pa_start: coarseStart, pa_step: coarseStep, steps: coarseSteps },
			};
		} else if (noisy) {
			nextSweep = {
				reason: "The sweep was noisy. Repeat with the same settings to confirm the result — if the recommended PA is consistent across two runs, use it.",
				code:   `pa_start = ${paMin.toFixed(actualDp)}\npa_step  = ${step}\nsteps    = ${active.length}  ; same range`,
				params: { pa_start: paMin, pa_step: step, steps: active.length },
			};
		} else if (edgeWarning) {
			const dir = best.pa - paMin < paMax - best.pa ? -1 : 1;
			const ss  = parseFloat(Math.max(0, best.pa + dir * paRange * 0.4).toPrecision(actualDp));
			const se  = parseFloat((ss + paRange).toPrecision(actualDp));
			const sn  = Math.round(paRange / step);
			nextSweep = {
				reason: "Shift the sweep range to centre the minimum.",
				code:   `pa_start = ${ss}\npa_step  = ${step}\nsteps    = ${sn}  ; covers ${ss.toFixed(actualDp)}–${se.toFixed(actualDp)}`,
				params: { pa_start: ss, pa_step: step, steps: sn },
			};
		} else if (!stepIsFine) {
			const fineStep  = parseFloat((step / 4).toPrecision(3));
			const fineDp    = Math.min(Math.ceil(-Math.log10(fineStep)) + 1, 7);
			const fineStart = parseFloat(Math.max(0, best.pa - fineStep * 15).toPrecision(fineDp));
			const fineEnd   = parseFloat((best.pa + fineStep * 15).toPrecision(fineDp));
			const fineSteps = Math.round((fineEnd - fineStart) / fineStep);
			nextSweep = {
				reason: `Good clean result — zoom in around ${best.pa.toFixed(actualDp)} with a finer step (${fineStep}) to pin down the exact optimum.`,
				code:   `pa_start = ${fineStart}\npa_step  = ${fineStep}\nsteps    = ${fineSteps}  ; covers ${fineStart.toFixed(fineDp)}–${fineEnd.toFixed(fineDp)}`,
				params: { pa_start: fineStart, pa_step: fineStep, steps: fineSteps },
			};
		}
	}

	return { items, nextSweep };
}

/** Build chart-ready arrays from log rows. */
export function buildChartData(rows: LogRow[], decimals: number): ChartData {
	return {
		pa:  rows.map((r) => r.pa.toFixed(decimals)),
		res: rows.map((r) => r.res),
		lk:  rows.map((r) => r.lk),
		rk:  rows.map((r) => r.rk),
		Hk:  rows.map((r) => r.Hk),
		Ha:  rows.map((r) => r.Ha),
	};
}
