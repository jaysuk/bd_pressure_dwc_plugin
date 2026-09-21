; bd_endstop_mode.g
; Switch bd_pressure to endstop / Z-probe mode.
;
; Place this file in /macros/ on the Duet SD card.
; Run via DWC macro button or: M98 P"/macros/bd_endstop_mode.g"
;
; This is the normal operating mode for Z homing and bed mesh probing.
; The sensor is automatically in this mode on power-up.

M118 P{global.bd_uart} S"e;"
