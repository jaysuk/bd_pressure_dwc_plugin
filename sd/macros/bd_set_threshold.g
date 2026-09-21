; bd_set_threshold.g
; Set the bd_pressure probe trigger threshold.
;
; Place this file in /macros/ on the Duet SD card.
; Run from DWC macros panel or via: M98 P"/macros/bd_set_threshold.g"
;
; Higher value = less sensitive (more force to trigger)
; Lower value  = more sensitive (less force to trigger)
; Default is 4. Valid range: 1–99.
;
; The threshold is saved to flash automatically and persists across reboots.

; Switch to device mode and read current threshold as raw binary byte
M575 P{global.bd_port} S7 B{global.bd_baud}
G4 P100

M260.2 P{global.bd_port} S"Q;"
M261.2 P{global.bd_port} B1 V"bd_threshold"

; Restore raw mode
M575 P{global.bd_port} S2 B{global.bd_baud}
G4 P100

M291 P{"Enter new trigger threshold (1–99)<br><br>Higher = less sensitive<br>Lower = more sensitive<br><br><b>Current value: " ^ var.bd_threshold[0] ^ "</b>"} R"bd_pressure threshold" S5 L1 H99 J2
if result != -1
    M118 P{global.bd_uart} S{floor(input) ^ ";"}
    M291 P{"Threshold set to <b>" ^ floor(input) ^ "</b>"} R"bd_pressure threshold" S2 T3
