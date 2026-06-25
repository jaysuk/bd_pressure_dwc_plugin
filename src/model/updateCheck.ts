/**
 * Self-update for the bd_pressure PA Calibration plugin, working WITH the shared cross-plugin update
 * hub in dwc-plugin-runtime. On load it checks this fork's GitHub Releases and announces a newer build
 * into the hub (a host like Flexible Layouts shows it in the unified popup); otherwise it falls back to
 * a one-off notification and the About tab shows an in-context banner with one-click apply.
 */
import { ref } from "vue";

import {
	announceUpdate,
	applyUpdate,
	checkForUpdate,
	clearAnnouncedUpdate,
	isUpdateHostActive,
	registerUpdateChecker,
	type UpdateResult,
} from "dwc-plugin-runtime";

import i18n from "@/i18n";
import { useMachineStore } from "@/stores/machine";
import { LogLevel, useUiStore } from "@/stores/ui";

import { LS_UPDATE_DISMISSED, LS_UPDATE_ENABLED, LS_UPDATE_LAST, PLUGIN_MANIFEST_ID } from "./constants";

const OWNER = "jaysuk";
const REPO  = "bd_pressure_dwc_plugin";
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

export const updateState      = ref<UpdateResult | null>(null);
export const checking         = ref(false);
export const applying         = ref(false);
export const pendingReload    = ref(false);
export const dismissedVersion = ref<string | null>(safeGet(LS_UPDATE_DISMISSED));

const t = (key: string, named?: Record<string, unknown>) =>
	i18n.global.t(`plugins.bdPressurePA.updates.${key}`, named ?? {});

function safeGet(key: string): string | null {
	try { return localStorage.getItem(key); } catch { return null; }
}
function safeSet(key: string, value: string): void {
	try { localStorage.setItem(key, value); } catch { /* storage disabled */ }
}

function currentVersion(): string {
	const plugins = (useMachineStore().model as { plugins?: Map<string, { version?: string }> }).plugins;
	return plugins?.get(PLUGIN_MANIFEST_ID)?.version ?? "0.0.0";
}

export function updateChecksEnabled(): boolean {
	return safeGet(LS_UPDATE_ENABLED) !== "false";
}
export function setUpdateChecksEnabled(on: boolean): void {
	safeSet(LS_UPDATE_ENABLED, on ? "true" : "false");
	if (!on) clearAnnouncedUpdate(PLUGIN_MANIFEST_ID);
}

function syncHub(): void {
	const s = updateState.value;
	if (s?.updateAvailable && dismissedVersion.value !== s.latestVersion) {
		announceUpdate(PLUGIN_MANIFEST_ID, i18n.global.t("plugins.bdPressurePA.title"), s);
	} else {
		clearAnnouncedUpdate(PLUGIN_MANIFEST_ID);
	}
}

export async function runUpdateCheck(opts: { force?: boolean; notify?: boolean } = {}): Promise<UpdateResult | null> {
	if (!opts.force) {
		if (!updateChecksEnabled()) return null;
		const last = Number(safeGet(LS_UPDATE_LAST) || 0);
		if (Date.now() - last < CHECK_INTERVAL_MS) {
			syncHub();
			return updateState.value;
		}
	}
	checking.value = true;
	try {
		const result = await checkForUpdate({ owner: OWNER, repo: REPO, currentVersion: currentVersion() });
		updateState.value = result;
		safeSet(LS_UPDATE_LAST, String(Date.now()));
		if (opts.notify && result.updateAvailable && dismissedVersion.value !== result.latestVersion && !isUpdateHostActive()) {
			const message = result.scenario === "dwcUpdate"
				? t("notifyDwc", { version: result.latestVersion, dwc: result.requiredDwc })
				: t("notifyPlugin", { version: result.latestVersion });
			useUiStore().makeNotification(LogLevel.info, t("title"), message);
		}
		syncHub();
		return result;
	} catch {
		return null;
	} finally {
		checking.value = false;
	}
}

registerUpdateChecker(PLUGIN_MANIFEST_ID, async () => { await runUpdateCheck({ force: true }); });

export function dismissCurrentUpdate(): void {
	const v = updateState.value?.latestVersion;
	if (v) {
		safeSet(LS_UPDATE_DISMISSED, v);
		dismissedVersion.value = v;
		clearAnnouncedUpdate(PLUGIN_MANIFEST_ID);
	}
}

export async function applyUpdateNow(): Promise<void> {
	const result = updateState.value;
	const machine = useMachineStore();
	const ui = useUiStore();
	if (!result?.assetUrl || !result.assetName) {
		ui.makeNotification(LogLevel.warning, t("title"), t("applyFailed"));
		return;
	}
	applying.value = true;
	try {
		await applyUpdate({
			assetUrl: result.assetUrl,
			assetName: result.assetName,
			installPlugin: async (filename, blob, start) => {
				await (machine as unknown as {
					installPlugin: (f: string, b: Blob, s: boolean) => Promise<unknown>;
				}).installPlugin(filename, blob, start);
			},
		});
		pendingReload.value = true;
		clearAnnouncedUpdate(PLUGIN_MANIFEST_ID);
		ui.makeNotification(LogLevel.success, t("title"), t("installedReload", { version: result.latestVersion }));
	} catch (e) {
		console.warn("[BdPressurePA] update failed:", e);
		ui.makeNotification(LogLevel.warning, t("title"), t("corsBlocked"));
		window.location.href = result.assetUrl;
	} finally {
		applying.value = false;
	}
}
