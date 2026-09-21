/**
 * CSV / status parsing for PA Calibration logs.
 * PURE — no Vue/DWC imports.
 */

export interface LogRow {
	iter: number;
	pa: number;
	res: number;
	lk: number;
	rk: number;
	Hk: number;
	Ha: number;
}

export interface LogMeta {
	date?: string;
	rrf_version?: string;
	bd_version?: string;
	mode?: string;
	nozzle_temp?: string;
	pa_start?: string;
	pa_step?: string;
	steps?: string;
	hotend_preset?: string;
	extruder?: string;
	[key: string]: string | undefined;
}

export interface ParseCSVResult {
	rows: LogRow[];
	meta: LogMeta;
	error?: string;
}

export interface StatusObj {
	state?: string;
	step?: number;
	steps?: number;
	warmup?: number;
	pa?: number;
	best_pa?: number;
	best_res?: number;
	log?: string;
	[key: string]: string | number | undefined;
}

/** Parse "key=value key=value ..." lines written by the macro into a typed status object. */
export function parseStatus(text: string): StatusObj {
	const obj: Record<string, string | number | undefined> = {};
	for (const pair of text.trim().split(/\s+/)) {
		const eq = pair.indexOf("=");
		if (eq > 0) obj[pair.slice(0, eq)] = pair.slice(eq + 1);
	}
	if (obj.step     !== undefined) obj.step     = parseInt(obj.step     as string);
	if (obj.steps    !== undefined) obj.steps    = parseInt(obj.steps    as string);
	if (obj.warmup   !== undefined) obj.warmup   = parseInt(obj.warmup   as string);
	if (obj.pa       !== undefined) obj.pa       = parseFloat(obj.pa     as string);
	if (obj.best_pa  !== undefined) obj.best_pa  = parseFloat(obj.best_pa as string);
	if (obj.best_res !== undefined) obj.best_res = parseInt(obj.best_res  as string);
	return obj as StatusObj;
}

/** Parse a raw text blob (CSV without metadata) into LogRow[]. Skips comment and header lines. */
export function parseLogRows(text: string): LogRow[] {
	const rows: LogRow[] = [];
	const lines = text.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
	if (!lines.length) return rows;
	const header = lines[0].split(",").map((h) => h.trim());
	for (let i = 1; i < lines.length; i++) {
		const parts = lines[i].split(",");
		if (parts.length < 7) continue;
		try {
			rows.push({
				iter: parseInt(parts[header.indexOf("iter")]),
				pa:   parseFloat(parts[header.indexOf("pa")]),
				res:  parseInt(parts[header.indexOf("res")]),
				lk:   parseInt(parts[header.indexOf("lk")]),
				rk:   parseInt(parts[header.indexOf("rk")]),
				Hk:   parseInt(parts[header.indexOf("Hk")]),
				Ha:   parseInt(parts[header.indexOf("Ha")]),
			});
		} catch (_) { /* skip malformed */ }
	}
	return rows;
}

/** Full CSV parser: extracts # comment metadata and data rows. Returns error string if unusable. */
export function parseCSV(text: string): ParseCSVResult {
	const meta: LogMeta = {};
	const dataLines: string[] = [];
	for (const raw of text.split("\n")) {
		const line = raw.trim();
		if (!line) continue;
		if (line.startsWith("#")) {
			const content = line.replace(/^#+\s*/, "");
			if (content.includes("=")) {
				for (const [, k, v] of content.matchAll(/(\w+)=([^\s]+)/g)) {
					meta[k] = v;
				}
			}
			continue;
		}
		dataLines.push(line);
	}
	if (!dataLines.length) return { rows: [], meta, error: "File is empty" };
	const header = dataLines[0].split(",").map((h) => h.trim());
	const rows: LogRow[] = [];
	for (let i = 1; i < dataLines.length; i++) {
		const parts = dataLines[i].split(",");
		if (parts.length < 7) continue;
		try {
			rows.push({
				iter: parseInt(parts[header.indexOf("iter")]),
				pa:   parseFloat(parts[header.indexOf("pa")]),
				res:  parseInt(parts[header.indexOf("res")]),
				lk:   parseInt(parts[header.indexOf("lk")]),
				rk:   parseInt(parts[header.indexOf("rk")]),
				Hk:   parseInt(parts[header.indexOf("Hk")]),
				Ha:   parseInt(parts[header.indexOf("Ha")]),
			});
		} catch (_) { /* skip malformed */ }
	}
	if (!rows.length) return { rows, meta, error: "No valid data rows found" };
	return { rows, meta };
}
