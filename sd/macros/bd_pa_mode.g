; bd_pa_mode.g
; Switch bd_pressure to Pressure Advance (PA) calibration mode.
;
; Place this file in /macros/ on the Duet SD card.
; Run via DWC macro button or: M98 P"/macros/bd_pa_mode.g"
;
; NOTE: For RRF automated PA calibration use pa_calibrate.g instead.
; This macro only switches the ADC mode; it does NOT start a calibration run.

M118 P{global.bd_uart} S"c;"
