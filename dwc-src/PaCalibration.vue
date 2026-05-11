<style scoped>
.drop-zone {
	border: 2px dashed #aaa;
	border-radius: 8px;
	padding: 32px;
	text-align: center;
	cursor: pointer;
	transition: border-color 0.2s, background 0.2s;
}
.drop-zone.drag-over {
	border-color: #1976d2;
	background: rgba(25, 118, 210, 0.06);
}
.best-badge {
	font-size: 1.1em;
	font-weight: bold;
}
.metric-table td, .metric-table th {
	padding: 2px 10px;
	font-size: 0.92em;
}
.meta-chip {
	margin: 2px 4px 2px 0;
}
canvas {
	max-width: 100%;
}
.analysis-item {
	display: flex;
	align-items: flex-start;
	margin-bottom: 8px;
	gap: 8px;
}
.analysis-item .v-icon {
	margin-top: 1px;
	flex-shrink: 0;
}
.next-sweep-code {
	font-family: monospace;
	font-size: 0.88em;
	background: rgba(255,255,255,0.06);
	border-radius: 4px;
	padding: 8px 12px;
	white-space: pre;
	display: block;
	margin-top: 4px;
}
.params-panel {
	border-right: 1px solid rgba(128,128,128,0.2);
	padding-right: 12px;
}
.param-section-title {
	font-size: 0.75em;
	text-transform: uppercase;
	letter-spacing: 0.08em;
	opacity: 0.6;
	margin: 12px 0 4px;
}
.status-state {
	font-size: 0.85em;
	opacity: 0.8;
}
</style>

<template>
	<v-row no-gutters>

		<!-- ================================================================
		     LEFT PANEL — parameters
		     ================================================================ -->
		<v-col v-show="activeTab === 0" cols="12" md="2" class="params-panel pa-3">
			<div class="subtitle-2 mb-2">
				<v-icon small left>mdi-tune</v-icon>Parameters
			</div>

			<div class="param-section-title">Tool</div>
			<v-text-field v-model.number="params.tool"        dense outlined hide-details label="Tool #"     type="number" min="0"   class="mb-2" :disabled="isRunning" />
			<v-text-field v-model.number="params.extruder"    dense outlined hide-details label="Extruder #" type="number" min="0"   class="mb-2" :disabled="isRunning" />

			<div class="param-section-title">Temperature</div>
			<v-text-field v-model.number="params.nozzle_temp" dense outlined hide-details label="Nozzle"     type="number" min="150" max="350" class="mb-2" :disabled="isRunning" suffix="°C" />

			<div class="param-section-title">PA sweep</div>
			<v-text-field v-model.number="params.pa_start"    dense outlined hide-details label="PA start"   type="number" min="0"   step="0.001"  class="mb-2" :disabled="isRunning" />
			<v-text-field v-model.number="params.pa_step"     dense outlined hide-details label="PA step"    type="number" min="0.0005" step="0.0005" class="mb-2" :disabled="isRunning" />
			<v-text-field v-model.number="params.steps"       dense outlined hide-details label="Steps"      type="number" min="5"   max="200" class="mb-2" :disabled="isRunning" />
			<div class="caption mb-3" style="opacity:0.6">
				Range: {{ params.pa_start.toFixed(4) }} – {{ paEnd.toFixed(4) }}
			</div>

			<div class="param-section-title">Speeds (mm/min)</div>
			<v-text-field v-model.number="params.low_speed"    dense outlined hide-details label="Slow"   type="number" min="100" class="mb-2" :disabled="isRunning" />
			<v-text-field v-model.number="params.high_speed"   dense outlined hide-details label="Fast"   type="number" min="100" class="mb-2" :disabled="isRunning" />
			<v-text-field v-model.number="params.travel_speed" dense outlined hide-details label="Travel" type="number" min="100" class="mb-2" :disabled="isRunning" />

			<div class="param-section-title">Z height</div>
			<v-text-field v-model.number="params.z_height"    dense outlined hide-details label="Z"       type="number" min="5"   class="mb-3" :disabled="isRunning" suffix="mm" />

			<v-divider class="mb-3" />

			<v-btn block color="success" :disabled="isRunning" @click="startCalibration" class="mb-2">
				<v-icon left small>mdi-play</v-icon>Start
			</v-btn>
			<v-btn block color="error" :disabled="!isRunning" @click="stopCalibration" outlined>
				<v-icon left small>mdi-stop</v-icon>Abort
			</v-btn>

			<!-- Live status -->
			<div v-if="liveStatus.state" class="mt-3">
				<v-progress-linear
					:value="liveProgress"
					:color="liveStatus.state === 'done' ? 'success' : 'primary'"
					height="6" rounded class="mb-1"
				/>
				<div class="status-state">
					<span v-if="liveStatus.state === 'starting'">Starting…</span>
					<span v-else-if="liveStatus.state === 'heating'">Heating nozzle…</span>
					<span v-else-if="liveStatus.state === 'priming'">Priming…</span>
					<span v-else-if="liveStatus.state === 'running'">
						Step {{ liveStatus.step }} / {{ liveStatus.steps }}<br>
						<span style="opacity:0.7">PA {{ (liveStatus.pa || 0).toFixed(4) }}</span>
					</span>
					<span v-else-if="liveStatus.state === 'done'">
						<v-icon small color="success">mdi-check-circle</v-icon>
						Done — best PA {{ (liveStatus.best_pa || 0).toFixed(4) }}
					</span>
					<span v-else-if="liveStatus.state === 'aborted'">
						<v-icon small color="warning">mdi-alert</v-icon> Aborted
					</span>
				</div>
			</div>
		</v-col>

		<!-- ================================================================
		     RIGHT PANEL — tabs
		     ================================================================ -->
		<v-col cols="12" md="10" class="pa-3">
			<v-card flat>
				<v-card-title class="pb-1 pt-0">
					<v-icon class="mr-2">mdi-chart-line</v-icon>
					bd_pressure — PA Calibration
					<v-chip x-small class="ml-2" color="blue-grey darken-3" text-color="white">v1.0.0</v-chip>
					<v-spacer />
					<v-btn small text @click="loadFromDuet" :loading="fetching" :disabled="fetching || isRunning">
						<v-icon left small>mdi-download</v-icon>Load log from Duet
					</v-btn>
				</v-card-title>

				<v-tabs v-model="activeTab" dense class="mb-2">
					<v-tab>
						<v-icon left small>mdi-chart-line-variant</v-icon>Live Run
						<v-badge v-if="isRunning" color="success" dot inline class="ml-1" />
					</v-tab>
					<v-tab>
						<v-icon left small>mdi-file-chart</v-icon>Log Viewer
					</v-tab>
				</v-tabs>

				<v-tabs-items v-model="activeTab">

					<!-- ============================================================
					     TAB 0 — LIVE RUN
					     ============================================================ -->
					<v-tab-item>
						<v-card-text class="pt-1">
							<v-alert v-if="error" type="error" dense dismissible @input="error=''" class="mb-2">{{ error }}</v-alert>

							<div v-if="!isRunning && !liveRows.length && liveStatus.state !== 'done'" class="text-center py-8 grey--text">
								<v-icon x-large color="grey">mdi-play-circle-outline</v-icon>
								<div class="mt-2">Set parameters and press <strong>Start</strong> to begin a live calibration run.</div>
							</div>

							<v-alert v-if="liveBest" type="success" dense class="mb-2">
								<span class="best-badge">Best PA so far = {{ liveBest.pa.toFixed(4) }}</span>
								&nbsp;—&nbsp; res={{ liveBest.res }}
								<v-btn v-if="liveStatus.state === 'done'" small outlined class="ml-3" color="white" @click="copyLiveM572">
									<v-icon left small>mdi-content-copy</v-icon>
									Copy M572 D{{ params.extruder }} S{{ liveBest.pa.toFixed(4) }}
								</v-btn>
							</v-alert>
							<v-snackbar v-model="copiedLive" timeout="2000" color="success" top>M572 command copied</v-snackbar>

							<template v-if="liveRows.length">
								<v-row dense>
									<v-col cols="12"><canvas ref="liveChartRes"    height="200"></canvas></v-col>
									<v-col cols="12"><canvas ref="liveChartSlopes" height="160"></canvas></v-col>
									<v-col cols="12"><canvas ref="liveChartH"      height="160"></canvas></v-col>
								</v-row>
							</template>
						</v-card-text>
					</v-tab-item>

					<!-- ============================================================
					     TAB 1 — LOG VIEWER
					     ============================================================ -->
					<v-tab-item>
						<v-card-text class="pt-1">
							<div v-if="!rows.length"
								class="drop-zone"
								:class="{ 'drag-over': dragging }"
								@click="$refs.fileInput.click()"
								@dragover.prevent="dragging = true"
								@dragleave="dragging = false"
								@drop.prevent="onFileDrop">
								<v-icon x-large color="grey">mdi-file-upload-outline</v-icon>
								<div class="mt-2 grey--text">
									Drop <strong>pa_calibrate_log.txt</strong> here, click to browse,<br>
									or use <strong>Load log from Duet</strong> above.
								</div>
							</div>
							<input ref="fileInput" type="file" accept=".txt,.csv" style="display:none" @change="onFileSelect" />

							<v-alert v-if="logError" type="error" dense dismissible @input="logError=''" class="mt-2">{{ logError }}</v-alert>

							<template v-if="rows.length">
								<div v-if="hasMetadata" class="mb-3">
									<v-chip v-if="meta.date"        small class="meta-chip" color="blue-grey darken-2" text-color="white"><v-icon left x-small>mdi-calendar</v-icon>{{ meta.date }}</v-chip>
									<v-chip v-if="meta.rrf_version" small class="meta-chip" color="blue-grey darken-2" text-color="white"><v-icon left x-small>mdi-chip</v-icon>RRF: {{ meta.rrf_version }}</v-chip>
									<v-chip v-if="meta.bd_version"  small class="meta-chip" color="blue-grey darken-2" text-color="white"><v-icon left x-small>mdi-memory</v-icon>{{ meta.bd_version }}</v-chip>
									<v-chip v-if="meta.mode"        small class="meta-chip" :color="meta.mode === 'pa' ? 'teal darken-2' : 'deep-purple darken-2'" text-color="white"><v-icon left x-small>mdi-sine-wave</v-icon>mode: {{ meta.mode }}</v-chip>
									<v-chip v-if="meta.nozzle_temp" small class="meta-chip" color="orange darken-3" text-color="white"><v-icon left x-small>mdi-thermometer</v-icon>{{ meta.nozzle_temp }}°C</v-chip>
									<v-chip v-if="meta.pa_start && meta.pa_step && meta.steps" small class="meta-chip" color="blue-grey darken-2" text-color="white">
										<v-icon left x-small>mdi-ray-start-arrow</v-icon>PA {{ meta.pa_start }} + {{ meta.pa_step }} × {{ meta.steps }}
									</v-chip>
								</div>

								<v-alert type="success" dense class="mb-3" v-if="best">
									<span class="best-badge">Best PA = {{ best.pa.toFixed(4) }}</span>
									&nbsp;—&nbsp; res={{ best.res }}&nbsp; lk={{ best.lk }}&nbsp; rk={{ best.rk }}&nbsp; Hk={{ best.Hk }}&nbsp; Ha={{ best.Ha }}
									<v-btn small outlined class="ml-3" color="white" @click="copyM572">
										<v-icon left small>mdi-content-copy</v-icon>
										Copy M572 D{{ logExtruderIndex }} S{{ best.pa.toFixed(4) }}
									</v-btn>
								</v-alert>
								<v-snackbar v-model="copied" timeout="2000" color="success" top>M572 command copied to clipboard</v-snackbar>

								<v-row dense>
									<v-col cols="12"><canvas ref="chartRes"    height="200"></canvas></v-col>
									<v-col cols="12"><canvas ref="chartSlopes" height="160"></canvas></v-col>
									<v-col cols="12"><canvas ref="chartH"      height="160"></canvas></v-col>
								</v-row>

								<v-card outlined class="mt-4" v-if="analysis.items.length">
									<v-card-title class="subtitle-1 pb-1">
										<v-icon left small>mdi-lightbulb-outline</v-icon>Analysis
									</v-card-title>
									<v-card-text class="pt-0">
										<div v-for="(item, i) in analysis.items" :key="i" class="analysis-item">
											<v-icon small :color="item.color">{{ item.icon }}</v-icon>
											<span>{{ item.text }}</span>
										</div>
										<template v-if="analysis.nextSweep">
											<v-divider class="my-3" />
											<div class="subtitle-2 mb-1"><v-icon small left>mdi-magnify-plus-outline</v-icon>Suggested next sweep</div>
											<div class="body-2 mb-2">{{ analysis.nextSweep.reason }}</div>
											<code class="next-sweep-code">{{ analysis.nextSweep.code }}</code>
											<v-btn small text class="mt-2" @click="copyNextSweep"><v-icon left small>mdi-content-copy</v-icon>Copy</v-btn>
											<v-btn small outlined class="mt-2 ml-1" color="primary" @click="applyNextSweep"><v-icon left small>mdi-play-circle-outline</v-icon>Load into Live Run</v-btn>
											<v-snackbar v-model="copiedSweep" timeout="2000" color="success" top>Next sweep parameters copied</v-snackbar>
										</template>
									</v-card-text>
								</v-card>

								<v-expansion-panels flat class="mt-2">
									<v-expansion-panel>
										<v-expansion-panel-header>Raw data ({{ rows.length }} iterations)</v-expansion-panel-header>
										<v-expansion-panel-content>
											<v-simple-table dense class="metric-table">
												<thead><tr><th>iter</th><th>PA</th><th>res</th><th>lk</th><th>rk</th><th>Hk</th><th>Ha</th></tr></thead>
												<tbody>
													<tr v-for="r in rows" :key="r.iter" :class="best && r.iter === best.iter ? 'green lighten-4' : ''">
														<td>{{ r.iter }}</td><td>{{ r.pa.toFixed(4) }}</td><td>{{ r.res }}</td>
														<td>{{ r.lk }}</td><td>{{ r.rk }}</td><td>{{ r.Hk }}</td><td>{{ r.Ha }}</td>
													</tr>
												</tbody>
											</v-simple-table>
										</v-expansion-panel-content>
									</v-expansion-panel>
								</v-expansion-panels>

								<div class="mt-2 text-right">
									<v-btn small text @click="clearData"><v-icon left small>mdi-close</v-icon>Clear</v-btn>
								</div>
							</template>
						</v-card-text>
					</v-tab-item>

				</v-tabs-items>
			</v-card>
		</v-col>
	</v-row>
</template>

<script>
import Chart from 'chart.js'
import { mapState } from 'vuex'

const LOG_PATH        = '0:/sys/pa_calibrate_log.txt'
const STATUS_PATH     = '0:/sys/pa_live_status.json'
const WARM_UP_SKIP    = 5
const POLL_INTERVAL_MS = 2000

export default {
	name: 'PaCalibration',

	data() {
		return {
			activeTab: 0,

			params: {
				tool:         0,
				extruder:     0,
				nozzle_temp:  210,
				pa_start:     0.0,
				pa_step:      0.002,
				steps:        50,
				low_speed:    1020,
				high_speed:   10740,
				travel_speed: 18000,
				z_height:     50,
			},

			// live run
			isRunning:    false,
			liveRows:     [],
			liveStatus:   {},
			pollTimer:    null,
			copiedLive:   false,
			liveChartRes:    null,
			liveChartSlopes: null,
			liveChartH:      null,

			// log viewer
			rows:     [],
			meta:     {},
			best:     null,
			analysis: { items: [], nextSweep: null },
			logError: '',
			fetching: false,
			dragging: false,
			copied:      false,
			copiedSweep: false,
			chartRes:    null,
			chartSlopes: null,
			chartH:      null,

			error: '',
		}
	},

	computed: {
		paEnd() {
			return this.params.pa_start + (this.params.steps - 1) * this.params.pa_step
		},
		liveProgress() {
			if (!this.liveStatus.steps) return 0
			if (this.liveStatus.state === 'heating' || this.liveStatus.state === 'priming') return 2
			if (this.liveStatus.state === 'done') return 100
			return Math.round((this.liveStatus.step / this.liveStatus.steps) * 100)
		},
		liveBest() {
			const active = this.liveRows.filter(r => r.iter >= WARM_UP_SKIP && r.res > 0)
			if (!active.length) return null
			return active.reduce((a, b) => b.res < a.res ? b : a)
		},
		hasMetadata() {
			return Object.keys(this.meta).length > 0
		},
		logExtruderIndex() {
			const e = parseInt(this.meta.extruder)
			return isNaN(e) ? 0 : e
		},
		...mapState('settings', ['darkTheme']),
	},

	watch: {
		darkTheme(dark) { this.applyTheme(dark) },
	},

	beforeDestroy() {
		this.stopPolling()
		this.destroyAllCharts()
	},

	methods: {

		// ------------------------------------------------------------------ live run

		async startCalibration() {
			this.error = ''
			this.liveRows = []
			this.liveStatus = {}
			this.destroyLiveCharts()
			this.activeTab = 0
			this.isRunning = true

			try {
				const p = this.params
				// Set globals — if they already exist use set, otherwise create with global
				// Using M98 with inline assignment is not supported, so we use a helper macro approach:
				// Send each as a GCode expression. RRF accepts `set global.x = v` if the var exists,
				// or `global x = v` to create it. We always try set first, fall back to create.
				// bd_globals.g declares all bd_live_* variables at boot, so `set` always works.
				await this.sendGCode(`set global.bd_live_tool = ${p.tool}`)
				await this.sendGCode(`set global.bd_live_extruder = ${p.extruder}`)
				await this.sendGCode(`set global.bd_live_nozzle_temp = ${p.nozzle_temp}`)
				await this.sendGCode(`set global.bd_live_pa_start = ${p.pa_start}`)
				await this.sendGCode(`set global.bd_live_pa_step = ${p.pa_step}`)
				await this.sendGCode(`set global.bd_live_steps = ${p.steps}`)
				await this.sendGCode(`set global.bd_live_low_speed = ${p.low_speed}`)
				await this.sendGCode(`set global.bd_live_high_speed = ${p.high_speed}`)
				await this.sendGCode(`set global.bd_live_travel_speed = ${p.travel_speed}`)
				await this.sendGCode(`set global.bd_live_z_height = ${p.z_height}`)

				// Clear any stale status file so polling can't mistake a previous run as done
				await this.sendGCode('echo >"0:/sys/pa_live_status.json" "{\\"state\\":\\"starting\\"}"')

				// Fire calibration macro — it runs asynchronously on the Duet
				await this.sendGCode('M98 P"0:/sys/pa_calibrate_live.g"')
				this.startPolling()
			} catch (e) {
				this.error = `Failed to start: ${e.message || e}`
				this.isRunning = false
			}
		},

		async stopCalibration() {
			try { await this.sendGCode('M108') } catch (_) {}
			this.stopPolling()
			this.isRunning = false
			this.liveStatus = { ...this.liveStatus, state: 'aborted' }
		},

		startPolling() {
			this.pollTimer = setInterval(() => this.pollStatus(), POLL_INTERVAL_MS)
		},

		stopPolling() {
			if (this.pollTimer) { clearInterval(this.pollTimer); this.pollTimer = null }
		},

		async pollStatus() {
			try {
				const text = await this.downloadFile(STATUS_PATH)
				const status = JSON.parse(text)
				this.liveStatus = status
				if (status.state === 'done') {
					this.stopPolling()
					this.isRunning = false
					await this.pollLog()
					setTimeout(async () => {
						await this.loadFromDuet()
						this.activeTab = 1
					}, 1500)
					return
				}
			} catch (_) {}
			// Only read the log once the macro is actively printing data rows
			if (this.liveStatus.state === 'running' || this.liveStatus.state === 'done') {
				await this.pollLog()
			}
		},

		async pollLog() {
			try {
				const text = await this.downloadFile(LOG_PATH)
				const newRows = this.parseLogRows(text)
				if (newRows.length > this.liveRows.length) {
					this.liveRows = newRows
					this.$nextTick(() => this.updateLiveCharts())
				}
			} catch (_) {}
		},

		parseLogRows(text) {
			const rows = []
			const lines = text.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'))
			if (!lines.length) return rows
			const header = lines[0].split(',').map(h => h.trim())
			for (let i = 1; i < lines.length; i++) {
				const parts = lines[i].split(',')
				if (parts.length < 7) continue
				try {
					rows.push({
						iter: parseInt(parts[header.indexOf('iter')]),
						pa:   parseFloat(parts[header.indexOf('pa')]),
						res:  parseInt(parts[header.indexOf('res')]),
						lk:   parseInt(parts[header.indexOf('lk')]),
						rk:   parseInt(parts[header.indexOf('rk')]),
						Hk:   parseInt(parts[header.indexOf('Hk')]),
						Ha:   parseInt(parts[header.indexOf('Ha')]),
					})
				} catch (_) {}
			}
			return rows
		},

		copyLiveM572() {
			if (!this.liveBest) return
			navigator.clipboard.writeText(`M572 D${this.params.extruder} S${this.liveBest.pa.toFixed(4)}`)
				.then(() => { this.copiedLive = true })
		},

		// ------------------------------------------------------------------ helpers

		sendGCode(cmd) {
			return this.$store.dispatch('machine/sendCode', { code: cmd, noWait: false })
		},

		downloadFile(path) {
			return this.$store.dispatch('machine/download', {
				filename: path, type: 'text',
				showProgress: false, showSuccess: false, showError: false,
			})
		},

		// ------------------------------------------------------------------ log viewer

		onFileSelect(e) {
			const file = e.target.files[0]
			if (file) this.readFile(file)
			e.target.value = ''
		},
		onFileDrop(e) {
			this.dragging = false
			const file = e.dataTransfer.files[0]
			if (file) this.readFile(file)
		},
		readFile(file) {
			const reader = new FileReader()
			reader.onload = (e) => this.parseCSV(e.target.result)
			reader.onerror = () => { this.logError = 'Failed to read file' }
			reader.readAsText(file)
		},
		async loadFromDuet() {
			this.fetching = true
			this.logError = ''
			try {
				const text = await this.downloadFile(LOG_PATH)
				this.parseCSV(text)
				this.activeTab = 1
			} catch (e) {
				this.logError = `Could not fetch log — run a calibration first. (${e.message || e})`
			} finally {
				this.fetching = false
			}
		},

		parseCSV(text) {
			this.logError = ''
			const meta = {}
			const dataLines = []
			for (const raw of text.split('\n')) {
				const line = raw.trim()
				if (!line) continue
				if (line.startsWith('#')) {
					const content = line.replace(/^#+\s*/, '')
					if (content.includes('=')) {
						for (const [, k, v] of content.matchAll(/(\w+)=([^\s]+)/g)) meta[k] = v
					}
					continue
				}
				dataLines.push(line)
			}
			if (!dataLines.length) { this.logError = 'File is empty'; return }
			const header = dataLines[0].split(',').map(h => h.trim())
			const parsed = []
			for (let i = 1; i < dataLines.length; i++) {
				const parts = dataLines[i].split(',')
				if (parts.length < 7) continue
				try {
					parsed.push({
						iter: parseInt(parts[header.indexOf('iter')]),
						pa:   parseFloat(parts[header.indexOf('pa')]),
						res:  parseInt(parts[header.indexOf('res')]),
						lk:   parseInt(parts[header.indexOf('lk')]),
						rk:   parseInt(parts[header.indexOf('rk')]),
						Hk:   parseInt(parts[header.indexOf('Hk')]),
						Ha:   parseInt(parts[header.indexOf('Ha')]),
					})
				} catch (_) {}
			}
			if (!parsed.length) { this.logError = 'No valid data rows found'; return }
			this.meta = meta
			this.rows = parsed
			this.best = this.findBest(parsed)
			this.analysis = this.analyseData(parsed, this.best, meta)
			this.$nextTick(() => this.drawLogCharts())
		},

		findBest(rows) {
			const candidates = rows.filter(r => r.iter >= WARM_UP_SKIP && r.res > 0)
			if (!candidates.length) return null
			return candidates.reduce((a, b) => b.res < a.res ? b : a)
		},

		analyseData(rows, best, meta) {
			const items = []
			const active = rows.filter(r => r.iter >= WARM_UP_SKIP && r.res > 0)
			if (!active.length || !best) return { items, nextSweep: null }
			const resVals  = active.map(r => r.res)
			const paVals   = active.map(r => r.pa)
			const n        = active.length
			const mean     = resVals.reduce((a, b) => a + b, 0) / n
			const variance = resVals.reduce((s, v) => s + (v - mean) ** 2, 0) / n
			const cvPct    = mean > 0 ? (Math.sqrt(variance) / mean) * 100 : 0
			const paMin    = paVals[0], paMax = paVals[paVals.length - 1], paRange = paMax - paMin
			const step     = meta.pa_step ? parseFloat(meta.pa_step) : null
			const bestIdx  = active.findIndex(r => r.iter === best.iter)
			const edgeFrac = paRange > 0 ? Math.min((best.pa - paMin) / paRange, (paMax - best.pa) / paRange) : 0.5

			if (cvPct > 40)      items.push({ icon: 'mdi-alert-outline',        color: 'orange', text: `High variability in res scores (CV ${cvPct.toFixed(0)}%). Consider a second run.` })
			else if (cvPct > 20) items.push({ icon: 'mdi-information-outline',  color: 'yellow', text: `Moderate variability (CV ${cvPct.toFixed(0)}%). A second run would improve confidence.` })
			else                 items.push({ icon: 'mdi-check-circle-outline', color: 'green',  text: `Low variability (CV ${cvPct.toFixed(0)}%) — sweep conditions were consistent.` })

			if (edgeFrac < 0.15) {
				const dir = best.pa - paMin < paMax - best.pa ? 'lower' : 'higher'
				items.push({ icon: 'mdi-alert-circle-outline', color: 'orange', text: `Best PA (${best.pa.toFixed(4)}) is near the sweep edge — true optimum may be ${dir}. Shift the range.` })
			} else if (edgeFrac < 0.25) {
				items.push({ icon: 'mdi-information-outline', color: 'yellow', text: `Best PA (${best.pa.toFixed(4)}) is close to one edge — consider a follow-up centred on this value.` })
			} else {
				items.push({ icon: 'mdi-check-circle-outline', color: 'green', text: `Best PA (${best.pa.toFixed(4)}) is well within the sweep range.` })
			}

			const win = Math.max(2, Math.round(n * 0.12))
			const nearMean = active.slice(Math.max(0, bestIdx - win), Math.min(active.length - 1, bestIdx + win) + 1).reduce((s, r) => s + r.res, 0) / (win * 2 + 1)
			if (best.res > 0 && (nearMean - best.res) / best.res < 0.15)
				items.push({ icon: 'mdi-information-outline', color: 'yellow', text: `The res curve is flat near the minimum — a finer sweep will pinpoint the optimum.` })
			else
				items.push({ icon: 'mdi-check-circle-outline', color: 'green', text: `Clear minimum with good separation from surrounding values.` })

			const lkMean = active.reduce((s, r) => s + r.lk, 0) / n
			const rkMean = active.reduce((s, r) => s + r.rk, 0) / n
			if (lkMean > 0 && rkMean > 0) {
				if (Math.abs(lkMean - rkMean) / Math.max(lkMean, rkMean) > 0.4)
					items.push({ icon: 'mdi-swap-horizontal', color: 'orange', text: `Significant slope asymmetry (lk avg ${lkMean.toFixed(1)}, rk avg ${rkMean.toFixed(1)}) — may indicate a hotend temperature or flow asymmetry.` })
				else
					items.push({ icon: 'mdi-check-circle-outline', color: 'green', text: `Slopes are reasonably symmetric (lk avg ${lkMean.toFixed(1)}, rk avg ${rkMean.toFixed(1)}).` })
			}

			let nextSweep = null
			if (step !== null) {
				const fineStep  = parseFloat((step / 4).toPrecision(3))
				const fineStart = parseFloat(Math.max(0, best.pa - fineStep * 15).toPrecision(4))
				const fineEnd   = parseFloat((best.pa + fineStep * 15).toPrecision(4))
				const fineSteps = Math.round((fineEnd - fineStart) / fineStep)
				if (edgeFrac < 0.15) {
					const dir = best.pa - paMin < paMax - best.pa ? -1 : 1
					const ss  = parseFloat(Math.max(0, best.pa + dir * paRange * 0.4).toPrecision(4))
					const se  = parseFloat((ss + paRange).toPrecision(4))
					const sn  = Math.round(paRange / step)
					nextSweep = {
						reason: `Shift the sweep range to keep the minimum centred.`,
						code:   `var pa_start = ${ss}\nvar pa_step  = ${step}\nvar steps    = ${sn}  ; covers ${ss.toFixed(4)}–${se.toFixed(4)}`,
						params: { pa_start: ss, pa_step: step, steps: sn },
					}
				} else {
					nextSweep = {
						reason: `Zoom in around ${best.pa.toFixed(4)} with a finer step (${fineStep}).`,
						code:   `var pa_start = ${fineStart}\nvar pa_step  = ${fineStep}\nvar steps    = ${fineSteps}  ; covers ${fineStart.toFixed(4)}–${fineEnd.toFixed(4)}`,
						params: { pa_start: fineStart, pa_step: fineStep, steps: fineSteps },
					}
				}
			}
			return { items, nextSweep }
		},

		applyNextSweep() {
			if (!this.analysis.nextSweep) return
			const p = this.analysis.nextSweep.params
			this.params.pa_start = p.pa_start
			this.params.pa_step  = p.pa_step
			this.params.steps    = p.steps
			this.activeTab = 0
		},

		// ------------------------------------------------------------------ charts

		themeColors(dark) {
			return {
				fontColor:  dark ? '#fff' : '#444',
				gridColor:  dark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)',
				titleColor: dark ? '#fff' : '#222',
			}
		},

		applyTheme(dark) {
			const { fontColor, gridColor, titleColor } = this.themeColors(dark)
			const all = [this.chartRes, this.chartSlopes, this.chartH, this.liveChartRes, this.liveChartSlopes, this.liveChartH]
			all.forEach(chart => {
				if (!chart) return
				chart.options.legend.labels.fontColor = fontColor
				chart.options.title.fontColor = titleColor
				chart.options.scales.xAxes[0].ticks.fontColor = fontColor
				chart.options.scales.xAxes[0].gridLines.color = gridColor
				chart.options.scales.yAxes[0].ticks.fontColor = fontColor
				chart.options.scales.yAxes[0].gridLines.color = gridColor
				chart.update()
			})
		},

		commonOpts(title) {
			const { fontColor, gridColor, titleColor } = this.themeColors(this.darkTheme)
			return {
				responsive: true,
				maintainAspectRatio: false,
				animation: { duration: 0 },
				legend: {
					position: 'top',
					labels: { fontSize: 11, fontColor, boxWidth: 14 },
					onClick(e, legendItem) {
						const ci = this.chart
						const idx = legendItem.datasetIndex
						const meta = ci.getDatasetMeta(idx)
						meta.hidden = meta.hidden === null ? !ci.data.datasets[idx].hidden : null
						ci.update()
					}
				},
				title:  { display: true, text: title, fontSize: 12, fontColor: titleColor },
				scales: {
					xAxes: [{ ticks: { maxTicksLimit: 20, maxRotation: 45, fontSize: 10, fontColor }, gridLines: { color: gridColor } }],
					yAxes: [{ ticks: { fontSize: 10, fontColor }, gridLines: { color: gridColor } }],
				},
			}
		},

		makeOverlayHook(getBest, getGoodBounds, drawZone) {
			return (chart) => {
				const best = getBest()
				if (!best) return
				const ctx = chart.ctx
				const { top, bottom, left, right } = chart.chartArea
				const labels = chart.data.labels

				if (drawZone) {
					const bounds = getGoodBounds()
					if (bounds) {
						const { gs, ge } = bounds
						const idxL = labels.indexOf(gs.pa.toFixed(4))
						const idxR = labels.indexOf(ge.pa.toFixed(4))
						if (idxL >= 0 && idxR >= 0) {
							const m  = chart.getDatasetMeta(0)
							const xL = m.data[idxL] ? m.data[idxL]._model.x : left
							const xR = m.data[idxR] ? m.data[idxR]._model.x : right
							ctx.save()
							ctx.fillStyle = 'rgba(46,125,50,0.15)'
							ctx.fillRect(xL, top, xR - xL, bottom - top)
							ctx.restore()
						}
					}
				}

				const idx = labels.indexOf(best.pa.toFixed(4))
				if (idx < 0) return
				const m = chart.getDatasetMeta(0)
				if (!m.data[idx]) return
				const x = m.data[idx]._model.x
				ctx.save()
				ctx.beginPath()
				ctx.strokeStyle = 'rgba(211,47,47,0.9)'
				ctx.lineWidth = 2
				ctx.setLineDash([5, 3])
				ctx.moveTo(x, top)
				ctx.lineTo(x, bottom)
				ctx.stroke()
				ctx.setLineDash([])
				ctx.fillStyle = 'rgba(211,47,47,0.9)'
				ctx.font = 'bold 10px sans-serif'
				const rightHalf = x > (left + right) / 2
				ctx.textAlign = rightHalf ? 'right' : 'left'
				ctx.fillText(`best ${best.pa.toFixed(4)}`, rightHalf ? x - 4 : x + 4, top + 12)
				ctx.restore()
			}
		},

		patchOverlay(chart, hookFn) {
			const orig = chart.draw.bind(chart)
			chart.draw = function(ease) { orig(ease); hookFn(chart) }
			chart.update()
		},

		goodBoundsFor(rows, best) {
			if (!best) return null
			const threshold = best.res * 1.20
			const active    = rows.filter(r => r.iter >= WARM_UP_SKIP && r.res > 0)
			const gs = active.find(r => r.res <= threshold)
			const ge = [...active].reverse().find(r => r.res <= threshold)
			return gs && ge ? { gs, ge } : null
		},

		buildChartData(rows) {
			return {
				pa:  rows.map(r => r.pa.toFixed(4)),
				res: rows.map(r => r.res),
				lk:  rows.map(r => r.lk),
				rk:  rows.map(r => r.rk),
				Hk:  rows.map(r => r.Hk),
				Ha:  rows.map(r => r.Ha),
			}
		},

		createChartSet(refs, rows, best, titleSuffix) {
			const d = this.buildChartData(rows)
			const bounds = this.goodBoundsFor(rows, best)

			const overlayRes   = this.makeOverlayHook(() => best, () => bounds, true)
			const overlayOther = this.makeOverlayHook(() => best, () => null,   false)

			const cRes = new Chart(refs.res.getContext('2d'), {
				type: 'line',
				data: { labels: d.pa, datasets: [{ label: 'res (lower = better)', data: d.res, borderColor: '#1565C0', backgroundColor: 'rgba(21,101,192,0.08)', borderWidth: 1.5, pointRadius: 2, fill: true }] },
				options: this.commonOpts(`Pressure score (res)${titleSuffix}`),
			})
			this.patchOverlay(cRes, overlayRes)

			const cSlopes = new Chart(refs.slopes.getContext('2d'), {
				type: 'line',
				data: { labels: d.pa, datasets: [
					{ label: 'lk (left slope)',  data: d.lk, borderColor: '#2E7D32', backgroundColor: '#2E7D32', borderWidth: 1.5, pointRadius: 2, fill: false },
					{ label: 'rk (right slope)', data: d.rk, borderColor: '#7B1FA2', backgroundColor: '#7B1FA2', borderWidth: 1.5, pointRadius: 2, fill: false },
				]},
				options: this.commonOpts(`Slopes (lk / rk)${titleSuffix}`),
			})
			this.patchOverlay(cSlopes, overlayOther)

			const hOpts = this.commonOpts(`Signal quality (Hk / Ha)${titleSuffix}`)
			hOpts.scales.yAxes[0].ticks.min = 0
			hOpts.scales.yAxes[0].ticks.max = 255
			const cH = new Chart(refs.h.getContext('2d'), {
				type: 'line',
				data: { labels: d.pa, datasets: [
					{ label: 'Hk (left peak)',  data: d.Hk, borderColor: '#00838F', backgroundColor: '#00838F', borderWidth: 1.5, pointRadius: 2, fill: false },
					{ label: 'Ha (right peak)', data: d.Ha, borderColor: '#E65100', backgroundColor: '#E65100', borderWidth: 1.5, pointRadius: 2, fill: false },
				]},
				options: hOpts,
			})
			this.patchOverlay(cH, overlayOther)

			return { cRes, cSlopes, cH }
		},

		destroyLogCharts() {
			[this.chartRes, this.chartSlopes, this.chartH].forEach(c => { if (c) c.destroy() })
			this.chartRes = this.chartSlopes = this.chartH = null
		},

		drawLogCharts() {
			this.destroyLogCharts()
			const { cRes, cSlopes, cH } = this.createChartSet(
				{ res: this.$refs.chartRes, slopes: this.$refs.chartSlopes, h: this.$refs.chartH },
				this.rows, this.best, ''
			)
			this.chartRes = cRes; this.chartSlopes = cSlopes; this.chartH = cH
		},

		destroyLiveCharts() {
			[this.liveChartRes, this.liveChartSlopes, this.liveChartH].forEach(c => { if (c) c.destroy() })
			this.liveChartRes = this.liveChartSlopes = this.liveChartH = null
		},

		updateLiveCharts() {
			const rows = this.liveRows
			if (!rows.length) return
			const best = this.liveBest

			if (!this.liveChartRes) {
				const { cRes, cSlopes, cH } = this.createChartSet(
					{ res: this.$refs.liveChartRes, slopes: this.$refs.liveChartSlopes, h: this.$refs.liveChartH },
					rows, best, ' — live'
				)
				this.liveChartRes = cRes; this.liveChartSlopes = cSlopes; this.liveChartH = cH
			} else {
				const d = this.buildChartData(rows)
				const bounds = this.goodBoundsFor(rows, best)

				const overlayRes   = this.makeOverlayHook(() => this.liveBest, () => bounds, true)
				const overlayOther = this.makeOverlayHook(() => this.liveBest, () => null,   false)

				this.liveChartRes.data.labels = d.pa
				this.liveChartRes.data.datasets[0].data = d.res
				this.patchOverlay(this.liveChartRes, overlayRes)

				this.liveChartSlopes.data.labels = d.pa
				this.liveChartSlopes.data.datasets[0].data = d.lk
				this.liveChartSlopes.data.datasets[1].data = d.rk
				this.patchOverlay(this.liveChartSlopes, overlayOther)

				this.liveChartH.data.labels = d.pa
				this.liveChartH.data.datasets[0].data = d.Hk
				this.liveChartH.data.datasets[1].data = d.Ha
				this.patchOverlay(this.liveChartH, overlayOther)
			}
		},

		destroyAllCharts() {
			this.destroyLogCharts()
			this.destroyLiveCharts()
		},

		// ------------------------------------------------------------------ actions

		copyM572() {
			if (!this.best) return
			navigator.clipboard.writeText(`M572 D${this.logExtruderIndex} S${this.best.pa.toFixed(4)}`).then(() => { this.copied = true })
		},
		copyNextSweep() {
			if (!this.analysis.nextSweep) return
			navigator.clipboard.writeText(this.analysis.nextSweep.code).then(() => { this.copiedSweep = true })
		},
		copyLiveM572() {
			if (!this.liveBest) return
			navigator.clipboard.writeText(`M572 D${this.params.extruder} S${this.liveBest.pa.toFixed(4)}`).then(() => { this.copiedLive = true })
		},
		clearData() {
			this.destroyLogCharts()
			this.rows = []; this.meta = {}; this.best = null
			this.analysis = { items: [], nextSweep: null }; this.logError = ''
		},
	},
}
</script>
