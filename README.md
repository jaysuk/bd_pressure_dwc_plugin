# BdPressurePA — DWC Plugin

A [DuetWebControl](https://github.com/Duet3D/DuetWebControl) plugin for visualising **bd_pressure** Pressure Advance calibration logs on RepRapFirmware-based printers.

Part of the [bd_pressure RRF fork](https://github.com/jaysuk/bd_pressure) — a RepRapFirmware implementation of the [bd_pressure sensor](https://github.com/markniu/bd_pressure) by markniu.

---

## Features

- **Load from Duet** — fetches `/sys/pa_calibrate_log.txt` directly from the Duet SD card
- **Drag and drop** or **file browse** for local log files
- **Three-panel chart** — pressure score (res), slopes (lk/rk), signal quality (Hk/Ha)
- **Best PA line** — red dashed vertical line on all charts with label
- **Good zone** — green shaded band on the res chart covering all PA values within 20% of best
- **Metadata chips** — date, RRF version, bd_pressure version, mode, nozzle temp, PA sweep parameters
- **One-click Copy M572** — correct extruder index read from log
- **Analysis panel** — automatic assessment of sweep quality:
  - Noise level (coefficient of variation)
  - Whether the minimum is near the edge of the sweep range
  - Curve flatness around the minimum
  - lk/rk slope asymmetry
- **Suggested next sweep** — zoom-in or range-shift parameters as a copyable GCode block
- **Raw data table** — all iterations, best row highlighted
- **Light and dark mode** support

All analysis runs entirely in the browser — nothing is sent to the Duet board.

---

## Requirements

- DuetWebControl 3.5 or later
- RepRapFirmware 3.5 or later (standalone Duet, no SBC required)
- bd_pressure sensor with RRF firmware v2.24 or later

---

## Installation

1. Download `BdPressurePA-1.0.0.zip` from the [Releases](https://github.com/jaysuk/bd_pressure_dwc_plugin/releases) page
2. In DWC go to **Settings → Plugins → External plugins → Upload plugin**
3. Select the zip and click **Install**
4. A **PA Calibration** tab appears under **Plugins** in the left sidebar

---

## Usage

1. Run a PA calibration with `M98 P"/sys/pa_calibrate.g"` on your Duet
2. Open the **PA Calibration** tab in DWC
3. Click **Load from Duet** — the log is fetched automatically from `/sys/pa_calibrate_log.txt`
4. Review the charts and analysis panel
5. If a suggested next sweep is shown, copy the parameters into `pa_calibrate.g` and run again

---

## Building from source

The plugin is built against the DuetWebControl 3.6 source tree.

### Prerequisites

- Node.js 16+
- DuetWebControl 3.6 source (clone from [Duet3D/DuetWebControl](https://github.com/Duet3D/DuetWebControl))

### Build

```bash
cd /path/to/DuetWebControl
node scripts/build-plugin-pkg.js /path/to/bd_pressure_dwc_plugin
```

The built zip will be written to `dist/BdPressurePA-1.0.0.zip`.

### Source layout

```
dwc-src/
├── index.js          Plugin entry point — registers the route
└── PaCalibration.vue Main component — charts, analysis, file handling
plugin.json           Plugin metadata
```

---

## Related

- **bd_pressure RRF firmware & macros:** https://github.com/jaysuk/bd_pressure
- **Original bd_pressure (Klipper):** https://github.com/markniu/bd_pressure
- **Buy the sensor:** https://www.pandapi3d.com/product-page/bdpressuree

---

## Licence

[MIT](LICENSE) — do whatever you like with it.
