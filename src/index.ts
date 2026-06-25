/**
 * bd_pressure PA Calibration — entry point (DWC 3.7).
 *
 * Registers a standalone DWC page (Plugins → PA Calibration) and an embeddable component for live
 * PA calibration using the bd_pressure strain-gauge sensor. Wires in the shared runtime (self-update
 * hub + error capture) and tears down app-lifetime resources on `dwcPluginUnloaded`.
 */
import { registerPluginMessages, registerRoute, unregisterRoute, registerEmbeddableComponent, unregisterEmbeddableComponent } from "@/plugins";
import Events from "@/utils/events";
import { clearAnnouncedUpdate, installErrorCapture } from "dwc-plugin-runtime";

import PaCalibrationPage from "./components/PaCalibrationPage.vue";
import { EMBEDDABLE_ID, PLUGIN_ID, PLUGIN_MANIFEST_ID, ROUTE_PATH } from "./model/constants";
import { runUpdateCheck } from "./model/updateCheck";
import en from "./i18n/en.json";

registerPluginMessages(PLUGIN_ID, { en });

registerRoute(PaCalibrationPage, {
	Plugins: {
		BdPressurePA: {
			icon: "mdi-chart-line",
			caption: "plugins.bdPressurePA.menuCaption",
			path: ROUTE_PATH,
		},
	},
});

registerEmbeddableComponent({
	id: EMBEDDABLE_ID,
	pluginId: PLUGIN_MANIFEST_ID,
	caption: "plugins.bdPressurePA.widget",
	icon: "mdi-chart-line",
	description: "plugins.bdPressurePA.embeddableDesc",
	component: PaCalibrationPage,
	defaultSize: { w: 8, h: 20 },
	machineMode: "any",
});

const uninstallErrorCapture = installErrorCapture();

setTimeout(() => { void runUpdateCheck({ notify: true }); }, 4000);

function onPluginUnloaded(id: string): void {
	if (id === PLUGIN_MANIFEST_ID) {
		unregisterRoute(ROUTE_PATH);
		unregisterEmbeddableComponent(EMBEDDABLE_ID);
		clearAnnouncedUpdate(PLUGIN_MANIFEST_ID);
		uninstallErrorCapture();
		Events.off("dwcPluginUnloaded", onPluginUnloaded);
	}
}
Events.on("dwcPluginUnloaded", onPluginUnloaded);
