; bd_baud.g
; Set the bd_pressure UART baud rate.
;
; Place this file in /macros/ on the Duet SD card.
; Run from DWC macros panel or via: M98 P"/macros/bd_baud.g"
;
; The sensor saves the new rate to flash and reboots automatically.
; This macro switches the Duet port to match and updates global.bd_baud.
; You must also update the bd_baud value in bd_globals.g to persist across Duet reboots.

M291 P{"Select the new baud rate for bd_pressure.<br><br><b>Current rate: " ^ global.bd_baud ^ "</b><br>Default is <b>115200</b>."} R"bd_pressure baud rate" S4 K{"115200","57600","38400","230400"} J2
if result == -1
    M99

var baud_cmd = "b0;"
var baud_val = 115200

if input == 1
    set var.baud_cmd = "b1;"
    set var.baud_val = 57600
elif input == 2
    set var.baud_cmd = "b2;"
    set var.baud_val = 38400
elif input == 3
    set var.baud_cmd = "b3;"
    set var.baud_val = 230400

M118 P{global.bd_uart} S{var.baud_cmd}
M118 P0 S{"bd_pressure: switching to " ^ var.baud_val ^ " baud — waiting for reboot..."}
G4 P1500
M575 P{global.bd_port} S2 B{var.baud_val}
G4 P1500
set global.bd_baud = var.baud_val

M291 P{"<b>bd_pressure</b> is now running at <b>" ^ var.baud_val ^ " baud</b>.<br><br>Update <b>bd_globals.g</b> and set:<br>global bd_baud = " ^ var.baud_val} R"bd_pressure baud rate" S2
