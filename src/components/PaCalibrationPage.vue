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
	background: rgba(128, 128, 128, 0.1);
	border-radius: 4px;
	padding: 8px 12px;
	white-space: pre;
	display: block;
	margin-top: 4px;
}
.params-panel {
	border-right: 1px solid rgba(128, 128, 128, 0.2);
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
		<v-col v-show="activeTab === 'live'" cols="12" md="2" class="params-panel pa-3" style="overflow-y:auto;align-self:stretch">
			<div class="text-subtitle-2 mb-2">
				<v-icon size="small" class="mr-1">mdi-tune</v-icon>Parameters
			</div>

			<div class="param-section-title">Hotend</div>
			<v-select
				v-model="hotendPreset"
				:items="presetItems"
				variant="outlined"
				density="compact"
				hide-details
				label="Hotend type"
				class="mb-1"
				:disabled="isRunning"
			/>
			<div v-if="currentPreset.note" class="text-caption mb-3" style="opacity:0.55;line-height:1.3">
				{{ currentPreset.note }}
			</div>
			<div v-else class="mb-3" />

			<div class="param-section-title">Tool</div>
			<v-text-field
				:model-value="params.tool"
				@update:model-value="v => params.tool = parseInt(String(v)) || 0"
				variant="outlined" density="compact" hide-details
				label="Tool #" inputmode="numeric" class="mb-2" :disabled="isRunning"
			/>

			<div class="param-section-title">Temperature</div>
			<v-text-field
				:model-value="params.nozzle_temp"
				@update:model-value="v => params.nozzle_temp = parseInt(String(v)) || 210"
				variant="outlined" density="compact" hide-details
				label="Nozzle" inputmode="numeric" class="mb-2" :disabled="isRunning" suffix="°C"
			/>

			<div class="param-section-title">PA sweep</div>
			<v-text-field
				:model-value="params.pa_start"
				@update:model-value="v => { params.pa_start = parseFloat(String(v)) || 0; hotendPreset = 'custom' }"
				variant="outlined" density="compact" hide-details
				label="PA start" inputmode="decimal" class="mb-2" :disabled="isRunning"
			/>
			<v-text-field
				:model-value="params.pa_step"
				@update:model-value="v => { params.pa_step = parseFloat(String(v)) || 0.005; hotendPreset = 'custom' }"
				variant="outlined" density="compact" hide-details
				label="PA step" inputmode="decimal" class="mb-2" :disabled="isRunning"
			/>
			<v-text-field
				:model-value="params.steps"
				@update:model-value="v => { params.steps = parseInt(String(v)) || 50; hotendPreset = 'custom' }"
				variant="outlined" density="compact" hide-details
				label="Steps" inputmode="numeric" class="mb-2" :disabled="isRunning"
			/>
			<v-text-field
				:model-value="params.warmup_steps"
				@update:model-value="v => params.warmup_steps = parseInt(String(v)) || 0"
				variant="outlined" density="compact" hide-details
				label="Warm-up passes" inputmode="numeric" class="mb-2" :disabled="isRunning"
			/>
			<v-switch
				v-model="params.bidirectional"
				density="compact" hide-details
				label="Bidirectional passes" class="mb-2 mt-0" :disabled="isRunning"
			/>
			<div class="text-caption mb-3" style="opacity:0.6">
				Range: {{ params.pa_start.toFixed(livePaDecimals) }} – {{ paEnd.toFixed(livePaDecimals) }}
			</div>

			<div class="param-section-title">Speeds (mm/min)</div>
			<v-text-field
				:model-value="params.low_speed"
				@update:model-value="v => params.low_speed = parseInt(String(v)) || 1020"
				variant="outlined" density="compact" hide-details
				label="Slow" inputmode="numeric" class="mb-2" :disabled="isRunning"
			/>
			<v-text-field
				:model-value="params.high_speed"
				@update:model-value="v => params.high_speed = parseInt(String(v)) || 10740"
				variant="outlined" density="compact" hide-details
				label="Fast" inputmode="numeric" class="mb-2" :disabled="isRunning"
			/>
			<v-text-field
				:model-value="params.travel_speed"
				@update:model-value="v => params.travel_speed = parseInt(String(v)) || 18000"
				variant="outlined" density="compact" hide-details
				label="Travel" inputmode="numeric" class="mb-2" :disabled="isRunning"
			/>

			<div class="param-section-title">Z height</div>
			<v-text-field
				:model-value="params.z_height"
				@update:model-value="v => params.z_height = parseFloat(String(v)) || 50"
				variant="outlined" density="compact" hide-details
				label="Z" inputmode="decimal" class="mb-3" :disabled="isRunning" suffix="mm"
			/>

			<v-divider class="mb-3" />

			<v-alert v-if="hotendPreset === 'unknown'" type="info" density="compact" class="mb-2 text-caption">
				Select a hotend type above to enable calibration.
			</v-alert>
			<v-btn block color="success" :disabled="isRunning || hotendPreset === 'unknown'" @click="startCalibration" class="mb-2">
				<v-icon class="mr-1">mdi-play</v-icon>Start
			</v-btn>
			<v-btn block color="error" :disabled="!isRunning" @click="stopCalibration" variant="outlined">
				<v-icon class="mr-1">mdi-stop</v-icon>Abort
			</v-btn>

			<!-- Live status -->
			<div v-if="liveStatus.state" class="mt-3">
				<v-progress-linear
					:model-value="liveProgress"
					:color="liveStatus.state === 'done' ? 'success' : 'primary'"
					height="6" rounded class="mb-1"
				/>
				<div class="status-state">
					<span v-if="liveStatus.state === 'starting'">Starting…</span>
					<span v-else-if="liveStatus.state === 'heating'">Heating nozzle…</span>
					<span v-else-if="liveStatus.state === 'priming'">Priming…</span>
					<span v-else-if="liveStatus.state === 'warmup'">Warm-up ({{ liveStatus.warmup }} passes at PA=0)…</span>
					<span v-else-if="liveStatus.state === 'running'">
						Step {{ liveStatus.step }} / {{ liveStatus.steps }}<br>
						<span style="opacity:0.7">PA {{ (liveStatus.pa || 0).toFixed(livePaDecimals) }}</span>
					</span>
					<span v-else-if="liveStatus.state === 'done'">
						<v-icon size="small" color="success">mdi-check-circle</v-icon>
						Done — best PA {{ (liveStatus.best_pa || 0).toFixed(livePaDecimals) }}
					</span>
					<span v-else-if="liveStatus.state === 'aborted'">
						<v-icon size="small" color="warning">mdi-alert</v-icon> Aborted
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
					<v-chip size="x-small" class="ml-2" color="blue-grey-darken-3">v{{ pluginVersion }}</v-chip>
					<v-spacer />
					<v-btn
						icon
						size="small"
						variant="text"
						class="mr-2"
						title="About / Updates"
						@click="showAbout = true"
					>
						<v-icon>mdi-information-outline</v-icon>
					</v-btn>
					<v-select
						v-model="selectedLogFile"
						:items="logFiles"
						variant="outlined"
						density="compact"
						hide-details
						clearable
						label="Load log from Duet"
						class="mr-2"
						style="max-width:320px;font-size:0.85em"
						:loading="loadingFiles"
						:disabled="loadingFiles || isRunning"
						no-data-text="No logs found — run a calibration first"
						@click:control="listLogFiles"
						@update:model-value="onLogFileSelected"
					>
						<template #append-inner>
							<v-btn
								icon
								size="x-small"
								variant="text"
								:loading="loadingFiles"
								:disabled="loadingFiles || isRunning"
								@click.stop="listLogFiles"
								title="Refresh log list"
							>
								<v-icon size="small">mdi-refresh</v-icon>
							</v-btn>
						</template>
					</v-select>
				</v-card-title>

				<v-tabs v-model="activeTab" density="compact" class="mb-2">
					<v-tab value="live">
						<v-icon size="small" class="mr-1">mdi-chart-line-variant</v-icon>Live Run
						<v-badge v-if="isRunning" color="success" dot inline class="ml-1" />
					</v-tab>
					<v-tab value="log">
						<v-icon size="small" class="mr-1">mdi-file-chart</v-icon>Log Viewer
					</v-tab>
					<v-tab value="help">
						<v-icon size="small" class="mr-1">mdi-help-circle-outline</v-icon>Help
					</v-tab>
				</v-tabs>

				<v-tabs-window v-model="activeTab">

					<!-- ============================================================
					     TAB — LIVE RUN
					     ============================================================ -->
					<v-tabs-window-item value="live">
						<v-card-text class="pt-1">
							<v-alert v-if="error" type="error" density="compact" closable @click:close="error = ''" class="mb-2">{{ error }}</v-alert>

							<div v-if="!isRunning && !liveRows.length && liveStatus.state !== 'done'" class="text-center py-8 text-medium-emphasis">
								<v-icon size="x-large" color="grey">mdi-play-circle-outline</v-icon>
								<div class="mt-2">Set parameters and press <strong>Start</strong> to begin a live calibration run.</div>
							</div>

							<v-alert v-if="liveBest" type="success" density="compact" class="mb-2">
								<span class="best-badge">Best PA so far = {{ liveBest.pa.toFixed(livePaDecimals) }}</span>
								&nbsp;—&nbsp; res={{ liveBest.res }}, lk={{ liveBest.lk }}, rk={{ liveBest.rk }}
								<v-btn v-if="liveStatus.state === 'done'" size="small" variant="outlined" class="ml-3" color="white" @click="copyLiveM572">
									<v-icon size="small" class="mr-1">mdi-content-copy</v-icon>
									Copy M572 D0 S{{ liveBest.pa.toFixed(livePaDecimals) }}
								</v-btn>
							</v-alert>
							<v-snackbar v-model="copiedLive" :timeout="2000" color="success" location="top">M572 command copied</v-snackbar>

							<template v-if="liveRows.length">
								<v-row dense>
									<v-col cols="12"><canvas ref="liveChartResEl" height="200"></canvas></v-col>
									<v-col cols="12"><canvas ref="liveChartSlopesEl" height="160"></canvas></v-col>
									<v-col cols="12"><canvas ref="liveChartHEl" height="160"></canvas></v-col>
								</v-row>
							</template>
						</v-card-text>
					</v-tabs-window-item>

					<!-- ============================================================
					     TAB — LOG VIEWER
					     ============================================================ -->
					<v-tabs-window-item value="log">
						<v-card-text class="pt-1">
							<div v-if="!rows.length"
								class="drop-zone"
								:class="{ 'drag-over': dragging }"
								@click="fileInputEl?.click()"
								@dragover.prevent="dragging = true"
								@dragleave="dragging = false"
								@drop.prevent="onFileDrop">
								<v-icon size="x-large" color="grey">mdi-file-upload-outline</v-icon>
								<div class="mt-2 text-medium-emphasis">
									Drop a <strong>pa_*.csv</strong> log file here, click to browse,<br>
									or select a log from the <strong>Load log from Duet</strong> picker above.
								</div>
							</div>
							<input ref="fileInputEl" type="file" accept=".txt,.csv" style="display:none" @change="onFileSelect" />

							<v-alert v-if="logError" type="error" density="compact" closable @click:close="logError = ''" class="mt-2">{{ logError }}</v-alert>

							<template v-if="rows.length">
								<div v-if="hasMetadata" class="mb-3">
									<v-chip v-if="meta.date"        size="small" class="meta-chip" color="blue-grey-darken-2"><v-icon start size="x-small">mdi-calendar</v-icon>{{ meta.date }}</v-chip>
									<v-chip v-if="meta.rrf_version" size="small" class="meta-chip" color="blue-grey-darken-2"><v-icon start size="x-small">mdi-chip</v-icon>RRF: {{ meta.rrf_version }}</v-chip>
									<v-chip v-if="meta.bd_version"  size="small" class="meta-chip" color="blue-grey-darken-2"><v-icon start size="x-small">mdi-memory</v-icon>{{ meta.bd_version }}</v-chip>
									<v-chip v-if="meta.mode"        size="small" class="meta-chip" :color="meta.mode === 'pa' ? 'teal-darken-2' : 'deep-purple-darken-2'"><v-icon start size="x-small">mdi-sine-wave</v-icon>mode: {{ meta.mode }}</v-chip>
									<v-chip v-if="meta.nozzle_temp" size="small" class="meta-chip" color="orange-darken-3"><v-icon start size="x-small">mdi-thermometer</v-icon>{{ meta.nozzle_temp }}°C</v-chip>
									<v-chip v-if="meta.pa_start && meta.pa_step && meta.steps" size="small" class="meta-chip" color="blue-grey-darken-2">
										<v-icon start size="x-small">mdi-ray-start-arrow</v-icon>PA {{ meta.pa_start }} + {{ meta.pa_step }} × {{ meta.steps }}
									</v-chip>
									<v-chip v-if="meta.hotend_preset && meta.hotend_preset !== 'custom'" size="small" class="meta-chip" color="indigo-darken-2">
										<v-icon start size="x-small">mdi-printer-3d-nozzle</v-icon>{{ meta.hotend_preset }}
									</v-chip>
								</div>

								<v-alert type="success" density="compact" class="mb-3" v-if="best">
									<span class="best-badge">Best PA = {{ best.pa.toFixed(logPaDecimals) }}</span>
									&nbsp;—&nbsp; res={{ best.res }}&nbsp; lk={{ best.lk }}&nbsp; rk={{ best.rk }}&nbsp; Hk={{ best.Hk }}&nbsp; Ha={{ best.Ha }}
									<v-btn size="small" variant="outlined" class="ml-3" color="white" @click="copyM572">
										<v-icon size="small" class="mr-1">mdi-content-copy</v-icon>
										Copy M572 D{{ logExtruderIndex }} S{{ best.pa.toFixed(logPaDecimals) }}
									</v-btn>
								</v-alert>
								<v-snackbar v-model="copied" :timeout="2000" color="success" location="top">M572 command copied to clipboard</v-snackbar>

								<v-row dense>
									<v-col cols="12"><canvas ref="chartResEl"    height="200"></canvas></v-col>
									<v-col cols="12"><canvas ref="chartSlopesEl" height="160"></canvas></v-col>
									<v-col cols="12"><canvas ref="chartHEl"      height="160"></canvas></v-col>
								</v-row>

								<v-card variant="outlined" class="mt-4" v-if="analysis.items.length">
									<v-card-title class="text-subtitle-1 pb-1">
										<v-icon size="small" class="mr-1">mdi-lightbulb-outline</v-icon>Analysis
									</v-card-title>
									<v-card-text class="pt-0">
										<div v-for="(item, i) in analysis.items" :key="i" class="analysis-item">
											<v-icon size="small" :color="item.color">{{ item.icon }}</v-icon>
											<span>{{ item.text }}</span>
										</div>
										<template v-if="analysis.nextSweep">
											<v-divider class="my-3" />
											<div class="text-subtitle-2 mb-1"><v-icon size="small" class="mr-1">mdi-magnify-plus-outline</v-icon>Suggested next sweep</div>
											<div class="text-body-2 mb-2">{{ analysis.nextSweep.reason }}</div>
											<code class="next-sweep-code">{{ analysis.nextSweep.code }}</code>
											<v-btn size="small" variant="text" class="mt-2" @click="copyNextSweep"><v-icon size="small" class="mr-1">mdi-content-copy</v-icon>Copy</v-btn>
											<v-btn size="small" variant="outlined" class="mt-2 ml-1" color="primary" @click="applyNextSweep"><v-icon size="small" class="mr-1">mdi-play-circle-outline</v-icon>Load into Live Run</v-btn>
											<v-snackbar v-model="copiedSweep" :timeout="2000" color="success" location="top">Next sweep parameters copied</v-snackbar>
										</template>
									</v-card-text>
								</v-card>

								<v-expansion-panels flat class="mt-2">
									<v-expansion-panel>
										<v-expansion-panel-title>Raw data ({{ rows.length }} iterations)</v-expansion-panel-title>
										<v-expansion-panel-text>
											<v-table density="compact" class="metric-table">
												<thead><tr><th>iter</th><th>PA</th><th>res</th><th>lk</th><th>rk</th><th>Hk</th><th>Ha</th></tr></thead>
												<tbody>
													<tr v-for="r in rows" :key="r.iter" :class="best && r.iter === best.iter ? 'bg-green-lighten-4' : ''">
														<td>{{ r.iter }}</td><td>{{ r.pa.toFixed(logPaDecimals) }}</td><td>{{ r.res }}</td>
														<td>{{ r.lk }}</td><td>{{ r.rk }}</td><td>{{ r.Hk }}</td><td>{{ r.Ha }}</td>
													</tr>
												</tbody>
											</v-table>
										</v-expansion-panel-text>
									</v-expansion-panel>
								</v-expansion-panels>

								<div class="mt-2 text-right">
									<v-btn size="small" variant="text" @click="clearData"><v-icon size="small" class="mr-1">mdi-close</v-icon>Clear</v-btn>
								</div>
							</template>
						</v-card-text>
					</v-tabs-window-item>

					<!-- ============================================================
					     TAB — HELP
					     ============================================================ -->
					<v-tabs-window-item value="help">
						<v-card-text class="pt-2" style="max-width:860px">

							<div class="text-h6 mb-1">bd_pressure PA Calibration — Help</div>
							<div class="text-body-2 mb-4" style="opacity:0.7">Pressure Advance calibration using the bd_pressure strain-gauge sensor</div>

							<v-divider class="mb-4" />

							<div class="text-subtitle-1 mb-1"><v-icon size="small" class="mr-1" color="primary">mdi-information-outline</v-icon>What is Pressure Advance?</div>
							<p class="text-body-2">When an extruder pushes filament, the melt zone and bowden tube act like a spring — pressure builds up on acceleration and bleeds off on deceleration. This causes blobs at corners and gaps after them. Pressure Advance (PA) adds a small extra push on the way into a move and a small retraction on the way out, cancelling the effect. Getting the value right matters: too low leaves blobs, too high leaves gaps or ringing.</p>
							<p class="text-body-2 mb-4">Traditional PA tuning requires printing a test pattern and measuring it by eye. This plugin calibrates PA automatically by measuring extruder back-pressure directly with the bd_pressure sensor — no test prints needed.</p>

							<v-divider class="mb-4" />

							<div class="text-subtitle-1 mb-1"><v-icon size="small" class="mr-1" color="primary">mdi-cog-outline</v-icon>How calibration works</div>
							<p class="text-body-2">The macro raises the nozzle to a safe Z height and makes a series of short extrusion moves: slow → fast → slow. This is repeated once per PA value across the sweep range you set. On each pass the bd_pressure sensor measures how well the pressure transients are compensated and returns five scores. The plugin plots all of these so you can see not just the winner but the shape of the whole response.</p>
							<p class="text-body-2 mb-1">The sequence for each step is:</p>
							<ol class="text-body-2 mb-4" style="padding-left:20px">
								<li>Set PA to the next value in the sweep</li>
								<li>Move slow for 15 mm (ramp-up)</li>
								<li>Move fast for 30 mm (high-speed section)</li>
								<li>Move slow for 15 mm (ramp-down)</li>
								<li>Read all five scores from the sensor</li>
							</ol>

							<v-divider class="mb-4" />

							<div class="text-subtitle-1 mb-1"><v-icon size="small" class="mr-1" color="primary">mdi-tune</v-icon>Parameter guide</div>
							<p class="text-body-2 mb-2">Select your hotend type to automatically set a sensible PA sweep range and enable range checking in the Analysis panel. You can adjust any value afterwards — changing PA start, step, or steps will switch the selector back to <em>Custom</em>. The Start button is disabled until a hotend type is selected.</p>
							<v-table density="compact" class="mb-3">
								<thead><tr><th>Hotend type</th><th>Typical PA range</th><th>Step</th><th>Examples</th></tr></thead>
								<tbody>
									<tr><td><strong>Short melt zone</strong></td><td>0 – 0.10</td><td>0.002</td><td>E3D Revo (all variants), Slice Mosquito, Phaetus Dragon HF</td></tr>
									<tr><td><strong>Standard</strong></td><td>0 – 0.25</td><td>0.005</td><td>E3D V6, Dragon ST, Rapido HF (v1/v2), Dragonfly, Bambu X1/P1/A1, Creality Spider</td></tr>
									<tr><td><strong>High flow / long melt zone</strong></td><td>0 – 0.25</td><td>0.005</td><td>E3D Volcano, Rapido UHF, Dragon UHF, VzBot Goliath (50 mm melt zone), Mosquito Magnum+</td></tr>
									<tr><td><strong>Bowden</strong></td><td>0.3 – 1.5</td><td>0.02</td><td>Any hotend with a Bowden tube — tube length matters more than hotend type</td></tr>
									<tr><td><strong>Custom</strong></td><td>—</td><td>—</td><td>Manual entry, no range checking</td></tr>
								</tbody>
							</v-table>
							<p class="text-body-2 mb-2">If you are unsure, use <em>Standard</em> — it covers the most common PA range and the Analysis panel will flag if the result looks unexpectedly high or low.</p>
							<p class="text-body-2 mb-4">To avoid selecting your hotend type every session, uncomment the two lines in <code>/sys/bd_globals.g</code> and set your preset value — the plugin reads the stored value automatically on load.</p>

							<v-table density="compact" class="mb-4">
								<thead><tr><th>Parameter</th><th>What it does</th><th>Suggested starting point</th></tr></thead>
								<tbody>
									<tr><td><strong>Tool #</strong></td><td>Which tool to heat and calibrate (T0, T1 …). The extruder is derived automatically from the selected tool.</td><td>0 for single-tool printers</td></tr>
									<tr><td><strong>Nozzle temp</strong></td><td>Temperature to heat to before calibrating. Use your normal printing temperature for the filament you want to tune.</td><td>Your usual print temp</td></tr>
									<tr><td><strong>PA start</strong></td><td>The lowest PA value to test. Start at 0 for a first run.</td><td>0.0 (set automatically by hotend preset)</td></tr>
									<tr><td><strong>PA step</strong></td><td>How much to increase PA between each iteration. Smaller = finer resolution but longer run time.</td><td>Set automatically by hotend preset</td></tr>
									<tr><td><strong>Steps</strong></td><td>Number of iterations. Range covered = PA start + (steps−1) × step.</td><td>50</td></tr>
									<tr><td><strong>Warm-up passes</strong></td><td>Number of extrusion passes at PA=0 run before the sweep begins. These stabilise the hotend and sensor but are not recorded in the log. Set to 0 to skip.</td><td>8</td></tr>
									<tr><td><strong>Bidirectional passes</strong></td><td>When enabled, each pass extrudes on the return move instead of travelling back empty, roughly halving run time. Disable if results seem noisier than expected.</td><td>Off</td></tr>
									<tr><td><strong>Slow speed</strong></td><td>Speed for the ramp sections (mm/min). Lower = more sensitive to PA.</td><td>1020 (17 mm/s)</td></tr>
									<tr><td><strong>Fast speed</strong></td><td>Speed for the high-speed section (mm/min). Should be close to your normal print speed.</td><td>10740 (179 mm/s)</td></tr>
									<tr><td><strong>Travel speed</strong></td><td>Speed to move between lines (mm/min).</td><td>18000</td></tr>
									<tr><td><strong>Z height</strong></td><td>How high to lift the nozzle during calibration (mm). Must clear any probes or fans.</td><td>50</td></tr>
								</tbody>
							</v-table>

							<v-divider class="mb-4" />

							<div class="text-subtitle-1 mb-2"><v-icon size="small" class="mr-1" color="primary">mdi-chart-line</v-icon>Understanding the graphs</div>

							<div class="text-subtitle-2 mb-1">Graph 1 — Pressure score (res)</div>
							<p class="text-body-2">This is the primary result. <strong>Lower is better</strong> — res measures how far from ideal the pressure profile was during that extrusion move. The algorithm inside the bd_pressure sensor computes this from the raw strain data.</p>
							<ul class="text-body-2 mb-3" style="padding-left:20px">
								<li>The <strong>red dashed vertical line</strong> marks the recommended PA value — selected using a composite score that combines res with a slope-symmetry penalty (see below).</li>
								<li>The <strong>green shaded band</strong> covers the contiguous range of PA values around the best point whose composite score stays within 20% of the minimum. Any value in this band will perform similarly well in practice. A wide band means the printer is forgiving; a narrow band means precision matters.</li>
								<li>The first {{ WARM_UP_SKIP }} recorded iterations are excluded from best-PA selection as a safety margin for residual transients at the very start of the sweep.</li>
							</ul>
							<div class="text-subtitle-2 mb-1">How the best PA is selected</div>
							<p class="text-body-2 mb-3">The plugin uses a composite score: <code>score = res + 0.5 × |lk − rk|</code>. This adds a small penalty for slope asymmetry so that a symmetric point can edge out an asymmetric one even if the raw res is slightly higher. If the slope-weighted winner differs from the raw res minimum, the Analysis panel will tell you.</p>

							<div class="text-subtitle-2 mb-1">Graph 2 — Slopes (lk / rk)</div>
							<p class="text-body-2">These measure the shape of the pressure transition on each side of the fast section.</p>
							<ul class="text-body-2 mb-3" style="padding-left:20px">
								<li><strong>lk</strong> (left slope) — the pressure build-up going into the fast segment. High values mean the sensor saw a sharp pressure spike.</li>
								<li><strong>rk</strong> (right slope) — the pressure bleed-off coming out of the fast segment.</li>
								<li>At the ideal PA value both slopes should be low and roughly equal. If they diverge significantly across the sweep, your hotend may have a flow asymmetry or temperature gradient.</li>
							</ul>

							<div class="text-subtitle-2 mb-1">Graph 3 — Signal quality (Hk / Ha)</div>
							<p class="text-body-2">These indicate how clearly the sensor saw the pressure event.</p>
							<ul class="text-body-2 mb-3" style="padding-left:20px">
								<li><strong>Hk</strong> — peak signal amplitude on the entry side of the move.</li>
								<li><strong>Ha</strong> — peak signal amplitude on the exit side.</li>
								<li>Values close to 255 mean the sensor got a clean, strong signal. Very low values (below ~30) suggest the sensor didn't register the move clearly — possibly the nozzle was too high, extruder tension was loose, or the move speed was too slow to generate a measurable pressure event.</li>
								<li>These values should be consistent across the sweep. A sudden drop at a specific PA value is usually a measurement artefact rather than a real feature.</li>
							</ul>

							<v-divider class="mb-4" />

							<div class="text-subtitle-1 mb-1"><v-icon size="small" class="mr-1" color="primary">mdi-format-list-numbered</v-icon>Recommended workflow</div>
							<ol class="text-body-2 mb-4" style="padding-left:20px">
								<li class="mb-1"><strong>First run — wide scan.</strong> Use PA start = 0, step = 0.005, steps = 50 (covers 0–0.245). This finds roughly where the optimum is.</li>
								<li class="mb-1"><strong>Check the Analysis panel.</strong> It will tell you whether the result is clean and trustworthy, or whether the data is too noisy to act on. Follow the suggested action — do not assume "zoom in" is always the right move.</li>
								<li class="mb-1"><strong>If the result is noisy — repeat first.</strong> Run the same sweep again. If both runs agree on a similar PA value, that is your answer. Only zoom in once you have a consistent result from a coarser sweep.</li>
								<li class="mb-1"><strong>If the result is clean — zoom in.</strong> Use the <em>Suggested next sweep</em> values — or click <em>Load into Live Run</em> — to refine the result with a finer step around the best value.</li>
								<li class="mb-1"><strong>Apply.</strong> Click <em>Copy M572</em> on the result badge and paste it into your <code>config.g</code>. Or use the saved <code>/sys/pa_result.g</code> file.</li>
								<li class="mb-1"><strong>Re-run when things change.</strong> PA is affected by nozzle temperature, filament brand, print speed, and hotend condition. Re-calibrate after significant changes.</li>
							</ol>

							<v-divider class="mb-4" />

							<div class="text-subtitle-1 mb-1"><v-icon size="small" class="mr-1" color="primary">mdi-lightbulb-outline</v-icon>Analysis panel explained</div>
							<v-table density="compact" class="mb-4">
								<thead><tr><th>Message</th><th>What it means</th><th>Action</th></tr></thead>
								<tbody>
									<tr><td>Low variability (CV &lt; 20%)</td><td>Sweep was consistent — result is reliable.</td><td>Proceed or zoom in.</td></tr>
									<tr><td>Moderate variability (CV 20–40%)</td><td>Some noise. Result is usable.</td><td>A repeat run would improve confidence.</td></tr>
									<tr><td>High noise (CV &gt; 40%)</td><td>The minimum may be a random dip. Sensor or hotend may not be stable.</td><td>Repeat the sweep. Do not zoom in — finer steps make noise worse.</td></tr>
									<tr><td>Best PA near sweep edge</td><td>The optimum may lie outside the tested range.</td><td>Shift the range in the indicated direction first, then zoom in.</td></tr>
									<tr><td>No clear minimum</td><td>Best res is close to the sweep average — no strong signal.</td><td>Repeat at the same settings for a consensus result.</td></tr>
									<tr><td>Clear minimum</td><td>Best point is well below the sweep average — confident result.</td><td>Use as-is, or zoom in for more precision.</td></tr>
									<tr><td>Persistent slope asymmetry</td><td>lk and rk differ consistently across the whole sweep — this is a hotend geometry characteristic (common with HF/short melt-zone designs), not a calibration problem.</td><td>No action needed. The PA value compensates as well as the geometry allows.</td></tr>
									<tr><td>Step size already fine but noisy</td><td>Going finer will not improve the result — noise dominates at this resolution.</td><td>Run a coarser confirmation sweep instead.</td></tr>
								</tbody>
							</v-table>

							<v-divider class="mb-4" />

							<div class="text-subtitle-1 mb-1"><v-icon size="small" class="mr-1" color="primary">mdi-file-document-outline</v-icon>Log files on the Duet SD card</div>
							<v-table density="compact" class="mb-4">
								<thead><tr><th>File</th><th>Contents</th></tr></thead>
								<tbody>
									<tr><td><code>/sys/PA Calibration/pa_YYYYMMDD_HHMMSS.csv</code></td><td>Full log of every iteration: iter, PA, res, lk, rk, Hk, Ha. Each run creates a new timestamped file. Select a log from the picker at the top of the Log Viewer tab.</td></tr>
									<tr><td><code>/sys/PA Calibration/pa_result.g</code></td><td>Single line: <code>M572 D0 S0.042</code> — the best PA value from the last run, ready to paste into config.g.</td></tr>
									<tr><td><code>/sys/pa_live_status.txt</code></td><td>Temporary file written by the macro during a live run. Overwritten each run.</td></tr>
								</tbody>
							</v-table>

							<v-divider class="mb-4" />

							<div class="text-subtitle-1 mb-1"><v-icon size="small" class="mr-1" color="primary">mdi-chip</v-icon>Requirements</div>
							<ul class="text-body-2 mb-4" style="padding-left:20px">
								<li>bd_pressure sensor flashed with <strong>bd_pressure-rrf firmware v2.24+</strong></li>
								<li>RepRapFirmware <strong>3.5+</strong> (standalone Duet, no SBC required)</li>
								<li>Sensor wired to Duet UART (io0 by default) and Z-probe input</li>
								<li>Plugin installed via DWC — the SD card files (<code>/sys/bd_globals.g</code>, <code>/sys/pa_calibrate_live.g</code>, <code>/sys/pa_calibrate.g</code>, and all <code>/macros/bd_*.g</code> files) are deployed automatically when the plugin is installed</li>
								<li>Add <code>M98 P"/sys/bd_globals.g"</code> to <code>config.g</code> so the sensor globals are set on every boot</li>
							</ul>

							<div class="text-caption" style="opacity:0.5">bd_pressure PA Calibration plugin — <a href="https://github.com/jaysuk/bd_pressure_dwc_plugin" target="_blank">github.com/jaysuk/bd_pressure_dwc_plugin</a></div>

						</v-card-text>
					</v-tabs-window-item>

				</v-tabs-window>
			</v-card>
		</v-col>

		<!-- About dialog -->
		<AboutDialog
			v-model="showAbout"
			plugin-id="BdPressurePA"
			title="bd_pressure PA Calibration"
			description="Pressure Advance calibration using the bd_pressure strain-gauge sensor."
			:model="machineStore.model"
			repo="https://github.com/jaysuk/bd_pressure_dwc_plugin"
			:update-available="updateState?.updateAvailable ?? false"
			:latest-version="updateState?.latestVersion"
			:checking="checking"
			:applying="applying"
			:pending-reload="pendingReload"
			:auto-check="autoCheck"
			@check-update="onCheckUpdate"
			@apply-update="applyUpdateNow"
			@toggle-auto-check="onToggleAutoCheck"
		/>
	</v-row>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onActivated, onBeforeUnmount, nextTick } from "vue";
import { Chart, registerables } from "chart.js";
import { useTheme } from "vuetify";
import { AboutDialog } from "dwc-plugin-runtime";

import { useMachineStore } from "@/stores/machine";

import { PLUGIN_MANIFEST_ID, WARM_UP_SKIP, LOG_DIR, STATUS_PATH, POLL_INTERVAL_MS } from "../model/constants";
import { HOTEND_PRESETS, activePreset, hotendPresetItems, type HotendPreset } from "../model/presets";
import { parseStatus, parseLogRows, parseCSV, type LogRow, type LogMeta } from "../model/parse";
import {
	findBest, goodBoundsFor, paDecimalsFor, analyseData, buildChartData,
	type AnalysisResult,
} from "../model/analysis";
import { buildM572, buildStartCommands, buildStopCommand, buildStatusClearCommand, buildRunCommand } from "../model/gcode";
import {
	updateState, checking, applying, pendingReload,
	runUpdateCheck, applyUpdateNow, updateChecksEnabled, setUpdateChecksEnabled,
} from "../model/updateCheck";

Chart.register(...registerables);

// ── Stores ────────────────────────────────────────────────────────────────────
const machineStore = useMachineStore();
const theme = useTheme();

// ── State ─────────────────────────────────────────────────────────────────────
const activeTab     = ref<string>("live");
const hotendPreset  = ref<string>("unknown");
const showAbout     = ref(false);
const autoCheck     = ref(updateChecksEnabled());

const params = ref({
	tool:          0,
	nozzle_temp:   210,
	pa_start:      0.0,
	pa_step:       0.005,
	steps:         50,
	warmup_steps:  8,
	bidirectional: false,
	low_speed:     1020,
	high_speed:    10740,
	travel_speed:  18000,
	z_height:      50,
});

// Live run
const isRunning       = ref(false);
const liveRows        = ref<LogRow[]>([]);
const liveStatus      = ref<ReturnType<typeof parseStatus>>({});
const pollTimer       = ref<ReturnType<typeof setInterval> | null>(null);
const copiedLive      = ref(false);
const lastRunPreset   = ref<HotendPreset | null>(null);
const currentLogPath  = ref<string | null>(null);

// Log viewer
const rows        = ref<LogRow[]>([]);
const meta        = ref<LogMeta>({});
const best        = ref<LogRow | null>(null);
const analysis    = ref<AnalysisResult>({ items: [], nextSweep: null });
const logError    = ref("");
const dragging    = ref(false);
const copied      = ref(false);
const copiedSweep = ref(false);
const logFiles    = ref<Array<{ title: string; value: string }>>([]);
const loadingFiles    = ref(false);
const selectedLogFile = ref<string | null>(null);
const error = ref("");

// Chart refs
const liveChartResEl    = ref<HTMLCanvasElement | null>(null);
const liveChartSlopesEl = ref<HTMLCanvasElement | null>(null);
const liveChartHEl      = ref<HTMLCanvasElement | null>(null);
const chartResEl        = ref<HTMLCanvasElement | null>(null);
const chartSlopesEl     = ref<HTMLCanvasElement | null>(null);
const chartHEl          = ref<HTMLCanvasElement | null>(null);
const fileInputEl       = ref<HTMLInputElement | null>(null);

// Chart instances
let liveChartRes:    Chart | null = null;
let liveChartSlopes: Chart | null = null;
let liveChartH:      Chart | null = null;
let chartRes:        Chart | null = null;
let chartSlopes:     Chart | null = null;
let chartH:          Chart | null = null;

// ── Computed ──────────────────────────────────────────────────────────────────
const pluginVersion = computed(() => {
	const plugins = (machineStore.model as { plugins?: Map<string, { version?: string }> }).plugins;
	return plugins?.get(PLUGIN_MANIFEST_ID)?.version ?? "2.0.0";
});
const presetItems   = computed(() => hotendPresetItems());
const currentPreset = computed(() => activePreset(hotendPreset.value));
const paEnd         = computed(() => params.value.pa_start + (params.value.steps - 1) * params.value.pa_step);

const liveProgress = computed(() => {
	const s = liveStatus.value;
	if (!s.steps) return 0;
	if (s.state === "heating" || s.state === "priming") return 2;
	if (s.state === "warmup") return 4;
	if (s.state === "done") return 100;
	return Math.round(((s.step ?? 0) / s.steps) * 100);
});
const liveBest = computed(() => findBest(liveRows.value));
const hasMetadata   = computed(() => Object.keys(meta.value).length > 0);
const logExtruderIndex = computed(() => {
	const e = parseInt(meta.value.extruder ?? "");
	return isNaN(e) ? 0 : e;
});
const logPaDecimals  = computed(() => paDecimalsFor(rows.value));
const livePaDecimals = computed(() => paDecimalsFor(liveRows.value));

const modelGlobal = computed(() => (machineStore.model as { global?: Map<string, unknown> }).global);
const isDark = computed(() => theme.global.current.value.dark);

// ── Watchers ──────────────────────────────────────────────────────────────────
watch(hotendPreset, (id) => {
	const p = HOTEND_PRESETS.find((x) => x.id === id);
	if (!p || id === "custom" || id === "unknown") return;
	params.value.pa_start = p.pa_start;
	params.value.pa_step  = p.pa_step;
	params.value.steps    = p.steps;
});
watch(modelGlobal, () => {
	if (hotendPreset.value !== "unknown") return;
	readStoredPreset();
});
watch(isDark, () => { applyTheme(); });

// ── Lifecycle ─────────────────────────────────────────────────────────────────
onMounted(() => {
	readStoredPreset();
	void listLogFiles();
});
onActivated(() => {
	readStoredPreset();
	void listLogFiles();
});
onBeforeUnmount(() => {
	stopPolling();
	destroyAllCharts();
});

// ── Methods ───────────────────────────────────────────────────────────────────

function readStoredPreset(): void {
	try {
		const globals = modelGlobal.value;
		const stored = globals instanceof Map ? globals.get("bd_live_hotend_preset") : null;
		if (stored && stored !== "unknown" && HOTEND_PRESETS.find((p) => p.id === stored)) {
			hotendPreset.value = stored as string;
		}
	} catch (_) {}
}

// ── Live run ─────────────────────────────────────────────────────────────────

async function startCalibration(): Promise<void> {
	error.value = "";
	liveRows.value = [];
	liveStatus.value = {};
	currentLogPath.value = null;
	destroyLiveCharts();
	activeTab.value = "live";
	isRunning.value = true;
	lastRunPreset.value = currentPreset.value;
	try {
		const cmds = buildStartCommands(params.value, hotendPreset.value);
		for (const cmd of cmds) {
			await sendGCode(cmd);
		}
		await sendGCode(buildStatusClearCommand());
		await sendGCode(buildRunCommand());
		startPolling();
	} catch (e: unknown) {
		error.value = `Failed to start: ${(e as Error).message || e}`;
		isRunning.value = false;
	}
}

async function stopCalibration(): Promise<void> {
	try { await sendGCode(buildStopCommand()); } catch (_) {}
	stopPolling();
	isRunning.value = false;
	liveStatus.value = { ...liveStatus.value, state: "aborted" };
}

function startPolling(): void {
	pollTimer.value = setInterval(() => { void pollStatus(); }, POLL_INTERVAL_MS);
}
function stopPolling(): void {
	if (pollTimer.value) { clearInterval(pollTimer.value); pollTimer.value = null; }
}

async function pollStatus(): Promise<void> {
	try {
		const text = await downloadFile(STATUS_PATH);
		const status = parseStatus(text);
		if (status.log) currentLogPath.value = status.log as string;
		liveStatus.value = status;
		if (status.state === "done") {
			stopPolling();
			isRunning.value = false;
			await pollLog();
			setTimeout(async () => {
				await loadFromDuet(currentLogPath.value, lastRunPreset.value);
				await listLogFiles();
			}, 1500);
			return;
		}
	} catch (_) {}
	if (liveStatus.value.state === "running" || liveStatus.value.state === "done") {
		await pollLog();
	}
}

async function pollLog(): Promise<void> {
	if (!currentLogPath.value) return;
	try {
		const text = await downloadFile(currentLogPath.value);
		const newRows = parseLogRows(text);
		if (newRows.length > liveRows.value.length) {
			liveRows.value = newRows;
			await nextTick();
			updateLiveCharts();
		}
	} catch (_) {}
}

function copyLiveM572(): void {
	const lb = liveBest.value;
	if (!lb) return;
	navigator.clipboard.writeText(buildM572(0, lb.pa, livePaDecimals.value))
		.then(() => { copiedLive.value = true; });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sendGCode(cmd: string): Promise<unknown> {
	return (machineStore as unknown as { sendCode: (c: string, a: boolean, b: boolean) => Promise<unknown> }).sendCode(cmd, false, false);
}

function downloadFile(path: string): Promise<string> {
	return (machineStore as unknown as {
		download: (opts: { filename: string; type: string }, a: boolean, b: boolean, c: boolean) => Promise<string>;
	}).download({ filename: path, type: "text" }, false, false, false);
}

// ── Log viewer ────────────────────────────────────────────────────────────────

function onFileSelect(e: Event): void {
	const file = (e.target as HTMLInputElement).files?.[0];
	if (file) readFile(file);
	(e.target as HTMLInputElement).value = "";
}
function onFileDrop(e: DragEvent): void {
	dragging.value = false;
	const file = e.dataTransfer?.files[0];
	if (file) readFile(file);
}
function readFile(file: File): void {
	const reader = new FileReader();
	reader.onload = (e) => { applyCSV((e.target as FileReader).result as string, null); };
	reader.onerror = () => { logError.value = "Failed to read file"; };
	reader.readAsText(file);
}

async function listLogFiles(): Promise<void> {
	if (loadingFiles.value) return;
	loadingFiles.value = true;
	try {
		const files = await (machineStore as unknown as {
			getFileList: (dir: string) => Promise<Array<{ isDirectory: boolean; name: string; lastModified?: string | Date }>>;
		}).getFileList(LOG_DIR);
		const csvFiles = files
			.filter((f) => !f.isDirectory && f.name.endsWith(".csv"))
			.sort((a, b) => new Date(b.lastModified ?? 0).getTime() - new Date(a.lastModified ?? 0).getTime());
		logFiles.value = csvFiles.map((f) => {
			const d = f.lastModified ? new Date(f.lastModified) : null;
			const label = d
				? `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
				: f.name;
			return { title: label, value: `${LOG_DIR}/${f.name}` };
		});
	} catch (_) {
		logFiles.value = [];
	} finally {
		loadingFiles.value = false;
	}
}

async function onLogFileSelected(path: string | null): Promise<void> {
	if (!path) return;
	await loadFromDuet(path, null);
}

async function loadFromDuet(path: string | null, preset: HotendPreset | null): Promise<void> {
	logError.value = "";
	const filePath = path ?? (logFiles.value.length ? logFiles.value[0].value : null);
	if (!filePath) {
		logError.value = "No log file selected — run a calibration first.";
		return;
	}
	try {
		const text = await downloadFile(filePath);
		applyCSV(text, preset);
	} catch (e: unknown) {
		logError.value = `Could not fetch log — run a calibration first. (${(e as Error).message || e})`;
	}
}

function applyCSV(text: string, preset: HotendPreset | null): void {
	logError.value = "";
	const result = parseCSV(text);
	if (result.error) { logError.value = result.error; return; }
	const resolvedPreset = preset
		?? (result.meta.hotend_preset ? HOTEND_PRESETS.find((p) => p.id === result.meta.hotend_preset) ?? null : null);
	meta.value     = result.meta;
	rows.value     = result.rows;
	best.value     = findBest(result.rows);
	analysis.value = analyseData(result.rows, best.value, result.meta, paDecimalsFor(result.rows), resolvedPreset);
	activeTab.value = "log";
	void nextTick(() => void nextTick(() => drawLogCharts()));
}

function applyNextSweep(): void {
	if (!analysis.value.nextSweep) return;
	const p = analysis.value.nextSweep.params;
	params.value.pa_start = p.pa_start;
	params.value.pa_step  = p.pa_step;
	params.value.steps    = p.steps;
	activeTab.value = "live";
}

function copyM572(): void {
	const b = best.value;
	if (!b) return;
	navigator.clipboard.writeText(buildM572(logExtruderIndex.value, b.pa, logPaDecimals.value))
		.then(() => { copied.value = true; });
}
function copyNextSweep(): void {
	if (!analysis.value.nextSweep) return;
	navigator.clipboard.writeText(analysis.value.nextSweep.code).then(() => { copiedSweep.value = true; });
}
function clearData(): void {
	destroyLogCharts();
	rows.value = []; meta.value = {}; best.value = null;
	analysis.value = { items: [], nextSweep: null }; logError.value = "";
}

// ── Charts ────────────────────────────────────────────────────────────────────

function themeColors(): { fontColor: string; gridColor: string } {
	const dark = isDark.value;
	return {
		fontColor: dark ? "#fff" : "#444",
		gridColor: dark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.12)",
	};
}

function applyTheme(): void {
	const { fontColor, gridColor } = themeColors();
	const all = [chartRes, chartSlopes, chartH, liveChartRes, liveChartSlopes, liveChartH];
	all.forEach((chart) => {
		if (!chart) return;
		const ticksColor = fontColor;
		if (chart.options.plugins?.legend?.labels) {
			(chart.options.plugins.legend.labels as { color: string }).color = ticksColor;
		}
		["x", "y"].forEach((axis) => {
			const sc = chart.options.scales?.[axis];
			if (sc) {
				if (sc.ticks) (sc.ticks as { color: string }).color = ticksColor;
				if (sc.grid)  (sc.grid  as { color: string }).color = gridColor;
			}
		});
		chart.update();
	});
}

function commonOpts(title: string): object {
	const { fontColor, gridColor } = themeColors();
	return {
		responsive: true,
		maintainAspectRatio: false,
		animation: false,
		plugins: {
			legend: {
				position: "top" as const,
				labels: { boxWidth: 14, font: { size: 11 }, color: fontColor },
			},
			title: { display: true, text: title, font: { size: 12 }, color: fontColor },
		},
		scales: {
			x: {
				ticks: { maxTicksLimit: 20, maxRotation: 45, font: { size: 10 }, color: fontColor },
				grid: { color: gridColor },
			},
			y: {
				ticks: { font: { size: 10 }, color: fontColor },
				grid: { color: gridColor },
			},
		},
	};
}

/** Build a Chart.js v4 plugin that draws the good-zone band and best-PA line. */
function makeOverlayPlugin(
	getBest: () => LogRow | null,
	getGoodBounds: () => { gs: LogRow; ge: LogRow } | null,
	drawZone: boolean,
	getDecimals: () => number,
) {
	return {
		id: "paOverlay",
		afterDraw(chart: Chart) {
			const b = getBest();
			if (!b) return;
			const dp  = getDecimals();
			const ctx = chart.ctx;
			const { top, bottom, left, right } = chart.chartArea;
			const labels = chart.data.labels as string[];

			if (drawZone) {
				const bounds = getGoodBounds();
				if (bounds) {
					const { gs, ge } = bounds;
					const idxL = labels.indexOf(gs.pa.toFixed(dp));
					const idxR = labels.indexOf(ge.pa.toFixed(dp));
					if (idxL >= 0 && idxR >= 0) {
						const m  = chart.getDatasetMeta(0);
						const xL = (m.data[idxL] as { x: number } | undefined)?.x ?? left;
						const xR = (m.data[idxR] as { x: number } | undefined)?.x ?? right;
						ctx.save();
						ctx.fillStyle = "rgba(46,125,50,0.15)";
						ctx.fillRect(xL, top, xR - xL, bottom - top);
						ctx.restore();
					}
				}
			}

			const idx = labels.indexOf(b.pa.toFixed(dp));
			if (idx < 0) return;
			const m = chart.getDatasetMeta(0);
			const ptData = m.data[idx] as { x: number } | undefined;
			if (!ptData) return;
			const x = ptData.x;
			ctx.save();
			ctx.beginPath();
			ctx.strokeStyle = "rgba(211,47,47,0.9)";
			ctx.lineWidth = 2;
			ctx.setLineDash([5, 3]);
			ctx.moveTo(x, top);
			ctx.lineTo(x, bottom);
			ctx.stroke();
			ctx.setLineDash([]);
			ctx.fillStyle = "rgba(211,47,47,0.9)";
			ctx.font = "bold 10px sans-serif";
			const rightHalf = x > (left + right) / 2;
			ctx.textAlign = rightHalf ? "right" : "left";
			ctx.fillText(`best ${b.pa.toFixed(dp)}`, rightHalf ? x - 4 : x + 4, top + 12);
			ctx.restore();
		},
	};
}

function createChartSet(
	els: { res: HTMLCanvasElement; slopes: HTMLCanvasElement; h: HTMLCanvasElement },
	rows: LogRow[],
	getBest: () => LogRow | null,
	titleSuffix: string,
	getRows: () => LogRow[],
): { cRes: Chart; cSlopes: Chart; cH: Chart } {
	const getDp = () => paDecimalsFor(getRows());
	const d = buildChartData(rows, getDp());

	const overlayRes   = makeOverlayPlugin(getBest, () => {
		const b = getBest();
		return b ? goodBoundsFor(getRows(), b) : null;
	}, true, getDp);
	const overlayOther = makeOverlayPlugin(getBest, () => null, false, getDp);

	const cRes = new Chart(els.res, {
		type: "line",
		data: {
			labels: d.pa,
			datasets: [{
				label: "res (lower = better)",
				data: d.res,
				borderColor: "#1565C0",
				backgroundColor: "rgba(21,101,192,0.08)",
				borderWidth: 1.5,
				pointRadius: 2,
				fill: true,
			}],
		},
		options: commonOpts(`Pressure score (res)${titleSuffix}`) as object,
		plugins: [overlayRes],
	});

	const cSlopes = new Chart(els.slopes, {
		type: "line",
		data: {
			labels: d.pa,
			datasets: [
				{ label: "lk (left slope)",  data: d.lk, borderColor: "#2E7D32", backgroundColor: "#2E7D32", borderWidth: 1.5, pointRadius: 2, fill: false },
				{ label: "rk (right slope)", data: d.rk, borderColor: "#7B1FA2", backgroundColor: "#7B1FA2", borderWidth: 1.5, pointRadius: 2, fill: false },
			],
		},
		options: commonOpts(`Slopes (lk / rk)${titleSuffix}`) as object,
		plugins: [overlayOther],
	});

	const hOpts = commonOpts(`Signal quality (Hk / Ha)${titleSuffix}`) as { scales: { y: { min?: number; max?: number } } };
	hOpts.scales.y.min = 0;
	hOpts.scales.y.max = 255;
	const cH = new Chart(els.h, {
		type: "line",
		data: {
			labels: d.pa,
			datasets: [
				{ label: "Hk (left peak)",  data: d.Hk, borderColor: "#00838F", backgroundColor: "#00838F", borderWidth: 1.5, pointRadius: 2, fill: false },
				{ label: "Ha (right peak)", data: d.Ha, borderColor: "#E65100", backgroundColor: "#E65100", borderWidth: 1.5, pointRadius: 2, fill: false },
			],
		},
		options: hOpts as object,
		plugins: [overlayOther],
	});

	return { cRes, cSlopes, cH };
}

function destroyLogCharts(): void {
	[chartRes, chartSlopes, chartH].forEach((c) => { if (c) c.destroy(); });
	chartRes = chartSlopes = chartH = null;
}

function drawLogCharts(): void {
	if (!chartResEl.value || !chartSlopesEl.value || !chartHEl.value) return;
	destroyLogCharts();
	const { cRes, cSlopes, cH } = createChartSet(
		{ res: chartResEl.value, slopes: chartSlopesEl.value, h: chartHEl.value },
		rows.value, () => best.value, "", () => rows.value,
	);
	chartRes = cRes; chartSlopes = cSlopes; chartH = cH;
}

function destroyLiveCharts(): void {
	[liveChartRes, liveChartSlopes, liveChartH].forEach((c) => { if (c) c.destroy(); });
	liveChartRes = liveChartSlopes = liveChartH = null;
}

function updateLiveCharts(): void {
	const r = liveRows.value;
	if (!r.length) return;
	if (!liveChartRes) {
		if (!liveChartResEl.value || !liveChartSlopesEl.value || !liveChartHEl.value) return;
		const { cRes, cSlopes, cH } = createChartSet(
			{ res: liveChartResEl.value, slopes: liveChartSlopesEl.value, h: liveChartHEl.value },
			r, () => liveBest.value, " — live", () => liveRows.value,
		);
		liveChartRes = cRes; liveChartSlopes = cSlopes; liveChartH = cH;
	} else {
		const d = buildChartData(r, livePaDecimals.value);
		liveChartRes.data.labels = d.pa;
		liveChartRes.data.datasets[0].data = d.res;
		liveChartRes.update();

		if (liveChartSlopes) {
			liveChartSlopes.data.labels = d.pa;
			liveChartSlopes.data.datasets[0].data = d.lk;
			liveChartSlopes.data.datasets[1].data = d.rk;
			liveChartSlopes.update();
		}

		if (liveChartH) {
			liveChartH.data.labels = d.pa;
			liveChartH.data.datasets[0].data = d.Hk;
			liveChartH.data.datasets[1].data = d.Ha;
			liveChartH.update();
		}
	}
}

function destroyAllCharts(): void {
	destroyLogCharts();
	destroyLiveCharts();
}

// ── About / update handlers ───────────────────────────────────────────────────

function onCheckUpdate(): void { void runUpdateCheck({ force: true, notify: true }); }
function onToggleAutoCheck(v: boolean): void { autoCheck.value = v; setUpdateChecksEnabled(v); }
</script>
