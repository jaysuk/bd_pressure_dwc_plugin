; pa_calibrate_live.g — bd_pressure PA calibration, plugin-driven variant
;
; Called by the BdPressurePA DWC plugin. Do NOT run manually — use pa_calibrate.g instead.
; The plugin sets parameters via global variables before calling this macro.
;
; Parameters set by plugin (all must exist before this macro runs):
;   global.bd_live_tool           tool number (extruder derived from tools[tool].extruders[0])
;   global.bd_live_nozzle_temp    nozzle temperature °C
;   global.bd_live_pa_start       PA sweep start value
;   global.bd_live_pa_step        PA increment per iteration
;   global.bd_live_steps          number of iterations
;   global.bd_live_warmup_steps   number of extrusion passes at PA=0 before sweep begins
;   global.bd_live_hotend_preset  hotend category string (custom/short/standard/highflow/bowden)
;   global.bd_live_low_speed      slow segment speed mm/min
;   global.bd_live_high_speed     fast segment speed mm/min
;   global.bd_live_travel_speed   travel speed mm/min
;   global.bd_live_z_height       Z height mm

; -----------------------------------------------------------------------
; Guard
; -----------------------------------------------------------------------
if !exists(global.bd_port) || !exists(global.bd_uart) || !exists(global.bd_baud)
    abort "bd_pressure: global variables not initialised — add M98 P\"/sys/bd_globals.g\" to config.g and reboot"

if !exists(global.bd_live_tool)
    abort "bd_pressure: bd_live parameters not set — use the DWC plugin to start calibration"

; -----------------------------------------------------------------------
; Parameters from plugin globals
; -----------------------------------------------------------------------
var tool          = global.bd_live_tool
var extruder      = tools[global.bd_live_tool].extruders[0]
var nozzle_temp   = global.bd_live_nozzle_temp
var pa_start      = global.bd_live_pa_start
var pa_step       = global.bd_live_pa_step
var steps         = global.bd_live_steps
var warmup_steps  = global.bd_live_warmup_steps
var bidirectional = global.bd_live_bidirectional
var hotend_preset = global.bd_live_hotend_preset
var low_speed     = global.bd_live_low_speed
var high_speed    = global.bd_live_high_speed
var travel_speed  = global.bd_live_travel_speed
var z_height      = global.bd_live_z_height

; -----------------------------------------------------------------------
; Line geometry
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
echo >"0:/sys/pa_live_status.txt" {"state=heating steps=" ^ var.steps}
M568 P{var.tool} S{var.nozzle_temp} A2
M116

; -----------------------------------------------------------------------
; Step 3 — Raise Z, move to start, prime
; -----------------------------------------------------------------------
G90
M83

echo >"0:/sys/pa_live_status.txt" {"state=priming steps=" ^ var.steps}
M118 P0 S{"bd_pressure: PA calibration — " ^ var.steps ^ " steps, X" ^ var.x_start ^ "–X" ^ var.x_end ^ " Y" ^ var.y_pos}

G1 Z{var.z_height} F600
G1 X{var.x_start} Y{var.y_pos} F{var.travel_speed}
G1 F{var.high_speed}
G1 X{var.x_end} Y{var.y_pos} E{var.e_prime}
M400
G4 P4000

; -----------------------------------------------------------------------
; Step 3b — Warm-up passes at PA=0 (sensor + hotend stabilisation)
; Passes alternate direction when bidirectional=true, halving travel time.
; -----------------------------------------------------------------------
if var.warmup_steps > 0
    M572 D{var.extruder} S0
    echo >"0:/sys/pa_live_status.txt" {"state=warmup steps=" ^ var.steps ^ " warmup=" ^ var.warmup_steps ^ " log=" ^ var.log_file}
    M118 P0 S{"bd_pressure: warm-up — " ^ var.warmup_steps ^ " passes at PA=0"}
    var wu_fwd = true
    while iterations < var.warmup_steps
        if var.wu_fwd || !var.bidirectional
            G1 X{var.x_start} Y{var.y_pos} F{var.travel_speed}
            G1 X{var.x_mid_l} Y{var.y_pos} F{var.low_speed}  E{var.e_slow}
            G1 X{var.x_mid_r} Y{var.y_pos} F{var.high_speed} E{var.e_fast}
            G1 X{var.x_end}   Y{var.y_pos} F{var.low_speed}  E{var.e_slow}
        else
            G1 X{var.x_mid_r} Y{var.y_pos} F{var.low_speed}  E{var.e_slow}
            G1 X{var.x_mid_l} Y{var.y_pos} F{var.high_speed} E{var.e_fast}
            G1 X{var.x_start} Y{var.y_pos} F{var.low_speed}  E{var.e_slow}
        set var.wu_fwd = !var.wu_fwd
        M400
        G4 P200

; -----------------------------------------------------------------------
; Step 4 — Device mode, read version and mode, write log header
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
echo >>{var.log_file} {"# extruder=" ^ var.extruder ^ " nozzle_temp=" ^ var.nozzle_temp ^ " pa_start=" ^ var.pa_start ^ " pa_step=" ^ var.pa_step ^ " steps=" ^ var.steps ^ " hotend_preset=" ^ var.hotend_preset}
echo >>{var.log_file} "iter,pa,res,lk,rk,Hk,Ha"

; -----------------------------------------------------------------------
; Step 5 — Calibration loop
; -----------------------------------------------------------------------
M118 P0 S"bd_pressure: starting PA calibration sweep..."

var scores = vector(var.steps, 0)
var pa     = var.pa_start
var fwd    = true

while iterations < var.steps
    set var.pa = var.pa_start + iterations * var.pa_step
    M572 D{var.extruder} S{var.pa}

    echo >"0:/sys/pa_live_status.txt" {"state=running step=" ^ (iterations+1) ^ " steps=" ^ var.steps ^ " pa=" ^ var.pa ^ " log=" ^ var.log_file}
    M118 P0 S{"bd_pressure: step " ^ (iterations + 1) ^ " of " ^ var.steps ^ " — PA " ^ var.pa}

    if var.fwd || !var.bidirectional
        G1 X{var.x_start} Y{var.y_pos} F{var.travel_speed}
        G1 X{var.x_mid_l} Y{var.y_pos} F{var.low_speed}  E{var.e_slow}
        G1 X{var.x_mid_r} Y{var.y_pos} F{var.high_speed} E{var.e_fast}
        G1 X{var.x_end}   Y{var.y_pos} F{var.low_speed}  E{var.e_slow}
    else
        G1 X{var.x_mid_r} Y{var.y_pos} F{var.low_speed}  E{var.e_slow}
        G1 X{var.x_mid_l} Y{var.y_pos} F{var.high_speed} E{var.e_fast}
        G1 X{var.x_start} Y{var.y_pos} F{var.low_speed}  E{var.e_slow}
    set var.fwd = !var.fwd
    M400
    G4 P200

    M260.2 P{global.bd_port} S"pdata;"
    G4 P200
    M261.2 P{global.bd_port} B5 V"bd_pa"

    set var.scores[iterations] = {var.bd_pa[0]}
    echo >>{var.log_file} {iterations ^ "," ^ var.pa ^ "," ^ var.bd_pa[0] ^ "," ^ var.bd_pa[1] ^ "," ^ var.bd_pa[2] ^ "," ^ var.bd_pa[3] ^ "," ^ var.bd_pa[4]}

; -----------------------------------------------------------------------
; Step 6 — Find best PA
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
; Step 7 — Apply result and report
; -----------------------------------------------------------------------
M572 D{var.extruder} S{var.best_pa}
echo >"0:/sys/PA Calibration/pa_result.g" {"M572 D" ^ var.extruder ^ " S" ^ var.best_pa}

; -----------------------------------------------------------------------
; Step 8 — Restore sensor and cool down
; -----------------------------------------------------------------------
M260.2 P{global.bd_port} S"e;"
G4 P500
M575 P{global.bd_port} S2 B{global.bd_baud}
G4 P500
M568 P{var.tool} A0
M400

; Write done state after sensor is safely reset so plugin tab-switch
; and any further port access don't race with the mode change
echo >"0:/sys/pa_live_status.txt" {"state=done steps=" ^ var.steps ^ " pa=" ^ var.best_pa ^ " best_pa=" ^ var.best_pa ^ " best_res=" ^ var.best_score ^ " log=" ^ var.log_file}

M118 P0 S{"bd_pressure: calibration complete. Best PA = " ^ var.best_pa ^ " (res=" ^ var.best_score ^ ", step " ^ var.best_i ^ ")"}
M291 P{"<b>Calibration complete!</b><br><b>Best Pressure Advance:</b> " ^ var.best_pa ^ "<br><br><b>Add to config.g:</b><br>M572 D" ^ var.extruder ^ " S" ^ var.best_pa ^ "<br><br>Check the <b>Log Viewer</b> tab for analysis and next-step recommendations."} R"bd_pressure PA Result" S2
M118 P0 S{"bd_pressure: done. Log saved to " ^ var.log_file}
