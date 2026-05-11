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
		<v-col v-show="activeTab === 0" cols="12" md="2" class="params-panel pa-3" style="overflow-y:auto;max-height:calc(100vh - 120px)">
			<div class="subtitle-2 mb-2">
				<v-icon small left>mdi-tune</v-icon>Parameters
			</div>

			<div class="param-section-title">Hotend</div>
			<v-select
				v-model="hotendPreset"
				:items="hotendPresetItems"
				dense outlined hide-details
				label="Hotend type"
				class="mb-1"
				:disabled="isRunning"
			/>
			<div v-if="activePreset.note" class="caption mb-3" style="opacity:0.55;line-height:1.3">
				{{ activePreset.note }}
			</div>
			<div v-else class="mb-3" />

			<div class="param-section-title">Tool</div>
			<v-text-field :value="params.tool"        @change="v => params.tool        = parseInt(v)   || 0"     dense outlined hide-details label="Tool #"     inputmode="numeric"  class="mb-2" :disabled="isRunning" />
			<v-text-field :value="params.extruder"    @change="v => params.extruder    = parseInt(v)   || 0"     dense outlined hide-details label="Extruder #" inputmode="numeric"  class="mb-2" :disabled="isRunning" />

			<div class="param-section-title">Temperature</div>
			<v-text-field :value="params.nozzle_temp" @change="v => params.nozzle_temp = parseInt(v)   || 210"   dense outlined hide-details label="Nozzle"     inputmode="numeric"  class="mb-2" :disabled="isRunning" suffix="°C" />

			<div class="param-section-title">PA sweep</div>
			<v-text-field :value="params.pa_start"    @change="v => { params.pa_start    = parseFloat(v) || 0;     hotendPreset = 'custom' }" dense outlined hide-details label="PA start"      inputmode="decimal"  class="mb-2" :disabled="isRunning" />
			<v-text-field :value="params.pa_step"     @change="v => { params.pa_step     = parseFloat(v) || 0.005; hotendPreset = 'custom' }" dense outlined hide-details label="PA step"       inputmode="decimal"  class="mb-2" :disabled="isRunning" />
			<v-text-field :value="params.steps"       @change="v => { params.steps       = parseInt(v)   || 50;    hotendPreset = 'custom' }" dense outlined hide-details label="Steps"          inputmode="numeric"  class="mb-2" :disabled="isRunning" />
			<v-text-field :value="params.warmup_steps" @change="v => params.warmup_steps = parseInt(v)   || 0"                               dense outlined hide-details label="Warm-up passes" inputmode="numeric"  class="mb-2" :disabled="isRunning" />
			<div class="caption mb-3" style="opacity:0.6">
				Range: {{ params.pa_start.toFixed(livePaDecimals) }} – {{ paEnd.toFixed(livePaDecimals) }}
			</div>

			<div class="param-section-title">Speeds (mm/min)</div>
			<v-text-field :value="params.low_speed"    @change="v => params.low_speed    = parseInt(v) || 1020"  dense outlined hide-details label="Slow"   inputmode="numeric" class="mb-2" :disabled="isRunning" />
			<v-text-field :value="params.high_speed"   @change="v => params.high_speed   = parseInt(v) || 10740" dense outlined hide-details label="Fast"   inputmode="numeric" class="mb-2" :disabled="isRunning" />
			<v-text-field :value="params.travel_speed" @change="v => params.travel_speed = parseInt(v) || 18000" dense outlined hide-details label="Travel" inputmode="numeric" class="mb-2" :disabled="isRunning" />

			<div class="param-section-title">Z height</div>
			<v-text-field :value="params.z_height"    @change="v => params.z_height     = parseFloat(v) || 50"   dense outlined hide-details label="Z"       inputmode="decimal" class="mb-3" :disabled="isRunning" suffix="mm" />

			<v-divider class="mb-3" />

			<v-alert v-if="hotendPreset === 'unknown'" type="info" dense class="mb-2 caption">
				Select a hotend type above to enable calibration.
			</v-alert>
			<v-btn block color="success" :disabled="isRunning || hotendPreset === 'unknown'" @click="startCalibration" class="mb-2">
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
					<span v-else-if="liveStatus.state === 'warmup'">Warm-up ({{ liveStatus.warmup }} passes at PA=0)…</span>
					<span v-else-if="liveStatus.state === 'running'">
						Step {{ liveStatus.step }} / {{ liveStatus.steps }}<br>
						<span style="opacity:0.7">PA {{ (liveStatus.pa || 0).toFixed(livePaDecimals) }}</span>
					</span>
					<span v-else-if="liveStatus.state === 'done'">
						<v-icon small color="success">mdi-check-circle</v-icon>
						Done — best PA {{ (liveStatus.best_pa || 0).toFixed(livePaDecimals) }}
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
					<v-chip x-small class="ml-2" color="blue-grey darken-3" text-color="white">v1.1.0</v-chip>
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
					<v-tab>
						<v-icon left small>mdi-help-circle-outline</v-icon>Help
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
								<span class="best-badge">Best PA so far = {{ liveBest.pa.toFixed(livePaDecimals) }}</span>
								&nbsp;—&nbsp; res={{ liveBest.res }}, lk={{ liveBest.lk }}, rk={{ liveBest.rk }}
								<v-btn v-if="liveStatus.state === 'done'" small outlined class="ml-3" color="white" @click="copyLiveM572">
									<v-icon left small>mdi-content-copy</v-icon>
									Copy M572 D{{ params.extruder }} S{{ liveBest.pa.toFixed(livePaDecimals) }}
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
									<v-chip v-if="meta.hotend_preset && meta.hotend_preset !== 'custom'" small class="meta-chip" color="indigo darken-2" text-color="white">
										<v-icon left x-small>mdi-printer-3d-nozzle</v-icon>{{ meta.hotend_preset }}
									</v-chip>
								</div>

								<v-alert type="success" dense class="mb-3" v-if="best">
									<span class="best-badge">Best PA = {{ best.pa.toFixed(logPaDecimals) }}</span>
									&nbsp;—&nbsp; res={{ best.res }}&nbsp; lk={{ best.lk }}&nbsp; rk={{ best.rk }}&nbsp; Hk={{ best.Hk }}&nbsp; Ha={{ best.Ha }}
									<v-btn small outlined class="ml-3" color="white" @click="copyM572">
										<v-icon left small>mdi-content-copy</v-icon>
										Copy M572 D{{ logExtruderIndex }} S{{ best.pa.toFixed(logPaDecimals) }}
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
														<td>{{ r.iter }}</td><td>{{ r.pa.toFixed(logPaDecimals) }}</td><td>{{ r.res }}</td>
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

					<!-- ============================================================
					     TAB 2 — HELP
					     ============================================================ -->
					<v-tab-item>
						<v-card-text class="pt-2" style="max-width:860px">

							<div class="title mb-1">bd_pressure PA Calibration — Help</div>
							<div class="body-2 mb-4" style="opacity:0.7">Pressure Advance calibration using the bd_pressure strain-gauge sensor</div>

							<v-divider class="mb-4" />

							<!-- What is Pressure Advance -->
							<div class="subtitle-1 mb-1"><v-icon small left color="primary">mdi-information-outline</v-icon>What is Pressure Advance?</div>
							<p class="body-2">When an extruder pushes filament, the melt zone and bowden tube act like a spring — pressure builds up on acceleration and bleeds off on deceleration. This causes blobs at corners and gaps after them. Pressure Advance (PA) adds a small extra push on the way into a move and a small retraction on the way out, cancelling the effect. Getting the value right matters: too low leaves blobs, too high leaves gaps or ringing.</p>
							<p class="body-2 mb-4">Traditional PA tuning requires printing a test pattern and measuring it by eye. This plugin calibrates PA automatically by measuring extruder back-pressure directly with the bd_pressure sensor — no test prints needed.</p>

							<v-divider class="mb-4" />

							<!-- How calibration works -->
							<div class="subtitle-1 mb-1"><v-icon small left color="primary">mdi-cog-outline</v-icon>How calibration works</div>
							<p class="body-2">The macro raises the nozzle to a safe Z height and makes a series of short extrusion moves: slow → fast → slow. This is repeated once per PA value across the sweep range you set. On each pass the bd_pressure sensor measures how well the pressure transients are compensated and returns five scores. The plugin plots all of these so you can see not just the winner but the shape of the whole response.</p>
							<p class="body-2 mb-1">The sequence for each step is:</p>
							<ol class="body-2 mb-4" style="padding-left:20px">
								<li>Set PA to the next value in the sweep</li>
								<li>Move slow for 15 mm (ramp-up)</li>
								<li>Move fast for 30 mm (high-speed section)</li>
								<li>Move slow for 15 mm (ramp-down)</li>
								<li>Read all five scores from the sensor</li>
							</ol>

							<v-divider class="mb-4" />

							<!-- Parameters -->
							<div class="subtitle-1 mb-1"><v-icon small left color="primary">mdi-tune</v-icon>Parameter guide</div>
							<p class="body-2 mb-2">Select your hotend type to automatically set a sensible PA sweep range and enable range checking in the Analysis panel. You can adjust any value afterwards — changing PA start, step, or steps will switch the selector back to <em>Custom</em>. The Start button is disabled until a hotend type is selected.</p>
							<v-simple-table dense class="mb-3">
								<thead><tr><th>Hotend type</th><th>Typical PA range</th><th>Step</th><th>Examples</th></tr></thead>
								<tbody>
									<tr><td><strong>Short melt zone</strong></td><td>0 – 0.10</td><td>0.002</td><td>E3D Revo (all variants), Slice Mosquito, Phaetus Dragon HF</td></tr>
									<tr><td><strong>Standard</strong></td><td>0 – 0.25</td><td>0.005</td><td>E3D V6, Dragon ST, Rapido HF (v1/v2), Dragonfly, Bambu X1/P1/A1, Creality Spider</td></tr>
									<tr><td><strong>High flow / long melt zone</strong></td><td>0 – 0.25</td><td>0.005</td><td>E3D Volcano, Rapido UHF, Dragon UHF, VzBot Goliath (50 mm melt zone), Mosquito Magnum+</td></tr>
									<tr><td><strong>Bowden</strong></td><td>0.3 – 1.5</td><td>0.02</td><td>Any hotend with a Bowden tube — tube length matters more than hotend type</td></tr>
									<tr><td><strong>Custom</strong></td><td>—</td><td>—</td><td>Manual entry, no range checking</td></tr>
								</tbody>
							</v-simple-table>
							<p class="body-2 mb-2">If you are unsure, use <em>Standard</em> — it covers the most common PA range and the Analysis panel will flag if the result looks unexpectedly high or low.</p>
							<p class="body-2 mb-4">To avoid selecting your hotend type every session, uncomment the two lines in <code>/sys/bd_globals.g</code> and set your preset value — the plugin reads the stored value automatically on load.</p>

							<v-simple-table dense class="mb-4">
								<thead><tr><th>Parameter</th><th>What it does</th><th>Suggested starting point</th></tr></thead>
								<tbody>
									<tr><td><strong>Tool #</strong></td><td>Which tool to heat and calibrate (T0, T1 …)</td><td>0 for single-tool printers</td></tr>
									<tr><td><strong>Extruder #</strong></td><td>Which extruder index to pass to M572 (usually matches Tool #)</td><td>0</td></tr>
									<tr><td><strong>Nozzle temp</strong></td><td>Temperature to heat to before calibrating. Use your normal printing temperature for the filament you want to tune.</td><td>Your usual print temp</td></tr>
									<tr><td><strong>PA start</strong></td><td>The lowest PA value to test. Start at 0 for a first run.</td><td>0.0 (set automatically by hotend preset)</td></tr>
									<tr><td><strong>PA step</strong></td><td>How much to increase PA between each iteration. Smaller = finer resolution but longer run time.</td><td>Set automatically by hotend preset</td></tr>
									<tr><td><strong>Steps</strong></td><td>Number of iterations. Range covered = PA start + (steps−1) × step.</td><td>50</td></tr>
									<tr><td><strong>Warm-up passes</strong></td><td>Number of extrusion passes at PA=0 run before the sweep begins. These stabilise the hotend and sensor but are not recorded in the log. Set to 0 to skip.</td><td>5</td></tr>
									<tr><td><strong>Slow speed</strong></td><td>Speed for the ramp sections (mm/min). Lower = more sensitive to PA.</td><td>1020 (17 mm/s)</td></tr>
									<tr><td><strong>Fast speed</strong></td><td>Speed for the high-speed section (mm/min). Should be close to your normal print speed.</td><td>10740 (179 mm/s)</td></tr>
									<tr><td><strong>Travel speed</strong></td><td>Speed to move between lines (mm/min).</td><td>18000</td></tr>
									<tr><td><strong>Z height</strong></td><td>How high to lift the nozzle during calibration (mm). Must clear any probes or fans.</td><td>50</td></tr>
								</tbody>
							</v-simple-table>

							<v-divider class="mb-4" />

							<!-- Graph guide -->
							<div class="subtitle-1 mb-2"><v-icon small left color="primary">mdi-chart-line</v-icon>Understanding the graphs</div>

							<div class="subtitle-2 mb-1">Graph 1 — Pressure score (res)</div>
							<p class="body-2">This is the primary result. <strong>Lower is better</strong> — res measures how far from ideal the pressure profile was during that extrusion move. The algorithm inside the bd_pressure sensor computes this from the raw strain data.</p>
							<ul class="body-2 mb-3" style="padding-left:20px">
								<li>The <strong>red dashed vertical line</strong> marks the recommended PA value — selected using a composite score that combines res with a slope-symmetry penalty (see below).</li>
								<li>The <strong>green shaded band</strong> covers the contiguous range of PA values around the best point whose composite score stays within 20% of the minimum. Any value in this band will perform similarly well in practice. A wide band means the printer is forgiving; a narrow band means precision matters.</li>
								<li>The first {{ warmUpSkip }} recorded iterations are excluded from best-PA selection as a safety margin for residual transients at the very start of the sweep.</li>
							</ul>
							<div class="subtitle-2 mb-1">How the best PA is selected</div>
							<p class="body-2 mb-3">The plugin uses a composite score: <code>score = res + 0.5 × |lk − rk|</code>. This adds a small penalty for slope asymmetry so that a symmetric point can edge out an asymmetric one even if the raw res is slightly higher. If the slope-weighted winner differs from the raw res minimum, the Analysis panel will tell you.</p>

							<div class="subtitle-2 mb-1">Graph 2 — Slopes (lk / rk)</div>
							<p class="body-2">These measure the shape of the pressure transition on each side of the fast section.</p>
							<ul class="body-2 mb-3" style="padding-left:20px">
								<li><strong>lk</strong> (left slope) — the pressure build-up going into the fast segment. High values mean the sensor saw a sharp pressure spike.</li>
								<li><strong>rk</strong> (right slope) — the pressure bleed-off coming out of the fast segment.</li>
								<li>At the ideal PA value both slopes should be low and roughly equal. If they diverge significantly across the sweep, your hotend may have a flow asymmetry or temperature gradient.</li>
							</ul>

							<div class="subtitle-2 mb-1">Graph 3 — Signal quality (Hk / Ha)</div>
							<p class="body-2">These indicate how clearly the sensor saw the pressure event.</p>
							<ul class="body-2 mb-3" style="padding-left:20px">
								<li><strong>Hk</strong> — peak signal amplitude on the entry side of the move.</li>
								<li><strong>Ha</strong> — peak signal amplitude on the exit side.</li>
								<li>Values close to 255 mean the sensor got a clean, strong signal. Very low values (below ~30) suggest the sensor didn't register the move clearly — possibly the nozzle was too high, extruder tension was loose, or the move speed was too slow to generate a measurable pressure event.</li>
								<li>These values should be consistent across the sweep. A sudden drop at a specific PA value is usually a measurement artefact rather than a real feature.</li>
							</ul>

							<v-divider class="mb-4" />

							<!-- Workflow -->
							<div class="subtitle-1 mb-1"><v-icon small left color="primary">mdi-format-list-numbered</v-icon>Recommended workflow</div>
							<ol class="body-2 mb-4" style="padding-left:20px">
								<li class="mb-1"><strong>First run — wide scan.</strong> Use PA start = 0, step = 0.005, steps = 50 (covers 0–0.245). This finds roughly where the optimum is.</li>
								<li class="mb-1"><strong>Check the Analysis panel.</strong> It will tell you whether the result is clean and trustworthy, or whether the data is too noisy to act on. Follow the suggested action — do not assume "zoom in" is always the right move.</li>
								<li class="mb-1"><strong>If the result is noisy — repeat first.</strong> Run the same sweep again. If both runs agree on a similar PA value, that is your answer. Only zoom in once you have a consistent result from a coarser sweep.</li>
								<li class="mb-1"><strong>If the result is clean — zoom in.</strong> Use the <em>Suggested next sweep</em> values — or click <em>Load into Live Run</em> — to refine the result with a finer step around the best value.</li>
								<li class="mb-1"><strong>Apply.</strong> Click <em>Copy M572</em> on the result badge and paste it into your <code>config.g</code>. Or use the saved <code>/sys/pa_result.g</code> file.</li>
								<li class="mb-1"><strong>Re-run when things change.</strong> PA is affected by nozzle temperature, filament brand, print speed, and hotend condition. Re-calibrate after significant changes.</li>
							</ol>

							<v-divider class="mb-4" />

							<!-- Analysis panel -->
							<div class="subtitle-1 mb-1"><v-icon small left color="primary">mdi-lightbulb-outline</v-icon>Analysis panel explained</div>
							<v-simple-table dense class="mb-4">
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
							</v-simple-table>

							<v-divider class="mb-4" />

							<!-- Log files -->
							<div class="subtitle-1 mb-1"><v-icon small left color="primary">mdi-file-document-outline</v-icon>Log files on the Duet SD card</div>
							<v-simple-table dense class="mb-4">
								<thead><tr><th>File</th><th>Contents</th></tr></thead>
								<tbody>
									<tr><td><code>/sys/pa_calibrate_log.txt</code></td><td>Full log of every iteration: iter, PA, res, lk, rk, Hk, Ha. Load this in the Log Viewer tab.</td></tr>
									<tr><td><code>/sys/pa_result.g</code></td><td>Single line: <code>M572 D0 S0.042</code> — the best PA value ready to paste into config.g.</td></tr>
									<tr><td><code>/sys/pa_live_status.txt</code></td><td>Temporary file written by the macro during a live run. Overwritten each run.</td></tr>
								</tbody>
							</v-simple-table>

							<v-divider class="mb-4" />

							<!-- Requirements -->
							<div class="subtitle-1 mb-1"><v-icon small left color="primary">mdi-chip</v-icon>Requirements</div>
							<ul class="body-2 mb-4" style="padding-left:20px">
								<li>bd_pressure sensor flashed with <strong>bd_pressure-rrf firmware v2.24+</strong></li>
								<li>RepRapFirmware <strong>3.5+</strong> (standalone Duet, no SBC required)</li>
								<li><code>/sys/bd_globals.g</code> called from <code>config.g</code> on startup</li>
								<li>Sensor wired to Duet UART (io0 by default) and Z-probe input</li>
							</ul>

							<div class="caption" style="opacity:0.5">bd_pressure PA Calibration plugin — <a href="https://github.com/jaysuk/bd_pressure_dwc_plugin" target="_blank">github.com/jaysuk/bd_pressure_dwc_plugin</a></div>

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
const STATUS_PATH     = '0:/sys/pa_live_status.txt'
const WARM_UP_SKIP    = 2
const SLOPE_ASYM_PENALTY = 0.5   // added to composite score per unit |lk - rk|
const POLL_INTERVAL_MS = 2000

// Hotend presets — sweep parameters + expected PA range for analysis
// pa_max is a soft ceiling used to warn if the result looks unexpectedly high/low
const HOTEND_PRESETS = [
	{
		id: 'unknown',
		label: '— Select hotend type —',
		group: null,
		pa_start: 0, pa_step: 0.005, steps: 50,
		pa_min_expected: 0, pa_max_expected: null,
		note: null,
	},
	{
		id: 'custom',
		label: 'Custom',
		group: null,
		pa_start: 0, pa_step: 0.005, steps: 50,
		pa_min_expected: 0, pa_max_expected: null,
		note: null,
	},
	// ── Short melt zone ────────────────────────────────────────────────────────
	// Fast pressure response; shallow/noisy res curves are normal; PA typically low
	{
		id: 'short',
		label: 'Short melt zone',
		group: 'Short melt zone',
		pa_start: 0, pa_step: 0.002, steps: 50,
		pa_min_expected: 0, pa_max_expected: 0.10,
		note: 'E3D Revo (all variants), Slice Mosquito, Phaetus Dragon HF, Mellow NF-Crazy',
	},
	// ── Standard ───────────────────────────────────────────────────────────────
	// Most direct-drive setups; well-defined minimum typical
	{
		id: 'standard',
		label: 'Standard',
		group: 'Standard',
		pa_start: 0, pa_step: 0.005, steps: 50,
		pa_min_expected: 0.02, pa_max_expected: 0.18,
		note: 'E3D V6, Phaetus Dragon ST, Rapido HF (v1/v2), Dragonfly BMO/BMS, Creality Spider, Bambu X1/P1/A1, Mellow NF-Crazy (high flow), Slice Mosquito Magnum',
	},
	// ── High flow / long melt zone ─────────────────────────────────────────────
	// Slower pressure response; wider sweep needed; higher PA typical
	{
		id: 'highflow',
		label: 'High flow / long melt zone',
		group: 'High flow / long melt zone',
		pa_start: 0, pa_step: 0.005, steps: 50,
		pa_min_expected: 0.04, pa_max_expected: 0.30,
		note: 'E3D Volcano, Phaetus Rapido UHF (v1/v2), Dragon UHF, Goliath (VzBot/Mellow, 50 mm melt zone), Slice Mosquito Magnum+, Bondtech CHT bi-metal',
	},
	// ── Bowden ────────────────────────────────────────────────────────────────
	// Tube compliance dominates; PA an order of magnitude higher than direct drive
	{
		id: 'bowden',
		label: 'Bowden',
		group: 'Bowden',
		pa_start: 0.3, pa_step: 0.02, steps: 50,
		pa_min_expected: 0.3, pa_max_expected: 1.5,
		note: 'Any hotend with a Bowden tube. Tube length and inner diameter matter more than hotend type.',
	},
]

export default {
	name: 'PaCalibration',

	data() {
		return {
			activeTab: 0,

			hotendPreset: 'unknown',

			params: {
				tool:          0,
				extruder:      0,
				nozzle_temp:   210,
				pa_start:      0.0,
				pa_step:       0.005,
				steps:         50,
				warmup_steps:  5,
				low_speed:     1020,
				high_speed:    10740,
				travel_speed:  18000,
				z_height:      50,
			},

			// live run
			isRunning:      false,
			liveRows:       [],
			liveStatus:     {},
			pollTimer:      null,
			copiedLive:     false,
			lastRunPreset:  null,
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
		hotendPresetItems() {
			// Build v-select items with group headers
			const items = []
			let lastGroup = undefined
			for (const p of HOTEND_PRESETS) {
				if (p.group !== lastGroup) {
					if (p.group) items.push({ header: p.group })
					lastGroup = p.group
				}
				items.push({ text: p.label, value: p.id })
			}
			return items
		},
		activePreset() {
			return HOTEND_PRESETS.find(p => p.id === this.hotendPreset) || HOTEND_PRESETS[0]
		},
		paEnd() {
			return this.params.pa_start + (this.params.steps - 1) * this.params.pa_step
		},
		liveProgress() {
			if (!this.liveStatus.steps) return 0
			if (this.liveStatus.state === 'heating' || this.liveStatus.state === 'priming') return 2
			if (this.liveStatus.state === 'warmup') return 4
			if (this.liveStatus.state === 'done') return 100
			return Math.round((this.liveStatus.step / this.liveStatus.steps) * 100)
		},
		liveBest() {
			const active = this.liveRows.filter(r => r.iter >= WARM_UP_SKIP && r.res > 0)
			if (!active.length) return null
			return active.reduce((a, b) => this.compositeScore(b) < this.compositeScore(a) ? b : a)
		},
		hasMetadata() {
			return Object.keys(this.meta).length > 0
		},
		logExtruderIndex() {
			const e = parseInt(this.meta.extruder)
			return isNaN(e) ? 0 : e
		},
		// Decimal places needed to distinguish consecutive PA labels,
		// derived from the step size in the data. Minimum 4, max 7.
		logPaDecimals() {
			return this.paDecimalsFor(this.rows)
		},
		livePaDecimals() {
			return this.paDecimalsFor(this.liveRows)
		},
		warmUpSkip() { return WARM_UP_SKIP },
		...mapState('settings', ['darkTheme']),
	},

	watch: {
		darkTheme(dark) { this.applyTheme(dark) },
		hotendPreset(id) {
			const p = HOTEND_PRESETS.find(x => x.id === id)
			if (!p || id === 'custom' || id === 'unknown') return
			this.params.pa_start = p.pa_start
			this.params.pa_step  = p.pa_step
			this.params.steps    = p.steps
		},
	},

	mounted() {
		// Pre-select hotend preset if the user has configured a persistent default
		// in bd_globals.g (global.bd_live_hotend_preset will already be in the model)
		try {
			const globals = this.$store.state['machine/model'].global
			const stored  = globals instanceof Map ? globals.get('bd_live_hotend_preset') : null
			if (stored && stored !== 'unknown' && HOTEND_PRESETS.find(p => p.id === stored)) {
				this.hotendPreset = stored
			}
		} catch (_) {}
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
			this.lastRunPreset = this.activePreset

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
				await this.sendGCode(`set global.bd_live_warmup_steps = ${p.warmup_steps}`)
				await this.sendGCode(`set global.bd_live_hotend_preset = "${this.hotendPreset}"`)
				await this.sendGCode(`set global.bd_live_low_speed = ${p.low_speed}`)
				await this.sendGCode(`set global.bd_live_high_speed = ${p.high_speed}`)
				await this.sendGCode(`set global.bd_live_travel_speed = ${p.travel_speed}`)
				await this.sendGCode(`set global.bd_live_z_height = ${p.z_height}`)

				// Clear any stale status file so polling can't mistake a previous run as done
				await this.sendGCode('echo >"0:/sys/pa_live_status.txt" "state=starting"')

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

		parseStatus(text) {
			// Parses "key=value key=value ..." lines written by the macro
			const obj = {}
			for (const pair of text.trim().split(/\s+/)) {
				const eq = pair.indexOf('=')
				if (eq > 0) obj[pair.slice(0, eq)] = pair.slice(eq + 1)
			}
			if (obj.step)     obj.step     = parseInt(obj.step)
			if (obj.steps)    obj.steps    = parseInt(obj.steps)
			if (obj.warmup)   obj.warmup   = parseInt(obj.warmup)
			if (obj.pa)       obj.pa       = parseFloat(obj.pa)
			if (obj.best_pa)  obj.best_pa  = parseFloat(obj.best_pa)
			if (obj.best_res) obj.best_res = parseInt(obj.best_res)
			return obj
		},

		async pollStatus() {
			try {
				const text = await this.downloadFile(STATUS_PATH)
				const status = this.parseStatus(text)
				this.liveStatus = status
				if (status.state === 'done') {
					this.stopPolling()
					this.isRunning = false
					await this.pollLog()
					setTimeout(async () => {
						await this.loadFromDuet(this.lastRunPreset)
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
			navigator.clipboard.writeText(`M572 D${this.params.extruder} S${this.liveBest.pa.toFixed(livePaDecimals)}`)
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
		async loadFromDuet(preset) {
			this.fetching = true
			this.logError = ''
			try {
				const text = await this.downloadFile(LOG_PATH)
				this.parseCSV(text, preset || null)
				this.activeTab = 1
			} catch (e) {
				this.logError = `Could not fetch log — run a calibration first. (${e.message || e})`
			} finally {
				this.fetching = false
			}
		},

		parseCSV(text, preset) {
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
			// Resolve preset: prefer explicitly passed preset (live run), then
			// fall back to hotend_preset recorded in the log header itself
			const resolvedPreset = preset ||
				(meta.hotend_preset ? HOTEND_PRESETS.find(p => p.id === meta.hotend_preset) : null) ||
				null
			this.meta = meta
			this.rows = parsed
			this.best = this.findBest(parsed)
			this.analysis = this.analyseData(parsed, this.best, meta, this.paDecimalsFor(parsed), resolvedPreset)
			this.$nextTick(() => this.drawLogCharts())
		},

		compositeScore(r) {
			// Penalise slope asymmetry so a symmetric point can win over a slightly lower res
			return r.res + SLOPE_ASYM_PENALTY * Math.abs(r.lk - r.rk)
		},

		findBest(rows) {
			const candidates = rows.filter(r => r.iter >= WARM_UP_SKIP && r.res > 0)
			if (!candidates.length) return null
			return candidates.reduce((a, b) => this.compositeScore(b) < this.compositeScore(a) ? b : a)
		},

		analyseData(rows, best, meta, dp, preset) {
			dp = dp || 4
			const items = []
			const active = rows.filter(r => r.iter >= WARM_UP_SKIP && r.res > 0)
			if (!active.length || !best) return { items, nextSweep: null }
			const resVals  = active.map(r => r.res)
			const paVals   = active.map(r => r.pa)
			const n        = active.length
			const mean     = resVals.reduce((a, b) => a + b, 0) / n
			const variance = resVals.reduce((s, v) => s + (v - mean) ** 2, 0) / n
			const stddev   = Math.sqrt(variance)
			const cvPct    = mean > 0 ? (stddev / mean) * 100 : 0
			const paMin    = paVals[0], paMax = paVals[paVals.length - 1], paRange = paMax - paMin
			const step     = meta.pa_step ? parseFloat(meta.pa_step) : null
			const bestIdx  = active.findIndex(r => r.iter === best.iter)
			const edgeFrac = paRange > 0 ? Math.min((best.pa - paMin) / paRange, (paMax - best.pa) / paRange) : 0.5

			// --- Hotend preset range check ---
			if (preset && preset.id !== 'custom' && preset.pa_max_expected !== null) {
				if (best.pa > preset.pa_max_expected) {
					items.push({ icon: 'mdi-alert-circle-outline', color: 'orange',
						text: `Best PA (${best.pa.toFixed(dp)}) is higher than typical for a ${preset.group} hotend (expected up to ${preset.pa_max_expected}). Check your hotend selection is correct, or widen the sweep range to confirm there is no lower minimum at a lower PA value.` })
				} else if (preset.pa_min_expected > 0 && best.pa < preset.pa_min_expected) {
					items.push({ icon: 'mdi-information-outline', color: 'yellow',
						text: `Best PA (${best.pa.toFixed(dp)}) is lower than typical for a ${preset.group} hotend (usually above ${preset.pa_min_expected}). The result may be valid — check the sweep started from PA=0 to rule out a missed minimum.` })
				}
			}

			// --- Variability / noise assessment ---
			// noisy = the minimum is likely just a random dip, not a real signal
			const noisy = cvPct > 30
			if (cvPct > 40)
				items.push({ icon: 'mdi-alert-outline', color: 'orange',
					text: `High noise in res scores (CV ${cvPct.toFixed(0)}%). The minimum may be a random dip rather than a real PA optimum. Repeat the sweep to confirm, or check the sensor is firmly mounted and the nozzle has fully stabilised.` })
			else if (cvPct > 20)
				items.push({ icon: 'mdi-information-outline', color: 'yellow',
					text: `Moderate variability (CV ${cvPct.toFixed(0)}%). The result is usable but a second run would improve confidence.` })
			else
				items.push({ icon: 'mdi-check-circle-outline', color: 'green',
					text: `Low variability (CV ${cvPct.toFixed(0)}%) — sweep conditions were consistent.` })

			// --- Range / edge check ---
			if (edgeFrac < 0.15) {
				const dir = best.pa - paMin < paMax - best.pa ? 'lower' : 'higher'
				items.push({ icon: 'mdi-alert-circle-outline', color: 'orange',
					text: `Best PA (${best.pa.toFixed(dp)}) is near the sweep edge — the true optimum may be ${dir}. Shift the range before zooming in.` })
			} else if (edgeFrac < 0.25) {
				items.push({ icon: 'mdi-information-outline', color: 'yellow',
					text: `Best PA (${best.pa.toFixed(dp)}) is close to one edge — consider a follow-up centred on this value.` })
			} else {
				items.push({ icon: 'mdi-check-circle-outline', color: 'green',
					text: `Best PA (${best.pa.toFixed(dp)}) is well within the sweep range.` })
			}

			// --- Minimum sharpness ---
			// Compare best res against the mean of the whole active set.
			// A clear minimum sits well below the mean; a noisy plateau does not.
			const separationPct = mean > 0 ? ((mean - best.res) / mean) * 100 : 0
			const clearMinimum  = separationPct > 25   // best is >25% below the sweep mean
			if (!clearMinimum)
				items.push({ icon: 'mdi-information-outline', color: 'yellow',
					text: `The res curve has no clear minimum (best res is only ${separationPct.toFixed(0)}% below the sweep average). The recommended PA is the best available from this data but should be treated as approximate.` })
			else
				items.push({ icon: 'mdi-check-circle-outline', color: 'green',
					text: `Clear minimum — best res is ${separationPct.toFixed(0)}% below the sweep average.` })

			// --- Slope asymmetry ---
			const lkMean = active.reduce((s, r) => s + r.lk, 0) / n
			const rkMean = active.reduce((s, r) => s + r.rk, 0) / n
			if (lkMean > 0 && rkMean > 0) {
				const asymRatio = Math.abs(lkMean - rkMean) / Math.max(lkMean, rkMean)
				if (asymRatio > 0.4)
					items.push({ icon: 'mdi-swap-horizontal', color: 'orange',
						text: `Persistent slope asymmetry across the sweep (lk avg ${lkMean.toFixed(1)}, rk avg ${rkMean.toFixed(1)}). This is a hotend characteristic — often seen with short melt-zone designs (e.g. HF/HV nozzles) — rather than a calibration problem. The recommended PA compensates as well as possible for this geometry.` })
				else
					items.push({ icon: 'mdi-check-circle-outline', color: 'green',
						text: `Slopes are reasonably symmetric (lk avg ${lkMean.toFixed(1)}, rk avg ${rkMean.toFixed(1)}).` })
			}

			// --- Composite score note ---
			const rawBest = active.reduce((a, b) => b.res < a.res ? b : a)
			if (rawBest.iter !== best.iter) {
				items.push({ icon: 'mdi-information-outline', color: 'blue',
					text: `Slope-weighted scoring selected PA ${best.pa.toFixed(dp)} (res=${best.res}, asym=${Math.abs(best.lk - best.rk)}) over the raw res minimum PA ${rawBest.pa.toFixed(dp)} (res=${rawBest.res}, asym=${Math.abs(rawBest.lk - rawBest.rk)}) — better slope symmetry.` })
			}

			// --- Next sweep recommendation ---
			// Decision tree:
			//   noisy + step already fine  → repeat at same or coarser settings (zooming in makes noise worse)
			//   noisy + step coarse        → repeat at same settings for confirmation
			//   edge hit                   → shift range, keep step
			//   clear minimum              → zoom in
			//   flat but not noisy         → zoom in (genuine flat optimum, sensor is resolving it)
			let nextSweep = null
			if (step !== null) {
				const minUsefulStep = 0.0005   // below this, sensor noise dominates
				const stepIsFine    = step <= minUsefulStep

				if (noisy && stepIsFine) {
					// Already fine-stepping into noise — going finer won't help
					items.push({ icon: 'mdi-alert-outline', color: 'orange',
						text: `The step size (${step}) is already fine but the results are noisy — zooming in further will not improve accuracy. Try repeating this sweep to get a consensus result, or run a coarser sweep (step ≥ 0.005) to confirm the rough PA region first.` })
					const coarseStep   = 0.005
					const coarseStart  = parseFloat(Math.max(0, best.pa - coarseStep * 10).toPrecision(4))
					const coarseEnd    = parseFloat((coarseStart + coarseStep * 20).toPrecision(4))
					const coarseSteps  = 20
					nextSweep = {
						reason: `Run a coarser confirmation sweep centred on the current best PA to check whether this result is consistent.`,
						code:   `pa_start = ${coarseStart}\npa_step  = ${coarseStep}\nsteps    = ${coarseSteps}  ; covers ${coarseStart.toFixed(4)}–${coarseEnd.toFixed(4)}`,
						params: { pa_start: coarseStart, pa_step: coarseStep, steps: coarseSteps },
					}
				} else if (noisy) {
					// Coarse step but noisy — repeat for confirmation
					nextSweep = {
						reason: `The sweep was noisy. Repeat with the same settings to confirm the result — if the recommended PA is consistent across two runs, use it.`,
						code:   `pa_start = ${paMin.toFixed(dp)}\npa_step  = ${step}\nsteps    = ${active.length}  ; same range`,
						params: { pa_start: paMin, pa_step: step, steps: active.length },
					}
				} else if (edgeFrac < 0.15) {
					// Confident result but near edge — shift range
					const dir = best.pa - paMin < paMax - best.pa ? -1 : 1
					const ss  = parseFloat(Math.max(0, best.pa + dir * paRange * 0.4).toPrecision(dp))
					const se  = parseFloat((ss + paRange).toPrecision(dp))
					const sn  = Math.round(paRange / step)
					nextSweep = {
						reason: `Shift the sweep range to centre the minimum.`,
						code:   `pa_start = ${ss}\npa_step  = ${step}\nsteps    = ${sn}  ; covers ${ss.toFixed(dp)}–${se.toFixed(dp)}`,
						params: { pa_start: ss, pa_step: step, steps: sn },
					}
				} else if (!stepIsFine) {
					// Clean result, step has room to go finer — zoom in
					const fineStep  = parseFloat((step / 4).toPrecision(3))
					const fineDp    = Math.min(Math.ceil(-Math.log10(fineStep)) + 1, 7)
					const fineStart = parseFloat(Math.max(0, best.pa - fineStep * 15).toPrecision(fineDp))
					const fineEnd   = parseFloat((best.pa + fineStep * 15).toPrecision(fineDp))
					const fineSteps = Math.round((fineEnd - fineStart) / fineStep)
					nextSweep = {
						reason: `Good clean result — zoom in around ${best.pa.toFixed(dp)} with a finer step (${fineStep}) to pin down the exact optimum.`,
						code:   `pa_start = ${fineStart}\npa_step  = ${fineStep}\nsteps    = ${fineSteps}  ; covers ${fineStart.toFixed(fineDp)}–${fineEnd.toFixed(fineDp)}`,
						params: { pa_start: fineStart, pa_step: fineStep, steps: fineSteps },
					}
				}
				// If step is already fine and result is clean — no further suggestion needed
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

		makeOverlayHook(getBest, getGoodBounds, drawZone, getDecimals) {
			return (chart) => {
				const best = getBest()
				if (!best) return
				const dp  = getDecimals ? getDecimals() : 4
				const ctx = chart.ctx
				const { top, bottom, left, right } = chart.chartArea
				const labels = chart.data.labels

				if (drawZone) {
					const bounds = getGoodBounds()
					if (bounds) {
						const { gs, ge } = bounds
						const idxL = labels.indexOf(gs.pa.toFixed(dp))
						const idxR = labels.indexOf(ge.pa.toFixed(dp))
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

				const idx = labels.indexOf(best.pa.toFixed(dp))
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
				ctx.fillText(`best ${best.pa.toFixed(dp)}`, rightHalf ? x - 4 : x + 4, top + 12)
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
			const bestScore = this.compositeScore(best)
			const threshold = bestScore * 1.20
			const active    = rows.filter(r => r.iter >= WARM_UP_SKIP && r.res > 0)
			const bestIdx   = active.findIndex(r => r.iter === best.iter)
			if (bestIdx < 0) return null
			// Walk left from best until we cross the threshold
			let lo = bestIdx
			while (lo > 0 && this.compositeScore(active[lo - 1]) <= threshold) lo--
			// Walk right from best until we cross the threshold
			let hi = bestIdx
			while (hi < active.length - 1 && this.compositeScore(active[hi + 1]) <= threshold) hi++
			return { gs: active[lo], ge: active[hi] }
		},

		paDecimalsFor(rows) {
			if (rows.length < 2) return 4
			// Find the smallest difference between consecutive PA values
			let minDiff = Infinity
			for (let i = 1; i < rows.length; i++) {
				const d = Math.abs(rows[i].pa - rows[i-1].pa)
				if (d > 0 && d < minDiff) minDiff = d
			}
			if (!isFinite(minDiff)) return 4
			// Need enough decimals so minDiff rounds to a non-zero value
			const needed = Math.ceil(-Math.log10(minDiff)) + 1
			return Math.min(Math.max(needed, 4), 7)
		},

		buildChartData(rows, decimals) {
			const dp = decimals !== undefined ? decimals : this.paDecimalsFor(rows)
			return {
				pa:  rows.map(r => r.pa.toFixed(dp)),
				res: rows.map(r => r.res),
				lk:  rows.map(r => r.lk),
				rk:  rows.map(r => r.rk),
				Hk:  rows.map(r => r.Hk),
				Ha:  rows.map(r => r.Ha),
			}
		},

		createChartSet(refs, rows, getBest, titleSuffix, getRows) {
			const _getRows  = getRows || (() => rows)
			const getDp     = () => this.paDecimalsFor(_getRows())
			const d = this.buildChartData(rows, getDp())

			// All getter functions are evaluated fresh on every draw call.
			const overlayRes   = this.makeOverlayHook(getBest, () => this.goodBoundsFor(_getRows(), getBest()), true,  getDp)
			const overlayOther = this.makeOverlayHook(getBest, () => null,                                      false, getDp)

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
				this.rows, () => this.best, ''
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

			if (!this.liveChartRes) {
				// Create charts once — overlay is patched once with getter functions,
				// so it always reads the current liveBest and bounds on every draw call.
				const { cRes, cSlopes, cH } = this.createChartSet(
					{ res: this.$refs.liveChartRes, slopes: this.$refs.liveChartSlopes, h: this.$refs.liveChartH },
					rows, () => this.liveBest, ' — live', () => this.liveRows
				)
				this.liveChartRes = cRes; this.liveChartSlopes = cSlopes; this.liveChartH = cH
			} else {
				// Just update data and call update() — the patched draw re-runs with fresh getters.
				const d = this.buildChartData(rows, this.livePaDecimals)

				this.liveChartRes.data.labels = d.pa
				this.liveChartRes.data.datasets[0].data = d.res
				this.liveChartRes.update()

				this.liveChartSlopes.data.labels = d.pa
				this.liveChartSlopes.data.datasets[0].data = d.lk
				this.liveChartSlopes.data.datasets[1].data = d.rk
				this.liveChartSlopes.update()

				this.liveChartH.data.labels = d.pa
				this.liveChartH.data.datasets[0].data = d.Hk
				this.liveChartH.data.datasets[1].data = d.Ha
				this.liveChartH.update()
			}
		},

		destroyAllCharts() {
			this.destroyLogCharts()
			this.destroyLiveCharts()
		},

		// ------------------------------------------------------------------ actions

		copyM572() {
			if (!this.best) return
			navigator.clipboard.writeText(`M572 D${this.logExtruderIndex} S${this.best.pa.toFixed(logPaDecimals)}`).then(() => { this.copied = true })
		},
		copyNextSweep() {
			if (!this.analysis.nextSweep) return
			navigator.clipboard.writeText(this.analysis.nextSweep.code).then(() => { this.copiedSweep = true })
		},
		copyLiveM572() {
			if (!this.liveBest) return
			navigator.clipboard.writeText(`M572 D${this.params.extruder} S${this.liveBest.pa.toFixed(livePaDecimals)}`).then(() => { this.copiedLive = true })
		},
		clearData() {
			this.destroyLogCharts()
			this.rows = []; this.meta = {}; this.best = null
			this.analysis = { items: [], nextSweep: null }; this.logError = ''
		},
	},
}
</script>
