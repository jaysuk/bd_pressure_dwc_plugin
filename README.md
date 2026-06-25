# BdPressurePA — DWC Plugin for bd_pressure PA Calibration

A [DuetWebControl](https://github.com/Duet3D/DuetWebControl) plugin for **bd_pressure** Pressure Advance calibration on RepRapFirmware printers.

> **This plugin requires the RRF-specific bd_pressure firmware** — the standard Klipper firmware will not work. See [Requirements](#requirements) below.

---

## What it does

- **Live calibration** — runs a full PA sweep directly from DWC, no macro editing required
- **Log viewer** — load any saved calibration log from the Duet SD card, drag-drop, or file browse
- **Three-panel chart** — pressure score (res), slopes (lk/rk), signal quality (Hk/Ha)
- **Best PA selection** — composite score (`res + 0.5 × |lk − rk|`) with red dashed line and green good-zone band
- **Automatic analysis** — noise assessment, sweep edge detection, slope asymmetry, hotend range check
- **Suggested next sweep** — zoom-in or range-shift parameters with one-click **Load into Live Run**
- **Hotend presets** — auto-sets sweep range and step for short/standard/high-flow/Bowden hotends
- **Copy M572** — one click copies the correct command for your extruder
- **Light and dark mode** support

---

## Requirements

### Firmware

This plugin only works with the **RRF fork of bd_pressure firmware** — the sensor must be flashed with `bd_pressure-rrf-v2.24.hex` or later. The standard Klipper firmware shipped by markniu/pandapi3d does not support the UART commands this plugin uses.

**Firmware and full setup guide:** [github.com/jaysuk/bd_pressure](https://github.com/jaysuk/bd_pressure)

### Hardware and software

| Requirement | Minimum version |
|---|---|
| bd_pressure sensor | Any hardware revision |
| bd_pressure RRF firmware | v2.24 |
| RepRapFirmware | 3.5 (standalone Duet, no SBC required) |
| DuetWebControl | 3.5 |

---

## Installation

### 1. Flash the sensor firmware

Before installing this plugin, the bd_pressure sensor must be flashed with the RRF firmware:

→ **[Firmware and flashing instructions](https://github.com/jaysuk/bd_pressure/blob/main/firmware_src/release_hex/README.md)**

### 2. Install the plugin

1. Download **`BdPressurePA-1.1.0.zip`** from the [Releases](https://github.com/jaysuk/bd_pressure_dwc_plugin/releases) page
2. In DWC go to **Settings → Plugins → External plugins → Upload plugin**
3. Select the zip and click **Install**

The plugin installer automatically deploys all required SD card files:

| Installed to | Purpose |
|---|---|
| `/sys/bd_globals.g` | Initialises sensor globals — must be called from `config.g` |
| `/sys/pa_calibrate_live.g` | Live calibration macro called by the plugin |
| `/sys/pa_calibrate.g` | Standalone calibration macro (no plugin required) |
| `/macros/bd_*.g` | Sensor utility macros (version, status, threshold, baud, etc.) |
| `/sys/PA Calibration/` | Log output folder — created automatically |

### 3. Add to config.g

After installing, add these lines to your `config.g`:

```gcode
M98 P"/sys/bd_globals.g"                       ; initialise bd_pressure globals
M575 P{global.bd_port} S2 B{global.bd_baud}    ; UART in raw mode
M558 P8 C"zstop" H5 F300:60 T12000             ; Z probe (adjust pin for your board)
G31 P500 X0 Y0 Z-0.1                           ; adjust Z offset after first probe run
```

→ **[Full config.g guide](https://github.com/jaysuk/bd_pressure/blob/main/docs/reprapfirmware.md)**

### 4. Verify

Run `M98 P"/macros/bd_version.g"` from DWC. The sensor should respond in the Console tab with the firmware version string. If nothing appears, check wiring and the M575 line in config.g.

---

## Usage

### Live calibration (recommended)

1. Open the **PA Calibration** tab under Plugins
2. Select your **hotend type** — this sets the sweep range and enables analysis range checking
3. Set nozzle temperature, adjust any parameters if needed
4. Press **Start**

The plugin heats the nozzle, runs warm-up passes, sweeps PA, and opens the Log Viewer automatically when done.

To set a default hotend type that persists across reboots, uncomment the two lines in `/sys/bd_globals.g`.

### Log viewer

Past calibration logs are stored in `/sys/PA Calibration/` on the Duet SD card. Use the **Load log from Duet** picker in the header to select any previous run by date. You can also drag-drop a downloaded log file onto the drop zone.

### Standalone macro (no plugin)

```gcode
M98 P"/sys/pa_calibrate.g"
```

Edit the parameters at the top of the file to match your printer. Results are saved to `/sys/PA Calibration/`.

---

## Understanding the results

**res (lower = better)** — the primary score. Look for a clear V-shape minimum. A flat or noisy curve means the data is not resolving the optimum cleanly — repeat at the same settings rather than zooming in.

**lk / rk (slopes)** — should be small and roughly equal at the best PA. Persistent asymmetry across the whole sweep is a hotend geometry characteristic, not a calibration problem.

**Hk / Ha (peak heights)** — should be consistent and high (150+). Low or erratic values suggest a weak signal — check wiring, threshold, and extrusion amount.

→ **[Detailed analysis guide](https://github.com/jaysuk/bd_pressure/blob/main/docs/reprapfirmware.md#dwc-plugin)**

---

## Log files

| File | Contents |
|---|---|
| `/sys/PA Calibration/pa_<uptime>.csv` | Full log for each run — iter, PA, res, lk, rk, Hk, Ha |
| `/sys/PA Calibration/pa_result.g` | `M572 D0 S0.042` — best PA from the last run |
| `/sys/pa_live_status.txt` | Temporary status file written during a live run |

---

## Building from source

The plugin is built against the DuetWebControl 3.6 source tree.

**Prerequisites:** Node.js 16+, DuetWebControl 3.6 source ([Duet3D/DuetWebControl](https://github.com/Duet3D/DuetWebControl))

```bash
cd /path/to/DuetWebControl
node scripts/build-plugin.js /path/to/bd_pressure_dwc_plugin
```

The built zip is written to `dist/BdPressurePA-1.1.0.zip`. Use `build.bat` (Windows) to build and copy the zip to the repo root in one step.

**Source layout:**

```
dwc-src/
├── index.js            Plugin entry point — registers the route
└── PaCalibration.vue   Main component — calibration, charts, analysis
sd/
├── sys/
│   ├── bd_globals.g
│   ├── pa_calibrate_live.g
│   ├── pa_calibrate.g
│   └── PA Calibration/   (log output folder)
└── macros/
    └── bd_*.g
plugin.json             Plugin metadata
build.bat               Windows build helper
```

---

## Related

| Resource | Link |
|---|---|
| bd_pressure RRF firmware & setup guide | [github.com/jaysuk/bd_pressure](https://github.com/jaysuk/bd_pressure) |
| Full RRF setup documentation | [docs/reprapfirmware.md](https://github.com/jaysuk/bd_pressure/blob/main/docs/reprapfirmware.md) |
| Firmware flashing instructions | [firmware_src/release_hex/README.md](https://github.com/jaysuk/bd_pressure/blob/main/firmware_src/release_hex/README.md) |
| Original bd_pressure (Klipper) | [github.com/markniu/bd_pressure](https://github.com/markniu/bd_pressure) |
| Buy the sensor | [pandapi3d.com](https://www.pandapi3d.com/product-page/bdpressuree) |
| Discord | [discord.gg/z6ahddnGVU](https://discord.gg/z6ahddnGVU) |

---

## Licence

[MIT](LICENSE)
