/**
 * Hotend presets for the PA sweep.
 * PURE — no Vue/DWC imports.
 */

export interface HotendPreset {
	id: string;
	label: string;
	group: string | null;
	pa_start: number;
	pa_step: number;
	steps: number;
	pa_min_expected: number;
	pa_max_expected: number | null;
	note: string | null;
}

export interface SelectItem {
	title: string;
	value: string;
}

export interface SelectHeader {
	type: "subheader";
	title: string;
}

export type PresetSelectItem = SelectItem | SelectHeader;

export const HOTEND_PRESETS: HotendPreset[] = [
	{
		id: "unknown",
		label: "— Select hotend type —",
		group: null,
		pa_start: 0, pa_step: 0.005, steps: 50,
		pa_min_expected: 0, pa_max_expected: null,
		note: null,
	},
	{
		id: "custom",
		label: "Custom",
		group: null,
		pa_start: 0, pa_step: 0.005, steps: 50,
		pa_min_expected: 0, pa_max_expected: null,
		note: null,
	},
	// Short melt zone — fast pressure response; PA typically low
	{
		id: "short",
		label: "Short melt zone",
		group: "Short melt zone",
		pa_start: 0, pa_step: 0.002, steps: 50,
		pa_min_expected: 0, pa_max_expected: 0.10,
		note: "E3D Revo (all variants), Slice Mosquito, Phaetus Dragon HF, Mellow NF-Crazy",
	},
	// Standard — most direct-drive setups; well-defined minimum typical
	{
		id: "standard",
		label: "Standard",
		group: "Standard",
		pa_start: 0, pa_step: 0.005, steps: 50,
		pa_min_expected: 0.02, pa_max_expected: 0.18,
		note: "E3D V6, Phaetus Dragon ST, Rapido HF (v1/v2), Dragonfly BMO/BMS, Creality Spider, Bambu X1/P1/A1, Mellow NF-Crazy (high flow), Slice Mosquito Magnum",
	},
	// High flow / long melt zone — slower pressure response; wider sweep needed
	{
		id: "highflow",
		label: "High flow / long melt zone",
		group: "High flow / long melt zone",
		pa_start: 0, pa_step: 0.005, steps: 50,
		pa_min_expected: 0.04, pa_max_expected: 0.30,
		note: "E3D Volcano, Phaetus Rapido UHF (v1/v2), Dragon UHF, Goliath (VzBot/Mellow, 50 mm melt zone), Slice Mosquito Magnum+, Bondtech CHT bi-metal",
	},
	// Bowden — tube compliance dominates; PA an order of magnitude higher than direct drive
	{
		id: "bowden",
		label: "Bowden",
		group: "Bowden",
		pa_start: 0.3, pa_step: 0.02, steps: 50,
		pa_min_expected: 0.3, pa_max_expected: 1.5,
		note: "Any hotend with a Bowden tube. Tube length and inner diameter matter more than hotend type.",
	},
];

/** Return the preset for the given id, or the unknown preset. */
export function activePreset(id: string): HotendPreset {
	return HOTEND_PRESETS.find((p) => p.id === id) ?? HOTEND_PRESETS[0];
}

/** Build v-select items with group subheaders for Vuetify 4. */
export function hotendPresetItems(): PresetSelectItem[] {
	const items: PresetSelectItem[] = [];
	let lastGroup: string | null | undefined = undefined;
	for (const p of HOTEND_PRESETS) {
		if (p.group !== lastGroup) {
			if (p.group) items.push({ type: "subheader", title: p.group });
			lastGroup = p.group;
		}
		items.push({ title: p.label, value: p.id });
	}
	return items;
}
