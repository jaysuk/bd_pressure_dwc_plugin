; bd_version.g
; Query the bd_pressure sensor firmware version.
;
; Place this file in /macros/ on the Duet SD card.
; Run via DWC macro button or: M98 P"/macros/bd_version.g"
;
; Response appears directly in the DWC console.

M118 P{global.bd_uart} S"v;"
