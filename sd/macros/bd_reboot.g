; bd_reboot.g
; Reboot the bd_pressure sensor.
;
; Place this file in /macros/ on the Duet SD card.
; Run via DWC macro button or: M98 P"/macros/bd_reboot.g"
;
; Equivalent to a power cycle — useful for recovering the sensor without
; physical access (e.g. after a crash or unexpected state).
; The sensor will restart in endstop/probe mode with the saved threshold.

M118 P{global.bd_uart} S"r;"
