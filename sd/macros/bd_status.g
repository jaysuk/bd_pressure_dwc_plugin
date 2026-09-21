; bd_status.g
; Query the current status of the bd_pressure sensor.
;
; Place this file in /macros/ on the Duet SD card.
; Run via DWC macro button or: M98 P"/macros/bd_status.g"
;
; Response appears as an M291 popup showing mode, threshold, invert,
; version, baud rate, logging state, ADC output state, and baseline value.

M118 P{global.bd_uart} S"s;"
