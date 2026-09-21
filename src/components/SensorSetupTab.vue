<style scoped>
.setup-section-title {
	font-size: 0.75em;
	text-transform: uppercase;
	letter-spacing: 0.08em;
	opacity: 0.6;
	margin: 4px 0 8px;
}
.setup-group {
	max-width: 640px;
	margin-bottom: 28px;
}
.info-chip {
	margin: 2px 8px 2px 0;
}
</style>

<template>
	<v-card-text class="pt-2">
		<div class="text-body-2 mb-4" style="opacity:0.7; max-width:640px">
			Sensor configuration and diagnostics — a native equivalent of the separate <code>/macros/bd_*.g</code>
			files, so day-to-day sensor setup doesn't need a trip to the Macros panel.
		</div>

		<v-alert v-if="setupError" type="error" density="compact" closable @click:close="setupError = ''" class="mb-4" style="max-width:640px">
			{{ setupError }}
		</v-alert>

		<!-- ============================================================ Sensor ============================================================ -->
		<div class="setup-group">
			<div class="setup-section-title">Sensor</div>

			<div class="mb-3">
				<v-btn size="small" variant="outlined" :loading="infoLoading" @click="refreshInfo">
					<v-icon size="small" class="mr-1">mdi-refresh</v-icon>Refresh
				</v-btn>
				<HelpTip class="ml-1" text="Reads firmware version, current mode, and trigger threshold directly from the sensor (ver;/mode;/Q;). Trigger and ADC-output logging state can't be read back this way — use Status for those." />
			</div>
			<div v-if="info" class="mb-3">
				<v-chip size="small" class="info-chip" color="blue-grey-darken-2"><v-icon start size="x-small">mdi-chip</v-icon>v{{ info.versionMajor }}.{{ info.versionMinor }}</v-chip>
				<v-chip size="small" class="info-chip" :color="info.mode === 'pa' ? 'teal-darken-2' : 'deep-purple-darken-2'"><v-icon start size="x-small">mdi-sine-wave</v-icon>mode: {{ info.mode }}</v-chip>
				<v-chip size="small" class="info-chip" color="orange-darken-3"><v-icon start size="x-small">mdi-gauge</v-icon>threshold: {{ info.threshold }}</v-chip>
			</div>

			<v-btn size="small" variant="outlined" class="mr-2 mb-2" @click="sendStatus">
				<v-icon size="small" class="mr-1">mdi-information-outline</v-icon>Status
			</v-btn>
			<HelpTip text="Sends s; — the sensor replies with its own popup showing mode, threshold, invert, version, baud, and logging state." />

			<div class="mt-1">
				<v-btn size="small" variant="outlined" color="error" class="mb-2" @click="rebootDialog = true">
					<v-icon size="small" class="mr-1">mdi-restart</v-icon>Reboot sensor
				</v-btn>
				<HelpTip text="Equivalent to a power cycle. Interrupts anything in progress — useful for recovering the sensor from an unexpected state. Restarts in endstop/probe mode." />
			</div>
		</div>

		<!-- ============================================================ Configuration ============================================================ -->
		<div class="setup-group">
			<div class="setup-section-title">Configuration</div>

			<div class="d-flex align-center mb-3">
				<v-select
					v-model="selectedBaud"
					:items="baudItems"
					variant="outlined" density="compact" hide-details
					label="Baud rate" style="max-width:200px"
					class="mr-2"
				/>
				<v-btn size="small" variant="outlined" :disabled="!canChangeBaud" @click="baudDialog = true">Set</v-btn>
				<HelpTip class="ml-1" :text="`Current: ${bdBaud} baud (from global.bd_baud). Changing this switches the sensor's UART rate and reboots it — the Duet's port is re-pointed at the new rate automatically, but bd_globals.g must still be edited by hand for the new rate to survive a Duet reboot.`" />
			</div>

			<div class="mb-3">
				<v-btn size="small" variant="outlined" class="mr-2 mb-2" :loading="infoLoading" @click="openThresholdDialog">
					<v-icon size="small" class="mr-1">mdi-gauge</v-icon>Set threshold…
				</v-btn>
				<HelpTip text="Probe trigger threshold, 1–99. Higher = less sensitive (more force to trigger), lower = more sensitive. Saved to the sensor's flash automatically." />
			</div>

			<div class="mb-1">
				<v-btn size="small" variant="outlined" class="mr-2 mb-2" @click="sendPaMode">
					<v-icon size="small" class="mr-1">mdi-sine-wave</v-icon>PA mode
				</v-btn>
				<v-btn size="small" variant="outlined" class="mr-2 mb-2" @click="sendEndstopMode">
					<v-icon size="small" class="mr-1">mdi-crosshairs-gps</v-icon>Endstop mode
				</v-btn>
				<HelpTip text="Endstop mode is the sensor's normal operating mode for Z homing and bed mesh probing — it's selected automatically on power-up. PA mode is a diagnostic ADC mode; the calibration run switches to it itself, you shouldn't normally need this button." />
			</div>
		</div>

		<!-- ============================================================ Diagnostics ============================================================ -->
		<div class="setup-group">
			<div class="setup-section-title">Diagnostics</div>

			<div class="mb-3">
				<div class="text-caption mb-1" style="opacity:0.7">Trigger logging (console)</div>
				<v-btn size="small" variant="outlined" class="mr-2 mb-1" @click="fireAndForget(buildTriggerLoggingCommand(bdUart, true), 'Trigger logging enabled')">On</v-btn>
				<v-btn size="small" variant="outlined" class="mr-2 mb-1" @click="fireAndForget(buildTriggerLoggingCommand(bdUart, false), 'Trigger logging disabled')">Off</v-btn>
				<div class="text-caption mb-2" style="opacity:0.7">ADC output (console)</div>
				<v-btn size="small" variant="outlined" class="mr-2 mb-1" @click="fireAndForget(buildAdcOutputCommand(bdUart, true), 'ADC output enabled')">On</v-btn>
				<v-btn size="small" variant="outlined" class="mr-2 mb-1" @click="fireAndForget(buildAdcOutputCommand(bdUart, false), 'ADC output disabled')">Off</v-btn>
				<HelpTip text="Trigger logging prints probe trigger/release events to the DWC console. ADC output streams raw values continuously — disable before probing or PA calibration. Neither state can be read back, and both reset to off on sensor reboot; use Status to check the current state." />
			</div>

			<div class="mb-2">
				<v-btn size="small" variant="outlined" :loading="uartTestRunning" @click="runUartTest">
					<v-icon size="small" class="mr-1">mdi-test-tube</v-icon>UART test
				</v-btn>
				<HelpTip class="ml-1" text="Confirms the Duet can talk to the sensor: reads firmware version, reads the mode byte (expects endstop), switches to PA mode, reads the mode byte again (expects pa), then restores endstop mode." />
			</div>
			<div v-if="uartTestResult" class="mt-1">
				<v-chip size="small" class="info-chip" color="blue-grey-darken-2"><v-icon start size="x-small">mdi-chip</v-icon>v{{ uartTestResult.versionMajor }}.{{ uartTestResult.versionMinor }}</v-chip>
				<v-chip size="small" class="info-chip" :color="uartTestResult.modeBeforeOk ? 'success' : 'error'">
					<v-icon start size="x-small">{{ uartTestResult.modeBeforeOk ? "mdi-check" : "mdi-close" }}</v-icon>mode before c; {{ uartTestResult.modeBeforeOk ? "endstop ✓" : "unexpected" }}
				</v-chip>
				<v-chip size="small" class="info-chip" :color="uartTestResult.modeAfterOk ? 'success' : 'error'">
					<v-icon start size="x-small">{{ uartTestResult.modeAfterOk ? "mdi-check" : "mdi-close" }}</v-icon>mode after c; {{ uartTestResult.modeAfterOk ? "pa ✓" : "unexpected ✗" }}
				</v-chip>
			</div>
		</div>

		<v-snackbar v-model="actionDone" :timeout="2500" color="success" location="top">{{ actionDoneMessage }}</v-snackbar>

		<!-- Reboot confirmation -->
		<v-dialog v-model="rebootDialog" max-width="440">
			<v-card>
				<v-card-title>Reboot sensor?</v-card-title>
				<v-card-text>
					This interrupts anything the sensor is doing and restarts it in endstop/probe mode.
					Sends: <code>M118 P{{ bdUart }} S"r;"</code>
				</v-card-text>
				<v-card-actions>
					<v-spacer />
					<v-btn variant="text" @click="rebootDialog = false">Cancel</v-btn>
					<v-btn color="error" variant="flat" @click="confirmReboot">Reboot</v-btn>
				</v-card-actions>
			</v-card>
		</v-dialog>

		<!-- Baud change confirmation -->
		<v-dialog v-model="baudDialog" max-width="440">
			<v-card>
				<v-card-title>Change baud rate?</v-card-title>
				<v-card-text>
					Current: <strong>{{ bdBaud }}</strong> baud. New: <strong>{{ selectedBaud }}</strong> baud.
					The sensor will save this to flash and reboot; the Duet's port is switched to match automatically.
					<br><br>
					<strong>Remember to also update <code>bd_baud</code> in <code>/sys/bd_globals.g</code></strong> —
					otherwise this reverts the next time the Duet reboots.
				</v-card-text>
				<v-card-actions>
					<v-spacer />
					<v-btn variant="text" @click="baudDialog = false">Cancel</v-btn>
					<v-btn color="primary" variant="flat" :loading="baudChanging" @click="confirmBaudChange">Change</v-btn>
				</v-card-actions>
			</v-card>
		</v-dialog>

		<!-- Threshold dialog -->
		<v-dialog v-model="thresholdDialog" max-width="380">
			<v-card>
				<v-card-title>Set trigger threshold</v-card-title>
				<v-card-text>
					<v-text-field
						v-model.number="thresholdValue"
						type="number" min="1" max="99"
						variant="outlined" density="compact"
						label="Threshold (1–99)"
					/>
					<div class="text-caption" style="opacity:0.7">Higher = less sensitive, lower = more sensitive.</div>
				</v-card-text>
				<v-card-actions>
					<v-spacer />
					<v-btn variant="text" @click="thresholdDialog = false">Cancel</v-btn>
					<v-btn color="primary" variant="flat" :loading="thresholdSaving" @click="confirmThreshold">Set</v-btn>
				</v-card-actions>
			</v-card>
		</v-dialog>
	</v-card-text>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { HelpTip } from "dwc-plugin-runtime";

import { useMachineStore } from "@/stores/machine";

import {
	BAUD_TABLE,
	buildDeviceModeCommand, buildRawModeCommand,
	buildStatusCommand, buildRebootCommand, buildPaModeCommand, buildEndstopModeCommand,
	buildTriggerLoggingCommand, buildAdcOutputCommand, buildThresholdSetCommand,
	buildBaudChangeCommand, buildSetStoredBaudCommand,
	buildSensorInfoReadCommand, parseSensorInfoReply, type SensorInfo,
	buildUartTestCommand, parseUartTestReply, type UartTestResult,
} from "../model/sensorCommands";

const machineStore = useMachineStore();

const modelGlobal = computed(() => (machineStore.model as { global?: Map<string, unknown> }).global);
function globalNumber(key: string, fallback: number): number {
	const g = modelGlobal.value;
	const v = g instanceof Map ? g.get(key) : undefined;
	return typeof v === "number" ? v : fallback;
}
const bdPort = computed(() => globalNumber("bd_port", 1));
const bdUart = computed(() => globalNumber("bd_uart", 2));
const bdBaud = computed(() => globalNumber("bd_baud", 115200));

const baudItems = BAUD_TABLE.map((b) => ({ title: String(b), value: b }));
const selectedBaud = ref<number>(BAUD_TABLE.includes(bdBaud.value as (typeof BAUD_TABLE)[number]) ? bdBaud.value : BAUD_TABLE[0]);
const canChangeBaud = computed(() => selectedBaud.value !== bdBaud.value);

// Keep the dropdown tracking the actual stored baud while the change dialog isn't open (e.g. once
// the object model finishes loading after mount, or right after we've just changed it ourselves).
watch(bdBaud, (v) => {
	if (baudDialog.value) return;
	if (BAUD_TABLE.includes(v as (typeof BAUD_TABLE)[number])) selectedBaud.value = v;
});

const setupError    = ref("");
const actionDone     = ref(false);
const actionDoneMessage = ref("");

const info        = ref<SensorInfo | null>(null);
const infoLoading = ref(false);

const rebootDialog  = ref(false);
const baudDialog    = ref(false);
const baudChanging  = ref(false);

const thresholdDialog = ref(false);
const thresholdValue  = ref(4);
const thresholdSaving = ref(false);

const uartTestRunning = ref(false);
const uartTestResult  = ref<UartTestResult | null>(null);

function notify(message: string): void {
	actionDoneMessage.value = message;
	actionDone.value = true;
}

function sendGCode(cmd: string): Promise<string> {
	return (machineStore as unknown as { sendCode: (c: string, a: boolean, b: boolean) => Promise<string> }).sendCode(cmd, false, false);
}

/** Fire-and-forget trigger commands with no capturable reply — send, then report success/failure. */
function fireAndForget(cmd: string, successMessage: string): void {
	sendGCode(cmd)
		.then(() => { notify(successMessage); })
		.catch((e: unknown) => { setupError.value = `Command failed: ${(e as Error).message || e}`; });
}

/**
 * Runs `fn` with the aux port switched into device mode, always switching it back to raw mode
 * afterwards — even if `fn` throws — so a failed read can't strand the port in device mode
 * (the macros this is based on don't guard against that).
 */
async function withDeviceMode<T>(fn: () => Promise<T>): Promise<T> {
	await sendGCode(buildDeviceModeCommand(bdPort.value, bdBaud.value));
	try {
		return await fn();
	} finally {
		await sendGCode(buildRawModeCommand(bdPort.value, bdBaud.value));
	}
}

async function refreshInfo(): Promise<void> {
	setupError.value = "";
	infoLoading.value = true;
	try {
		const reply = await withDeviceMode(() => sendGCode(buildSensorInfoReadCommand(bdPort.value)));
		const parsed = parseSensorInfoReply(reply);
		if (!parsed) { setupError.value = "Could not read sensor info — unexpected reply."; return; }
		info.value = parsed;
	} catch (e: unknown) {
		setupError.value = `Failed to read sensor info: ${(e as Error).message || e}`;
	} finally {
		infoLoading.value = false;
	}
}

function sendStatus(): void {
	fireAndForget(buildStatusCommand(bdUart.value), "Status request sent — check the popup");
}

function sendPaMode(): void {
	sendGCode(buildPaModeCommand(bdUart.value))
		.then(() => { notify("Switched to PA mode"); return refreshInfo(); })
		.catch((e: unknown) => { setupError.value = `Failed to switch mode: ${(e as Error).message || e}`; });
}
function sendEndstopMode(): void {
	sendGCode(buildEndstopModeCommand(bdUart.value))
		.then(() => { notify("Switched to endstop mode"); return refreshInfo(); })
		.catch((e: unknown) => { setupError.value = `Failed to switch mode: ${(e as Error).message || e}`; });
}

async function confirmReboot(): Promise<void> {
	rebootDialog.value = false;
	try {
		await sendGCode(buildRebootCommand(bdUart.value));
		notify("Reboot sent");
	} catch (e: unknown) {
		setupError.value = `Failed to reboot sensor: ${(e as Error).message || e}`;
	}
}

async function confirmBaudChange(): Promise<void> {
	baudChanging.value = true;
	setupError.value = "";
	try {
		const idx = BAUD_TABLE.indexOf(selectedBaud.value as (typeof BAUD_TABLE)[number]);
		if (idx < 0) { setupError.value = "Unknown baud rate."; return; }
		await sendGCode(buildBaudChangeCommand(bdUart.value, idx));
		// The sensor saves the new rate to flash and reboots itself — give it time before the Duet
		// switches its own port over, same as bd_baud.g's G4 P1500 waits.
		await sendGCode("G4 P1500");
		await sendGCode(buildRawModeCommand(bdPort.value, selectedBaud.value));
		await sendGCode("G4 P1500");
		await sendGCode(buildSetStoredBaudCommand(selectedBaud.value));
		baudDialog.value = false;
		notify(`Baud rate set to ${selectedBaud.value} — remember to update bd_globals.g`);
	} catch (e: unknown) {
		setupError.value = `Failed to change baud rate: ${(e as Error).message || e}`;
	} finally {
		baudChanging.value = false;
	}
}

async function openThresholdDialog(): Promise<void> {
	await refreshInfo();
	if (info.value) thresholdValue.value = info.value.threshold;
	thresholdDialog.value = true;
}

async function confirmThreshold(): Promise<void> {
	thresholdSaving.value = true;
	try {
		await sendGCode(buildThresholdSetCommand(bdUart.value, thresholdValue.value));
		thresholdDialog.value = false;
		notify(`Threshold set to ${Math.min(99, Math.max(1, Math.floor(thresholdValue.value)))}`);
		await refreshInfo();
	} catch (e: unknown) {
		setupError.value = `Failed to set threshold: ${(e as Error).message || e}`;
	} finally {
		thresholdSaving.value = false;
	}
}

async function runUartTest(): Promise<void> {
	setupError.value = "";
	uartTestRunning.value = true;
	uartTestResult.value = null;
	try {
		const reply = await withDeviceMode(() => sendGCode(buildUartTestCommand(bdPort.value)));
		const parsed = parseUartTestReply(reply);
		if (!parsed) { setupError.value = "UART test failed — unexpected reply."; return; }
		uartTestResult.value = parsed;
	} catch (e: unknown) {
		setupError.value = `UART test failed: ${(e as Error).message || e}`;
	} finally {
		uartTestRunning.value = false;
	}
}
</script>
