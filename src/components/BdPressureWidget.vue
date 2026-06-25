<template>
	<div class="bdw-root fill-height d-flex flex-column pa-2">
		<!-- Update notice (also surfaced in Flexible Layouts' unified popup via the shared hub) -->
		<v-alert v-if="pendingReload" type="success" density="compact" variant="tonal" class="mb-2">
			Update installed — reload DWC to finish.
			<template #append><v-btn size="small" variant="tonal" @click="reloadPage">Reload</v-btn></template>
		</v-alert>
		<v-alert v-else-if="updateState?.updateAvailable" type="info" density="compact" variant="tonal" class="mb-2">
			v{{ updateState.latestVersion }} available
			<template #append>
				<v-btn size="small" color="primary" variant="flat" :loading="applying" @click="applyUpdateNow">Update</v-btn>
				<v-btn size="small" variant="text" @click="dismissCurrentUpdate">Dismiss</v-btn>
			</template>
		</v-alert>

		<!-- Header -->
		<div class="d-flex align-center mb-2">
			<v-icon size="small" class="mr-2">mdi-chart-line</v-icon>
			<span class="text-subtitle-2">PA Calibration</span>
			<v-spacer />
			<v-chip v-if="sourceLabel && !isRunning" size="x-small" variant="tonal">{{ sourceLabel }}</v-chip>
			<v-btn icon="mdi-refresh" variant="text" size="x-small" :loading="loading" title="Reload latest log" @click="loadLatest" />
		</div>

		<!-- Live sweep in progress -->
		<v-alert v-if="isRunning" type="info" density="compact" variant="tonal" class="mb-2">
			<div class="d-flex align-center">
				<v-progress-circular indeterminate size="18" width="2" class="mr-2" />
				<span>Calibrating… {{ liveProgress }}</span>
			</div>
		</v-alert>

		<!-- No data -->
		<div v-else-if="!best && !loading" class="flex-grow-1 d-flex flex-column align-center justify-center text-medium-emphasis">
			<v-icon size="32" class="mb-1">mdi-tune-variant</v-icon>
			<div class="text-caption text-center">{{ errorMsg || "No calibration log yet — run one from the full page." }}</div>
		</div>

		<!-- Result -->
		<template v-else-if="best">
			<div class="d-flex align-baseline mb-1">
				<span class="text-caption text-medium-emphasis mr-2">Best PA</span>
				<span class="text-h5 font-weight-medium">{{ best.pa.toFixed(dp) }}</span>
				<v-spacer />
				<v-btn size="x-small" variant="tonal" prepend-icon="mdi-content-copy" @click="copyM572">M572</v-btn>
			</div>
			<div class="bdw-chart flex-grow-1"><canvas ref="chartCanvas" /></div>
			<div v-if="analysisItems.length" class="mt-1">
				<div v-for="(it, i) in analysisItems" :key="i" class="d-flex align-center text-caption">
					<v-icon :color="it.color" size="x-small" class="mr-1">{{ it.icon }}</v-icon>
					<span class="text-truncate">{{ it.text }}</span>
				</div>
			</div>
		</template>

		<v-btn class="mt-2" size="small" variant="tonal" block prepend-icon="mdi-open-in-app" @click="openFullPage">
			Open PA Calibration
		</v-btn>
	</div>
</template>

<script setup lang="ts">
import { computed, nextTick, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";

import { Chart, registerables } from "chart.js";

import { useMachineStore } from "@/stores/machine";
import { LogLevel, useUiStore } from "@/stores/ui";

import { LOG_DIR, STATUS_PATH, ROUTE_PATH, POLL_INTERVAL_MS } from "../model/constants";
import { parseCSV, parseStatus, type LogRow, type LogMeta } from "../model/parse";
import { analyseData, buildChartData, findBest, paDecimalsFor, type AnalysisItem } from "../model/analysis";
import { buildM572 } from "../model/gcode";
import { applying, applyUpdateNow, dismissCurrentUpdate, pendingReload, updateState } from "../model/updateCheck";

/* eslint-disable @typescript-eslint/no-explicit-any */

Chart.register(...registerables);

const machineStore = useMachineStore();
const uiStore = useUiStore();
const router = useRouter();

const rows = ref<LogRow[]>([]);
const meta = ref<LogMeta>({} as LogMeta);
const sourceLabel = ref("");
const errorMsg = ref("");
const loading = ref(false);
const live = ref<ReturnType<typeof parseStatus>>({});

const best = computed(() => findBest(rows.value));
const dp = computed(() => paDecimalsFor(rows.value));
const isRunning = computed(() => live.value.state === "running");
const liveProgress = computed(() => {
	const s = live.value as { iter?: number; total?: number; pa?: number };
	if (s.iter != null && s.total != null) return `pass ${s.iter} / ${s.total}`;
	if (s.pa != null) return `PA ${s.pa}`;
	return "in progress";
});
const analysisItems = computed<AnalysisItem[]>(() => {
	if (!best.value) return [];
	return analyseData(rows.value, best.value, meta.value, dp.value, null).items.slice(0, 3);
});

function download(path: string): Promise<string> {
	return (machineStore as any).download({ filename: path, type: "text" }, false, false, false) as Promise<string>;
}
function getList(dir: string): Promise<Array<{ isDirectory: boolean; name: string; lastModified?: string | Date }>> {
	return (machineStore as any).getFileList(dir);
}

let chart: Chart | null = null;
const chartCanvas = ref<HTMLCanvasElement | null>(null);

function drawChart(): void {
	if (!chartCanvas.value || !rows.value.length) return;
	const d = buildChartData(rows.value, dp.value);
	const bestLabel = best.value ? best.value.pa.toFixed(dp.value) : "";
	const pointColors = d.pa.map((p) => (p === bestLabel ? "#e53935" : "rgba(25,118,210,0.6)"));
	if (chart) {
		chart.data.labels = d.pa;
		chart.data.datasets[0].data = d.res;
		(chart.data.datasets[0] as any).pointBackgroundColor = pointColors;
		chart.update("none");
		return;
	}
	chart = new Chart(chartCanvas.value, {
		type: "line",
		data: {
			labels: d.pa,
			datasets: [{
				label: "Pressure score",
				data: d.res,
				borderColor: "#1976d2",
				borderWidth: 1.5,
				pointRadius: 2,
				pointBackgroundColor: pointColors,
				tension: 0.25,
				fill: false,
			}],
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			animation: false,
			plugins: { legend: { display: false }, tooltip: { enabled: true } },
			scales: {
				x: { ticks: { color: "#888", maxTicksLimit: 6, font: { size: 9 } }, grid: { display: false } },
				y: { ticks: { color: "#888", font: { size: 9 } }, grid: { color: "rgba(128,128,128,0.15)" } },
			},
		},
	});
}

async function loadLatest(): Promise<void> {
	if (loading.value) return;
	loading.value = true;
	errorMsg.value = "";
	try {
		const files = (await getList(LOG_DIR))
			.filter((f) => !f.isDirectory && f.name.endsWith(".csv"))
			.sort((a, b) => new Date(b.lastModified ?? 0).getTime() - new Date(a.lastModified ?? 0).getTime());
		if (!files.length) { rows.value = []; sourceLabel.value = ""; return; }
		const newest = files[0];
		const result = parseCSV(await download(`${LOG_DIR}/${newest.name}`));
		if (result.error) { errorMsg.value = result.error; rows.value = []; return; }
		rows.value = result.rows;
		meta.value = result.meta;
		const date = newest.lastModified ? new Date(newest.lastModified) : null;
		sourceLabel.value = date
			? `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
			: newest.name;
		await nextTick();
		drawChart();
	} catch (_) {
		errorMsg.value = "No calibration logs found yet.";
		rows.value = [];
	} finally {
		loading.value = false;
	}
}

async function pollStatus(): Promise<void> {
	try { live.value = parseStatus(await download(STATUS_PATH)); } catch { live.value = {}; }
}

const logExtruderIndex = computed(() => {
	const e = parseInt(meta.value.extruder ?? "");
	return isNaN(e) ? 0 : e;
});
function copyM572(): void {
	if (!best.value) return;
	const cmd = buildM572(logExtruderIndex.value, best.value.pa, dp.value);
	navigator.clipboard?.writeText(cmd).then(
		() => uiStore.makeNotification(LogLevel.success, "PA Calibration", `Copied: ${cmd}`),
		() => uiStore.makeNotification(LogLevel.warning, "PA Calibration", "Couldn't access the clipboard."),
	);
}

function openFullPage(): void { void router.push(ROUTE_PATH); }
function reloadPage(): void { window.location.reload(); }

let pollTimer: ReturnType<typeof setInterval> | null = null;
function startPolling(): void { if (!pollTimer) { void pollStatus(); pollTimer = setInterval(pollStatus, POLL_INTERVAL_MS); } }
function stopPolling(): void { if (pollTimer) { clearInterval(pollTimer); pollTimer = null; } }

// When a live sweep finishes, refresh to show its result.
let wasRunning = false;
function onStatusTick(): void {
	const running = isRunning.value;
	if (wasRunning && !running) void loadLatest();
	wasRunning = running;
}

onMounted(() => { void loadLatest(); startPolling(); });
onActivated(() => { void loadLatest(); startPolling(); });
onDeactivated(stopPolling);
onBeforeUnmount(() => { stopPolling(); chart?.destroy(); chart = null; });

// react to live → idle transitions (refresh the result when a sweep finishes)
watch(isRunning, onStatusTick);
</script>

<style scoped>
.bdw-root { min-height: 0; }
.bdw-chart { position: relative; min-height: 90px; }
.bdw-chart canvas { position: absolute; inset: 0; }
</style>
