import { beforeEach, describe, expect, it } from "vitest";
import { mountInDwc, resetDwc, setGlobals } from "dwc-plugin-test-kit";

import PaCalibrationPage from "../src/components/PaCalibrationPage.vue";
import SensorSetupTab from "../src/components/SensorSetupTab.vue";

describe("PaCalibrationPage", () => {
	beforeEach(() => resetDwc());

	it("mounts without throwing", () => {
		const wrapper = mountInDwc(PaCalibrationPage);
		expect(wrapper.exists()).toBe(true);
	});

	it("shows the Live/Log/Help/Setup tabs", () => {
		const wrapper = mountInDwc(PaCalibrationPage);
		const text = wrapper.text();
		expect(text).toContain("Live Run");
		expect(text).toContain("Log Viewer");
		expect(text).toContain("Help");
		expect(text).toContain("Setup");
	});

	it("mounts with a hotend preset already stored in globals", () => {
		setGlobals({ bd_live_hotend_preset: "standard" });
		const wrapper = mountInDwc(PaCalibrationPage);
		expect(wrapper.exists()).toBe(true);
	});
});

describe("SensorSetupTab", () => {
	beforeEach(() => resetDwc());

	it("mounts without throwing", () => {
		const wrapper = mountInDwc(SensorSetupTab);
		expect(wrapper.exists()).toBe(true);
	});

	it("shows the Sensor/Configuration/Diagnostics groups", () => {
		const wrapper = mountInDwc(SensorSetupTab);
		const text = wrapper.text();
		expect(text).toContain("Sensor");
		expect(text).toContain("Configuration");
		expect(text).toContain("Diagnostics");
	});

	it("falls back to default port/uart/baud when globals aren't set", () => {
		const wrapper = mountInDwc(SensorSetupTab);
		expect(wrapper.text()).toContain("115200");
	});
});
