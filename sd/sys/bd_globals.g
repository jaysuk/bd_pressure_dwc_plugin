; bd_globals.g — initialise all bd_pressure global variables
;
; Place this file in /sys/ on the Duet SD card.
; Call from config.g with: M98 P"/sys/bd_globals.g"
;
; Only creates each global if it does not already exist, so it is safe
; to call multiple times or early in config.g before other bd macros run.

; bd_port — port number for M575 (configure) and M261.2 (read)
;   1 = first aux UART (io0, WAFER/I2C connector)
;   2 = second aux UART (io1)
if !exists(global.bd_port)
    global bd_port = 1

; bd_uart — port number for M118 (send to sensor)
;   M118 P2 = first aux UART (PanelDue/UART port)
;   M118 P5 = second aux UART
if !exists(global.bd_uart)
    global bd_uart = 2

; bd_baud — UART baud rate shared by all bd_pressure macros
;   Change this value if you have switched the sensor to a different baud rate.
;   Valid values: 115200, 57600, 38400, 230400
if !exists(global.bd_baud)
    global bd_baud = 115200

; -----------------------------------------------------------------------
; Live calibration parameters — set by the DWC plugin before calling
; pa_calibrate_live.g.  Declared here so the plugin can always use
; `set global.bd_live_*` without needing to create them first.
;
; OPTIONAL USER CONFIGURATION:
; Uncomment the two lines below and set your hotend type to pre-select it in
; the plugin on every boot, so you don't have to pick it each session.
; Valid values: "short"    — E3D Revo, Slice Mosquito, Dragon HF
;               "standard" — E3D V6, Dragon ST, Rapido HF, Dragonfly, Bambu, Spider
;               "highflow" — E3D Volcano, Rapido UHF, Dragon UHF, Goliath, Mosquito Magnum+
;               "bowden"   — any hotend with a Bowden tube
;               "custom"   — manual parameter entry, no range checking
;
; if !exists(global.bd_live_hotend_preset)
;     global bd_live_hotend_preset = "standard"
;
; -----------------------------------------------------------------------
if !exists(global.bd_live_tool)
    global bd_live_tool = 0
if !exists(global.bd_live_nozzle_temp)
    global bd_live_nozzle_temp = 210
if !exists(global.bd_live_pa_start)
    global bd_live_pa_start = 0.0
if !exists(global.bd_live_pa_step)
    global bd_live_pa_step = 0.002
if !exists(global.bd_live_steps)
    global bd_live_steps = 50
if !exists(global.bd_live_warmup_steps)
    global bd_live_warmup_steps = 8
if !exists(global.bd_live_bidirectional)
    global bd_live_bidirectional = false
if !exists(global.bd_live_hotend_preset)
    global bd_live_hotend_preset = "unknown"
if !exists(global.bd_live_low_speed)
    global bd_live_low_speed = 1020
if !exists(global.bd_live_high_speed)
    global bd_live_high_speed = 10740
if !exists(global.bd_live_travel_speed)
    global bd_live_travel_speed = 18000
if !exists(global.bd_live_z_height)
    global bd_live_z_height = 50

