/**
 * GCode builders for PA Calibration.
 * PURE — no Vue/DWC imports.
 */

export interface CalibParams {
	tool: number;
	nozzle_temp: number;
	pa_start: number;
	pa_step: number;
	steps: number;
	warmup_steps: number;
	bidirectional: boolean;
	low_speed: number;
	high_speed: number;
	travel_speed: number;
	z_height: number;
}

/** Build an M572 gcode string. */
export function buildM572(extruderIndex: number, pa: number, dp: number): string {
	return `M572 D${extruderIndex} S${pa.toFixed(dp)}`;
}

/**
 * Build the array of `set global.*` GCode lines to send before starting the calibration macro.
 * The bd_globals.g declares all bd_live_* variables at boot, so `set` always works.
 */
export function buildStartCommands(params: CalibParams, hotendPreset: string): string[] {
	const p = params;
	return [
		`set global.bd_live_tool = ${p.tool}`,
		`set global.bd_live_nozzle_temp = ${p.nozzle_temp}`,
		`set global.bd_live_pa_start = ${p.pa_start}`,
		`set global.bd_live_pa_step = ${p.pa_step}`,
		`set global.bd_live_steps = ${p.steps}`,
		`set global.bd_live_warmup_steps = ${p.warmup_steps}`,
		`set global.bd_live_bidirectional = ${p.bidirectional ? "true" : "false"}`,
		`set global.bd_live_hotend_preset = "${hotendPreset}"`,
		`set global.bd_live_low_speed = ${p.low_speed}`,
		`set global.bd_live_high_speed = ${p.high_speed}`,
		`set global.bd_live_travel_speed = ${p.travel_speed}`,
		`set global.bd_live_z_height = ${p.z_height}`,
	];
}

/** Build the command to stop the calibration macro. */
export function buildStopCommand(): string {
	return "M108";
}

/** Build the command to clear the status file before a new run. */
export function buildStatusClearCommand(): string {
	return 'echo >"0:/sys/pa_live_status.txt" "state=starting"';
}

/** Build the command to fire the calibration macro. */
export function buildRunCommand(): string {
	return 'M98 P"0:/sys/pa_calibrate_live.g"';
}
