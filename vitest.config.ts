import vue from "@vitejs/plugin-vue";
import { dwcVitestConfig } from "dwc-plugin-test-kit/vitest";

// Pure-logic tests (src/**) plus component mount tests (test/**). The Vitest + Vuetify + DWC-mock
// wiring lives in the shared kit; the consumer only supplies the Vue SFC plugin.
export default dwcVitestConfig({
	plugins: [vue()],
});
