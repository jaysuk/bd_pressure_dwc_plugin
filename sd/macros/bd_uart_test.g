; bd_uart_test.g
; Diagnostic macro — tests ver; and mode; single-byte UART reads.
; Run from DWC macros panel to confirm sensor communication.
; Results appear in the DWC console.

M118 P0 S"bd_uart_test: switching to device mode..."
M575 P{global.bd_port} S7 B{global.bd_baud}
G4 P300

; --- ver; — single byte, major*100+minor ---
M118 P0 S"bd_uart_test: sending ver;..."
M260.2 P{global.bd_port} S"ver;"
G4 P300
M261.2 P{global.bd_port} B1 V"bd_ver_raw"
var bd_ver_major = floor(var.bd_ver_raw[0] / 100)
var bd_ver_minor = floor(var.bd_ver_raw[0] - var.bd_ver_major * 100)
M118 P0 S{"bd_uart_test: version byte = " ^ var.bd_ver_raw[0] ^ " → v" ^ var.bd_ver_major ^ "." ^ var.bd_ver_minor}

; --- mode; before c; — 0=pa, 1=endstop ---
M118 P0 S"bd_uart_test: sending mode; (expect 1=endstop)..."
M260.2 P{global.bd_port} S"mode;"
G4 P300
M261.2 P{global.bd_port} B1 V"bd_mode_raw"
M118 P0 S{"bd_uart_test: mode byte = " ^ var.bd_mode_raw[0] ^ " (" ^ {var.bd_mode_raw[0] == 0 ? "pa" : "endstop"} ^ ")"}

; --- c; then mode; — expect 0=pa ---
M118 P0 S"bd_uart_test: sending c; then mode; (expect 0=pa)..."
M260.2 P{global.bd_port} S"c;"
G4 P500
M260.2 P{global.bd_port} S"mode;"
G4 P300
M261.2 P{global.bd_port} B1 V"bd_mode2_raw"
M118 P0 S{"bd_uart_test: mode after c; = " ^ var.bd_mode2_raw[0] ^ " (" ^ {var.bd_mode2_raw[0] == 0 ? "pa ✓" : "endstop ✗ — c; did not take effect"} ^ ")"}

; --- restore endstop mode ---
M260.2 P{global.bd_port} S"e;"
G4 P200

; --- restore raw mode ---
M575 P{global.bd_port} S2 B{global.bd_baud}
M118 P0 S"bd_uart_test: done. Port restored to raw mode."
