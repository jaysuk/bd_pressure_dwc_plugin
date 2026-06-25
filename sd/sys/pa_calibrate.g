; pa_calibrate.g — bd_pressure RRF-controlled Pressure Advance calibration
;
; Place this file in /sys/ on the Duet SD card.
; Run via: M98 P"/sys/pa_calibrate.g"
;
; Requirements:
;   - bd_pressure sensor connected via UART (WAFER/I2C connector)
;   - Firmware version: bd_pressure-rrf-v2.24 or later
;   - global.bd_port, global.bd_uart and global.bd_baud set via M98 P"/sys/bd_globals.g"
;
; How it works:
;   The nozzle is raised clear of the bed and moves XY while extruding —
;   slow→fast→slow — for each PA value.  The XY velocity creates the
;   pressure transient; the sensor scores it via pa.lib.
;   All 5 pa.lib metrics (res, lk, rk, Hk, Ha) are logged per iteration.

; -----------------------------------------------------------------------
; Guard — ensure bd_globals.g has been run (sets bd_port, bd_uart, bd_baud)
; -----------------------------------------------------------------------
if !exists(global.bd_port) || !exists(global.bd_uart) || !exists(global.bd_baud)
    abort "bd_pressure: global variables not initialised — add M98 P\"/sys/bd_globals.g\" to config.g and reboot"

; -----------------------------------------------------------------------
; Parameters — edit these to match your printer and filament
; -----------------------------------------------------------------------
var tool            = 0      ; tool number (T0, T1, etc.)
var nozzle_temp     = 210    ; °C — nozzle temperature
var pa_start        = 0.0    ; starting PA value
var pa_step         = 0.005  ; PA increment per iteration
var steps           = 50     ; number of iterations
var warmup_steps    = 8      ; extrusion passes at PA=0 before sweep (not logged)

; Speeds — match your typical print speeds
var low_speed       = 1020   ; mm/min — slow ramp segments
var high_speed      = 10740  ; mm/min — fast segment
var travel_speed    = 18000  ; mm/min — travel between lines

; Z height — raised clear of bed, nozzle not touching surface
var z_height        = 50     ; mm

; -----------------------------------------------------------------------
; Derive extruder index from object model
; -----------------------------------------------------------------------
var extruder = tools[var.tool].extruders[0]

; -----------------------------------------------------------------------
; Line geometry — 60mm total, X-only
; Slow 15mm → fast 30mm → slow 15mm, centred on bed X
; -----------------------------------------------------------------------
var x_start  = {move.axes[0].min + (move.axes[0].max - move.axes[0].min) / 2 - 30}
var x_mid_l  = {var.x_start + 15}
var x_mid_r  = {var.x_start + 45}
var x_end    = {var.x_start + 60}
var y_pos    = {move.axes[1].min + (move.axes[1].max - move.axes[1].min) / 2}

var e_per_mm = 0.046322
var e_slow   = {15 * var.e_per_mm}
var e_fast   = {30 * var.e_per_mm}
var e_prime  = {60 * var.e_per_mm}

if var.x_start < move.axes[0].min || var.x_end > move.axes[0].max
    abort "bd_pressure: 60mm line does not fit on bed X axis"

var log_file = {"0:/sys/PA Calibration/pa_" ^ state.msUpTime ^ ".csv"}

; -----------------------------------------------------------------------
; Step 1 — Home if needed
; -----------------------------------------------------------------------
if !move.axes[0].homed || !move.axes[1].homed || !move.axes[2].homed
    G28

; -----------------------------------------------------------------------
; Step 2 — Heat nozzle
; -----------------------------------------------------------------------
T{var.tool}
M118 P0 S"bd_pressure: heating nozzle..."
M568 P{var.tool} S{var.nozzle_temp} A2
M116

; -----------------------------------------------------------------------
; Step 3 — Raise Z, move to start, prime
; -----------------------------------------------------------------------
G90
M83

M118 P0 S{"bd_pressure: PA calibration — " ^ var.steps ^ " steps, X" ^ var.x_start ^ "–X" ^ var.x_end ^ " Y" ^ var.y_pos}

G1 Z{var.z_height} F600
G1 X{var.x_start} Y{var.y_pos} F{var.travel_speed}
G1 F{var.high_speed}
G1 X{var.x_end} Y{var.y_pos} E{var.e_prime}
M400
G4 P4000

; -----------------------------------------------------------------------
; Step 3b — Warm-up passes at PA=0
; -----------------------------------------------------------------------
if var.warmup_steps > 0
    M572 D{var.extruder} S0
    M118 P0 S{"bd_pressure: warm-up — " ^ var.warmup_steps ^ " passes at PA=0"}
    while iterations < var.warmup_steps
        G1 X{var.x_start} Y{var.y_pos} F{var.travel_speed}
        G1 X{var.x_mid_l} Y{var.y_pos} F{var.low_speed}  E{var.e_slow}
        G1 X{var.x_mid_r} Y{var.y_pos} F{var.high_speed} E{var.e_fast}
        G1 X{var.x_end}   Y{var.y_pos} F{var.low_speed}  E{var.e_slow}
        M400
        G4 P200

; -----------------------------------------------------------------------
; Step 4 — Switch to device mode, read version and mode, write log header
; -----------------------------------------------------------------------
M400
M575 P{global.bd_port} S2 B{global.bd_baud}  ; ensure known state before switching
G4 P500
M575 P{global.bd_port} S7 B{global.bd_baud}
G4 P1500

M260.2 P{global.bd_port} S"ver;"
G4 P300
M261.2 P{global.bd_port} B1 V"bd_ver_raw"
var bd_ver_major = floor(var.bd_ver_raw[0] / 100)
var bd_ver_minor = floor(var.bd_ver_raw[0] - var.bd_ver_major * 100)
var bd_version   = {"v" ^ var.bd_ver_major ^ "." ^ var.bd_ver_minor}

M260.2 P{global.bd_port} S"c;"
G4 P500
M260.2 P{global.bd_port} S"mode;"
G4 P300
M261.2 P{global.bd_port} B1 V"bd_mode_raw"
var bd_mode = {var.bd_mode_raw[0] == 0 ? "pa" : "endstop"}

if var.bd_mode_raw[0] != 0
    abort "bd_pressure: sensor did not enter PA mode — check wiring and firmware version"

echo >{var.log_file}  {"# bd_pressure PA calibration"}
echo >>{var.log_file} {"# date=" ^ state.time}
echo >>{var.log_file} {"# rrf_version=" ^ boards[0].firmwareVersion}
echo >>{var.log_file} {"# bd_version=bd_pressure-rrf-" ^ var.bd_version}
echo >>{var.log_file} {"# mode=" ^ var.bd_mode}
echo >>{var.log_file} {"# extruder=" ^ var.extruder ^ " nozzle_temp=" ^ var.nozzle_temp ^ " pa_start=" ^ var.pa_start ^ " pa_step=" ^ var.pa_step ^ " steps=" ^ var.steps ^ " hotend_preset=custom"}
echo >>{var.log_file} "iter,pa,res,lk,rk,Hk,Ha"

; -----------------------------------------------------------------------
; Step 5 — Calibration loop
; -----------------------------------------------------------------------
M118 P0 S"bd_pressure: starting PA calibration sweep..."

var scores = vector(var.steps, 0)
var pa     = var.pa_start

while iterations < var.steps
    set var.pa = var.pa_start + iterations * var.pa_step
    M572 D{var.extruder} S{var.pa}

    M118 P0 S{"bd_pressure: step " ^ (iterations + 1) ^ " of " ^ var.steps ^ " — PA " ^ var.pa}

    G1 X{var.x_start} Y{var.y_pos} F{var.travel_speed}
    G1 X{var.x_mid_l} Y{var.y_pos} F{var.low_speed}  E{var.e_slow}
    G1 X{var.x_mid_r} Y{var.y_pos} F{var.high_speed} E{var.e_fast}
    G1 X{var.x_end}   Y{var.y_pos} F{var.low_speed}  E{var.e_slow}
    M400
    G4 P200

    M260.2 P{global.bd_port} S"pdata;"
    G4 P200
    M261.2 P{global.bd_port} B5 V"bd_pa"

    set var.scores[iterations] = {var.bd_pa[0]}
    echo >>{var.log_file} {iterations ^ "," ^ var.pa ^ "," ^ var.bd_pa[0] ^ "," ^ var.bd_pa[1] ^ "," ^ var.bd_pa[2] ^ "," ^ var.bd_pa[3] ^ "," ^ var.bd_pa[4]}

; -----------------------------------------------------------------------
; Step 6 — Find best PA (skip first 2 as safety margin)
; -----------------------------------------------------------------------
var skip = 2
if var.skip >= var.steps
    set var.skip = 1

var best_score = 255
var best_i     = var.skip
var idx        = var.skip

while iterations + var.skip < var.steps
    set var.idx = iterations + var.skip
    if var.scores[var.idx] < var.best_score && var.scores[var.idx] > 0
        set var.best_score = var.scores[var.idx]
        set var.best_i     = var.idx

var best_pa = var.pa_start + var.best_i * var.pa_step

; -----------------------------------------------------------------------
; Step 7 — Apply result, reset sensor, report
; -----------------------------------------------------------------------
M572 D{var.extruder} S{var.best_pa}
echo >"0:/sys/PA Calibration/pa_result.g" {"M572 D" ^ var.extruder ^ " S" ^ var.best_pa}

M260.2 P{global.bd_port} S"e;"
G4 P500
M575 P{global.bd_port} S2 B{global.bd_baud}
G4 P500
M568 P{var.tool} A0
M400

M118 P0 S{"bd_pressure: calibration complete. Best PA = " ^ var.best_pa ^ " (res=" ^ var.best_score ^ ", step " ^ var.best_i ^ ")"}
M291 P{"<b>Calibration complete!</b><br><b>Best Pressure Advance:</b> " ^ var.best_pa ^ "<br><br><b>Add to config.g:</b><br>M572 D" ^ var.extruder ^ " S" ^ var.best_pa ^ "<br><br>Log saved to:<br>" ^ var.log_file} R"bd_pressure PA Result" S2
M118 P0 S{"bd_pressure: done. Log saved to " ^ var.log_file}
