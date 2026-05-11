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
</style>

<template>
	<v-row>
		<v-col>
			<v-card>
				<v-card-title class="pb-1">
					<v-icon class="mr-2">mdi-chart-line</v-icon>
					bd_pressure — PA Calibration Results
					<v-chip x-small class="ml-2" color="blue-grey darken-3" text-color="white">v1.0.0</v-chip>
					<v-spacer />
					<v-btn small text @click="loadFromDuet" :loading="fetching" :disabled="fetching">
						<v-icon left small>mdi-download</v-icon>
						Load from Duet
					</v-btn>
				</v-card-title>

				<v-card-text>
					<!-- File drop / pick zone (shown when no data loaded) -->
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
							or use <strong>Load from Duet</strong> to fetch automatically.
						</div>
					</div>
					<input ref="fileInput" type="file" accept=".txt,.csv" style="display:none" @change="onFileSelect" />

					<!-- Error banner -->
					<v-alert v-if="error" type="error" dense class="mt-2" dismissible @input="error=''">{{ error }}</v-alert>

					<!-- Results -->
					<template v-if="rows.length">

						<!-- Metadata chips -->
						<div v-if="hasMetadata" class="mb-3">
							<v-chip v-if="meta.date" small class="meta-chip" color="blue-grey darken-2" text-color="white">
								<v-icon left x-small>mdi-calendar</v-icon>{{ meta.date }}
							</v-chip>
							<v-chip v-if="meta.rrf_version" small class="meta-chip" color="blue-grey darken-2" text-color="white">
								<v-icon left x-small>mdi-chip</v-icon>RRF: {{ meta.rrf_version }}
							</v-chip>
							<v-chip v-if="meta.bd_version" small class="meta-chip" color="blue-grey darken-2" text-color="white">
								<v-icon left x-small>mdi-memory</v-icon>{{ meta.bd_version }}
							</v-chip>
							<v-chip v-if="meta.mode" small class="meta-chip" :color="meta.mode === 'pa' ? 'teal darken-2' : 'deep-purple darken-2'" text-color="white">
								<v-icon left x-small>mdi-sine-wave</v-icon>mode: {{ meta.mode }}
							</v-chip>
							<v-chip v-if="meta.nozzle_temp" small class="meta-chip" color="orange darken-3" text-color="white">
								<v-icon left x-small>mdi-thermometer</v-icon>{{ meta.nozzle_temp }}°C
							</v-chip>
							<v-chip v-if="meta.pa_start && meta.pa_step && meta.steps" small class="meta-chip" color="blue-grey darken-2" text-color="white">
								<v-icon left x-small>mdi-ray-start-arrow</v-icon>
								PA {{ meta.pa_start }} + {{ meta.pa_step }} × {{ meta.steps }}
							</v-chip>
						</div>

						<!-- Best PA summary -->
						<v-alert type="success" dense class="mb-3" v-if="best">
							<span class="best-badge">Best PA = {{ best.pa.toFixed(4) }}</span>
							&nbsp;—&nbsp;
							res={{ best.res }}&nbsp; lk={{ best.lk }}&nbsp; rk={{ best.rk }}&nbsp; Hk={{ best.Hk }}&nbsp; Ha={{ best.Ha }}
							<v-btn small outlined class="ml-3" color="white" @click="copyM572">
								<v-icon left small>mdi-content-copy</v-icon>
								Copy M572 D{{ extruderIndex }} S{{ best.pa.toFixed(4) }}
							</v-btn>
						</v-alert>

						<v-snackbar v-model="copied" timeout="2000" color="success" top>M572 command copied to clipboard</v-snackbar>

						<!-- Charts -->
						<v-row dense>
							<v-col cols="12">
								<canvas ref="chartRes" height="220"></canvas>
							</v-col>
							<v-col cols="12">
								<canvas ref="chartSlopes" height="180"></canvas>
							</v-col>
							<v-col cols="12">
								<canvas ref="chartH" height="180"></canvas>
							</v-col>
						</v-row>

						<!-- Analysis panel -->
						<v-card outlined class="mt-4" v-if="analysis.items.length">
							<v-card-title class="subtitle-1 pb-1">
								<v-icon left small>mdi-lightbulb-outline</v-icon>
								Analysis
							</v-card-title>
							<v-card-text class="pt-0">
								<div v-for="(item, i) in analysis.items" :key="i" class="analysis-item">
									<v-icon small :color="item.color">{{ item.icon }}</v-icon>
									<span>{{ item.text }}</span>
								</div>

								<!-- Suggested next sweep -->
								<template v-if="analysis.nextSweep">
									<v-divider class="my-3" />
									<div class="subtitle-2 mb-1">
										<v-icon small left>mdi-magnify-plus-outline</v-icon>
										Suggested next sweep
									</div>
									<div class="body-2 mb-2">{{ analysis.nextSweep.reason }}</div>
									<code class="next-sweep-code">{{ analysis.nextSweep.code }}</code>
									<v-btn small text class="mt-2" @click="copyNextSweep">
										<v-icon left small>mdi-content-copy</v-icon>
										Copy
									</v-btn>
									<v-snackbar v-model="copiedSweep" timeout="2000" color="success" top>Next sweep parameters copied</v-snackbar>
								</template>
							</v-card-text>
						</v-card>

						<!-- Data table -->
						<v-expansion-panels flat class="mt-2">
							<v-expansion-panel>
								<v-expansion-panel-header>Raw data ({{ rows.length }} iterations)</v-expansion-panel-header>
								<v-expansion-panel-content>
									<v-simple-table dense class="metric-table">
										<thead>
											<tr>
												<th>iter</th><th>PA</th><th>res</th><th>lk</th><th>rk</th><th>Hk</th><th>Ha</th>
											</tr>
										</thead>
										<tbody>
											<tr v-for="r in rows" :key="r.iter"
												:class="best && r.iter === best.iter ? 'green lighten-4' : ''">
												<td>{{ r.iter }}</td>
												<td>{{ r.pa.toFixed(4) }}</td>
												<td>{{ r.res }}</td>
												<td>{{ r.lk }}</td>
												<td>{{ r.rk }}</td>
												<td>{{ r.Hk }}</td>
												<td>{{ r.Ha }}</td>
											</tr>
										</tbody>
									</v-simple-table>
								</v-expansion-panel-content>
							</v-expansion-panel>
						</v-expansion-panels>

						<div class="mt-2 text-right">
							<v-btn small text @click="clearData">
								<v-icon left small>mdi-close</v-icon>
								Clear
							</v-btn>
						</div>
					</template>
				</v-card-text>
			</v-card>
		</v-col>
	</v-row>
</template>

<script>
import Chart from 'chart.js'
import { mapState } from 'vuex'

const LOG_PATH = '0:/sys/pa_calibrate_log.txt'
const WARM_UP_SKIP = 5

export default {
	name: 'PaCalibration',

	data() {
		return {
			rows: [],
			meta: {},
			best: null,
			analysis: { items: [], nextSweep: null },
			error: '',
			fetching: false,
			dragging: false,
			copied: false,
			copiedSweep: false,
			chartRes: null,
			chartSlopes: null,
			chartH: null,
		}
	},

	computed: {
		hasMetadata() {
			return Object.keys(this.meta).length > 0
		},
		extruderIndex() {
			// Use extruder index from log metadata if present, otherwise 0
			const e = parseInt(this.meta.extruder)
			return isNaN(e) ? 0 : e
		},
		...mapState('settings', ['darkTheme']),
	},

	watch: {
		darkTheme(dark) {
			this.applyTheme(dark)
		},
	},

	methods: {
		// ------------------------------------------------------------------ file handling
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
			reader.onerror = () => { this.error = 'Failed to read file' }
			reader.readAsText(file)
		},

		async loadFromDuet() {
			this.fetching = true
			this.error = ''
			try {
				const res = await this.$store.dispatch('machine/download', {
					filename: LOG_PATH,
					type: 'text',
					showProgress: false,
					showSuccess: false,
					showError: false,
				})
				this.parseCSV(res)
			} catch (e) {
				this.error = `Could not fetch ${LOG_PATH} — run a calibration first. (${e.message || e})`
			} finally {
				this.fetching = false
			}
		},

		// ------------------------------------------------------------------ parsing
		parseCSV(text) {
			this.error = ''
			const meta = {}
			const dataLines = []

			for (const raw of text.split('\n')) {
				const line = raw.trim()
				if (!line) continue
				if (line.startsWith('#')) {
					const content = line.replace(/^#+\s*/, '')
					if (content.includes('=')) {
						const pairs = content.matchAll(/(\w+)=([^\s]+)/g)
						for (const [, k, v] of pairs) meta[k] = v
					}
					continue
				}
				dataLines.push(line)
			}

			if (!dataLines.length) { this.error = 'File is empty'; return }

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
				} catch (_) { /* skip malformed rows */ }
			}

			if (!parsed.length) { this.error = 'No valid data rows found'; return }

			this.meta = meta
			this.rows = parsed
			this.best = this.findBest(parsed)
			this.analysis = this.analyseData(parsed, this.best, meta)
			this.$nextTick(() => this.drawCharts())
		},

		findBest(rows) {
			const candidates = rows.filter(r => r.iter >= WARM_UP_SKIP && r.res > 0)
			if (!candidates.length) return null
			return candidates.reduce((a, b) => b.res < a.res ? b : a)
		},

		// ------------------------------------------------------------------ analysis
		// All computation runs in the browser on the client machine.
		analyseData(rows, best, meta) {
			const items = []
			const active = rows.filter(r => r.iter >= WARM_UP_SKIP && r.res > 0)
			if (!active.length || !best) return { items, nextSweep: null }

			const resVals = active.map(r => r.res)
			const paVals  = active.map(r => r.pa)
			const n       = active.length

			const mean = resVals.reduce((a, b) => a + b, 0) / n
			const variance = resVals.reduce((s, v) => s + (v - mean) ** 2, 0) / n
			const stdDev = Math.sqrt(variance)
			const cvPct  = mean > 0 ? (stdDev / mean) * 100 : 0

			const paMin  = paVals[0]
			const paMax  = paVals[paVals.length - 1]
			const paRange = paMax - paMin
			const step   = meta.pa_step ? parseFloat(meta.pa_step) : null
			const bestIdx = active.findIndex(r => r.iter === best.iter)
			const edgeFrac = paRange > 0 ? Math.min(
				(best.pa - paMin) / paRange,
				(paMax - best.pa)  / paRange
			) : 0.5

			// --- noise / reliability ---
			if (cvPct > 40) {
				items.push({
					icon: 'mdi-alert-outline',
					color: 'orange',
					text: `High variability in res scores (CV ${cvPct.toFixed(0)}%). Results may be unreliable — consider averaging multiple runs or checking for vibration/airflow during calibration.`
				})
			} else if (cvPct > 20) {
				items.push({
					icon: 'mdi-information-outline',
					color: 'yellow',
					text: `Moderate variability in res scores (CV ${cvPct.toFixed(0)}%). The best PA value is a reasonable estimate but a second run would improve confidence.`
				})
			} else {
				items.push({
					icon: 'mdi-check-circle-outline',
					color: 'green',
					text: `Low variability in res scores (CV ${cvPct.toFixed(0)}%) — sweep conditions were consistent.`
				})
			}

			// --- minimum position (near edge = range shift needed) ---
			if (edgeFrac < 0.15) {
				const dir = best.pa - paMin < paMax - best.pa ? 'lower' : 'higher'
				items.push({
					icon: 'mdi-alert-circle-outline',
					color: 'orange',
					text: `Best PA (${best.pa.toFixed(4)}) is near the ${dir === 'lower' ? 'start' : 'end'} of the sweep range. The true optimum may be outside the range — the next sweep should shift ${dir}.`
				})
			} else if (edgeFrac < 0.25) {
				items.push({
					icon: 'mdi-information-outline',
					color: 'yellow',
					text: `Best PA (${best.pa.toFixed(4)}) is close to one edge of the sweep. Consider a follow-up sweep centred on this value to confirm it is a true minimum.`
				})
			} else {
				items.push({
					icon: 'mdi-check-circle-outline',
					color: 'green',
					text: `Best PA (${best.pa.toFixed(4)}) is well within the sweep range — the minimum is not truncated.`
				})
			}

			// --- flatness around the minimum ---
			const window = Math.max(2, Math.round(n * 0.12))
			const lo = Math.max(0, bestIdx - window)
			const hi = Math.min(active.length - 1, bestIdx + window)
			const nearMin = active.slice(lo, hi + 1)
			const nearMean = nearMin.reduce((s, r) => s + r.res, 0) / nearMin.length
			const flatness = best.res > 0 ? (nearMean - best.res) / best.res : 0

			if (flatness < 0.15) {
				items.push({
					icon: 'mdi-information-outline',
					color: 'yellow',
					text: `The res curve is flat near the minimum — several PA values score similarly. A finer sweep will help identify a more precise optimum.`
				})
			} else {
				items.push({
					icon: 'mdi-check-circle-outline',
					color: 'green',
					text: `The res curve has a clear minimum with good separation from surrounding values.`
				})
			}

			// --- lk / rk asymmetry ---
			const lkMean = active.reduce((s, r) => s + r.lk, 0) / n
			const rkMean = active.reduce((s, r) => s + r.rk, 0) / n
			if (lkMean > 0 && rkMean > 0) {
				const asymm = Math.abs(lkMean - rkMean) / Math.max(lkMean, rkMean)
				if (asymm > 0.4) {
					const higher = rkMean > lkMean ? 'rk (right slope)' : 'lk (left slope)'
					items.push({
						icon: 'mdi-swap-horizontal',
						color: 'orange',
						text: `Significant slope asymmetry: ${higher} is consistently higher (lk avg ${lkMean.toFixed(1)}, rk avg ${rkMean.toFixed(1)}). This can indicate a temperature or flow asymmetry in the pressure response.`
					})
				} else {
					items.push({
						icon: 'mdi-check-circle-outline',
						color: 'green',
						text: `Slopes are reasonably symmetric (lk avg ${lkMean.toFixed(1)}, rk avg ${rkMean.toFixed(1)}).`
					})
				}
			}

			// --- suggest next sweep ---
			let nextSweep = null
			if (step !== null) {
				const fineStep = parseFloat((step / 4).toPrecision(3))
				const fineHalfRange = fineStep * 15  // 30 steps total, 15 each side
				const fineStart = parseFloat(Math.max(0, best.pa - fineHalfRange).toPrecision(4))
				const fineEnd   = parseFloat((best.pa + fineHalfRange).toPrecision(4))
				const fineSteps = Math.round((fineEnd - fineStart) / fineStep)

				if (edgeFrac < 0.15) {
					// range shift needed
					const dir = best.pa - paMin < paMax - best.pa ? -1 : 1
					const shiftedStart = parseFloat(Math.max(0, best.pa + dir * paRange * 0.4).toPrecision(4))
					const shiftedEnd   = parseFloat((shiftedStart + paRange).toPrecision(4))
					const shiftedSteps = Math.round(paRange / step)
					nextSweep = {
						reason: `Shift the sweep range to keep the minimum centred. Use the same step size (${step}) over the same range width.`,
						code: `var pa_start = ${shiftedStart}\nvar pa_step  = ${step}\nvar steps    = ${shiftedSteps}  ; covers ${shiftedStart.toFixed(4)}–${shiftedEnd.toFixed(4)}`
					}
				} else {
					nextSweep = {
						reason: `Zoom in around the best value (${best.pa.toFixed(4)}) with a finer step (${fineStep}) to pinpoint the optimum.`,
						code: `var pa_start = ${fineStart}\nvar pa_step  = ${fineStep}\nvar steps    = ${fineSteps}  ; covers ${fineStart.toFixed(4)}–${fineEnd.toFixed(4)}`
					}
				}
			}

			return { items, nextSweep }
		},

		// ------------------------------------------------------------------ charts
		destroyCharts() {
			[this.chartRes, this.chartSlopes, this.chartH].forEach(c => { if (c) c.destroy() })
			this.chartRes = this.chartSlopes = this.chartH = null
		},

		themeColors(dark) {
			return {
				fontColor: dark ? '#fff' : '#444',
				gridColor: dark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)',
				titleColor: dark ? '#fff' : '#222',
			}
		},

		applyTheme(dark) {
			const { fontColor, gridColor, titleColor } = this.themeColors(dark)
			const charts = [this.chartRes, this.chartSlopes, this.chartH]
			charts.forEach(chart => {
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

		// Draws the best-PA vertical line and (optionally) the good-zone band.
		// Called as Chart.js afterDatasetsDraw — using this hook instead of the
		// plugins option array because Chart.js v2 does not reliably invoke
		// per-chart plugin objects passed via options.plugins.
		makeOverlayHook(best, goodStart, goodEnd, drawZone) {
			return (chart) => {
				if (!best) return
				const ctx = chart.ctx
				const { top, bottom, left, right } = chart.chartArea
				const labels = chart.data.labels

				// Shaded good zone on res chart only
				if (drawZone && goodStart && goodEnd) {
					const idxL = labels.indexOf(goodStart.pa.toFixed(4))
					const idxR = labels.indexOf(goodEnd.pa.toFixed(4))
					if (idxL >= 0 && idxR >= 0) {
						const m = chart.getDatasetMeta(0)
						const xL = m.data[idxL] ? m.data[idxL]._model.x : left
						const xR = m.data[idxR] ? m.data[idxR]._model.x : right
						ctx.save()
						ctx.fillStyle = 'rgba(46,125,50,0.15)'
						ctx.fillRect(xL, top, xR - xL, bottom - top)
						ctx.restore()
					}
				}

				// Best-PA vertical dashed line
				const bestLabel = best.pa.toFixed(4)
				const idx = labels.indexOf(bestLabel)
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

				// Label
				ctx.setLineDash([])
				ctx.fillStyle = 'rgba(211,47,47,0.9)'
				ctx.font = 'bold 10px sans-serif'
				const rightHalf = x > (left + right) / 2
				ctx.textAlign = rightHalf ? 'right' : 'left'
				ctx.fillText(`best ${bestLabel}`, rightHalf ? x - 4 : x + 4, top + 12)
				ctx.restore()
			}
		},

		drawCharts() {
			this.destroyCharts()
			const dark = this.darkTheme
			const { fontColor, gridColor, titleColor } = this.themeColors(dark)

			const pa  = this.rows.map(r => r.pa.toFixed(4))
			const res = this.rows.map(r => r.res)
			const lk  = this.rows.map(r => r.lk)
			const rk  = this.rows.map(r => r.rk)
			const Hk  = this.rows.map(r => r.Hk)
			const Ha  = this.rows.map(r => r.Ha)

			const best   = this.best
			const active = this.rows.filter(r => r.iter >= WARM_UP_SKIP && r.res > 0)

			// Good zone: all points within 20% of best res
			const threshold = best ? best.res * 1.20 : null
			const goodStart = threshold ? active.find(r => r.res <= threshold) : null
			const goodEnd   = threshold ? [...active].reverse().find(r => r.res <= threshold) : null

			const commonOpts = (title) => ({
				responsive: true,
				maintainAspectRatio: false,
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
				title: { display: true, text: title, fontSize: 12, fontColor: titleColor },
				scales: {
					xAxes: [{ ticks: { maxTicksLimit: 20, maxRotation: 45, fontSize: 10, fontColor }, gridLines: { color: gridColor } }],
					yAxes: [{ ticks: { fontSize: 10, fontColor }, gridLines: { color: gridColor } }]
				},
			})

			// --- res chart ---
			this.chartRes = new Chart(this.$refs.chartRes.getContext('2d'), {
				type: 'line',
				data: {
					labels: pa,
					datasets: [{
						label: 'res (lower = better)',
						data: res,
						borderColor: '#1565C0',
						backgroundColor: 'rgba(21,101,192,0.08)',
						borderWidth: 1.5,
						pointRadius: 2,
						fill: true,
					}]
				},
				options: commonOpts('Pressure score (res)'),
			})
			const overlayRes   = this.makeOverlayHook(best, goodStart, goodEnd, true)
			const overlayOther = this.makeOverlayHook(best, goodStart, goodEnd, false)
			this._patchChartOverlay(this.chartRes, overlayRes)

			// --- slopes chart ---
			this.chartSlopes = new Chart(this.$refs.chartSlopes.getContext('2d'), {
				type: 'line',
				data: {
					labels: pa,
					datasets: [
						{
							label: 'lk (left slope)',
							data: lk,
							borderColor: '#2E7D32',
							backgroundColor: '#2E7D32',
							borderWidth: 1.5,
							pointRadius: 2,
							fill: false,
						},
						{
							label: 'rk (right slope)',
							data: rk,
							borderColor: '#7B1FA2',
							backgroundColor: '#7B1FA2',
							borderWidth: 1.5,
							pointRadius: 2,
							fill: false,
						}
					]
				},
				options: commonOpts('Slopes (lk / rk)'),
			})
			this._patchChartOverlay(this.chartSlopes, overlayOther)

			// --- peak heights chart ---
			const hOpts = commonOpts('Peak heights / signal quality (Hk / Ha)')
			hOpts.scales.yAxes[0].ticks.min = 0
			hOpts.scales.yAxes[0].ticks.max = 255
			this.chartH = new Chart(this.$refs.chartH.getContext('2d'), {
				type: 'line',
				data: {
					labels: pa,
					datasets: [
						{
							label: 'Hk (left peak)',
							data: Hk,
							borderColor: '#00838F',
							backgroundColor: '#00838F',
							borderWidth: 1.5,
							pointRadius: 2,
							fill: false,
						},
						{
							label: 'Ha (right peak)',
							data: Ha,
							borderColor: '#E65100',
							backgroundColor: '#E65100',
							borderWidth: 1.5,
							pointRadius: 2,
							fill: false,
						}
					]
				},
				options: hOpts,
			})
			this._patchChartOverlay(this.chartH, overlayOther)
		},

		// Patches a Chart.js v2 chart instance so that afterDatasetsDraw calls our hook.
		// Chart.js v2 does not support per-chart inline plugins reliably, so we wrap
		// the internal draw method to append our overlay after each render.
		_patchChartOverlay(chart, hookFn) {
			const original = chart.draw.bind(chart)
			chart.draw = function(ease) {
				original(ease)
				hookFn(chart)
			}
			// Trigger once immediately so the line appears without waiting for interaction
			chart.update()
		},

		// ------------------------------------------------------------------ actions
		copyM572() {
			if (!this.best) return
			const cmd = `M572 D${this.extruderIndex} S${this.best.pa.toFixed(4)}`
			navigator.clipboard.writeText(cmd).then(() => { this.copied = true })
		},

		copyNextSweep() {
			if (!this.analysis.nextSweep) return
			navigator.clipboard.writeText(this.analysis.nextSweep.code).then(() => { this.copiedSweep = true })
		},

		clearData() {
			this.destroyCharts()
			this.rows = []
			this.meta = {}
			this.best = null
			this.analysis = { items: [], nextSweep: null }
			this.error = ''
		},
	},

	beforeDestroy() {
		this.destroyCharts()
	},
}
</script>
