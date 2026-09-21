; bd_logging.g
; Enable or disable bd_pressure diagnostic output.
;
; Place this file in /macros/ on the Duet SD card.
; Run from DWC macros panel or via: M98 P"/macros/bd_logging.g"
;
; Trigger logging: logs each probe trigger and release event to the DWC console.
; ADC output: continuously streams raw ADC values — disable before probing or PA calibration.
; Settings are not saved to flash and reset to off on sensor reboot.

M291 P"Select diagnostic output to change." R"bd_pressure logging" S4 K{"Trigger logging ON","Trigger logging OFF","ADC output ON","ADC output OFF"} J2
if result == -1
    M99

if input == 0
    M118 P{global.bd_uart} S"L;"
    M291 P"Trigger logging <b>enabled</b>.<br>Probe trigger and release events will appear in the DWC console." R"bd_pressure logging" S2 T3
elif input == 1
    M118 P{global.bd_uart} S"l;"
    M291 P"Trigger logging <b>disabled</b>." R"bd_pressure logging" S2 T3
elif input == 2
    M118 P{global.bd_uart} S"d;"
    M291 P"ADC output <b>enabled</b>.<br><b>Remember to disable before probing or PA calibration.</b>" R"bd_pressure logging" S2 T5
elif input == 3
    M118 P{global.bd_uart} S"D;"
    M291 P"ADC output <b>disabled</b>." R"bd_pressure logging" S2 T3
