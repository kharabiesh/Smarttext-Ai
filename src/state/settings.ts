import { create } from "zustand";
import type { Language } from "@/i18n";
import { DEFAULT_TEXT_MODEL } from "@/lib/ai/registry";
import type { ProviderId } from "@/lib/ai/types";
import type { KeyStatus } from "@/lib/ai/secrets";
import type { ToolId } from "@/lib/ai/tools";
import type { Store } from "@/lib/db";

export type Theme = "system" | "light" | "dark";

export interface Settings {
  language: Language;
  theme: Theme;
  textProvider: ProviderId;
  textModels: Record<ProviderId, string>;
  compatibleBaseUrl: string;
  imageProvider: "openai" | "none";
  imageModel: string;
  historyEnabled: boolean;
  chatHistoryEnabled: boolean;
  imageHistoryEnabled: boolean;
  timeoutSec: number;
  maxRetries: number;
  recentTools: Array<ToolId | "humanizer" | "chat" | "image" | "analysis">;
  sidebarCollapsed: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  language: "en",
  theme: "system",
  textProvider: "openai",
  textModels: { ...DEFAULT_TEXT_MODEL },
  compatibleBaseUrl: "http://localhost:11434/v1",
  imageProvider: "openai",
  imageModel: "gpt-image-1",
  historyEnabled: true,
  chatHistoryEnabled: true,
  imageHistoryEnabled: true,
  timeoutSec: 120,
  maxRetries: 2,
  recentTools: [],
  sidebarCollapsed: false,
};

/** Merges stored settings over defaults, dropping unknown keys and wrongly-typed values. */
export function sanitizeSettings(raw: Record<string, unknown> | null | undefined): Settings {
  const out: Settings = structuredClone(DEFAULT_SETTINGS);
  if (!raw || typeof raw !== "object") return out;
  const r = raw as Partial<Record<keyof Settings, unknown>>;
  if (r.language === "en" || r.language === "ar") out.language = r.language;
  if (r.theme === "light" || r.theme === "dark" || r.theme === "system") out.theme = r.theme;
  if (r.textProvider === "openai" || r.textProvider === "anthropic" || r.textProvider === "openai_compatible") out.textProvider = r.textProvider;
  if (r.textModels && typeof r.textModels === "object") {
    for (const [k, v] of Object.entries(r.textModels as Record<string, unknown>)) {
      if (k in out.textModels && typeof v === "string" && v.trim()) out.textModels[k as ProviderId] = v;
    }
  }
  if (typeof r.compatibleBaseUrl === "string") out.compatibleBaseUrl = r.compatibleBaseUrl;
  if (r.imageProvider === "openai" || r.imageProvider === "none") out.imageProvider = r.imageProvider;
  if (typeof r.imageModel === "string" && r.imageModel.trim()) out.imageModel = r.imageModel;
  for (const k of ["historyEnabled", "chatHistoryEnabled", "imageHistoryEnabled", "sidebarCollapsed"] as const) {
    if (typeof r[k] === "boolean") out[k] = r[k] as boolean;
  }
  if (typeof r.timeoutSec === "number" && Number.isFinite(r.timeoutSec)) out.timeoutSec = Math.min(600, Math.max(10, Math.round(r.timeoutSec)));
  if (typeof r.maxRetries === "number" && Number.isFinite(r.maxRetries)) out.maxRetries = Math.min(5, Math.max(0, Math.round(r.maxRetries)));
  if (Array.isArray(r.recentTools)) out.recentTools = (r.recentTools.filter((x) => typeof x === "string") as Settings["recentTools"]).slice(0, 6);
  return out;
}

interface SettingsState {
  settings: Settings;
  loaded: boolean;
  keyStatus: KeyStatus;
  store: Store | null;
  init(store: Store): Promise<void>;
  update(patch: Partial<Settings>): void;
  setKeyStatus(s: KeyStatus): void;
  markUsed(id: Settings["recentTools"][number]): void;
  reset(): Promise<void>;
}

export const useSettings = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,
  keyStatus: { openai: false, anthropic: false, openai_compatible: false },
  store: null,
  async init(store) {
    const raw = await store.loadSettings();
    set({ settings: sanitizeSettings(raw), loaded: true, store });
  },
  update(patch) {
    const settings = { ...get().settings, ...patch };
    set({ settings });
    void get().store?.saveSettings(settings as unknown as Record<string, unknown>);
  },
  setKeyStatus(keyStatus) {
    set({ keyStatus });
  },
  markUsed(id) {
    const recent = [id, ...get().settings.recentTools.filter((x) => x !== id)].slice(0, 6);
    get().update({ recentTools: recent });
  },
  async reset() {
    const settings = { ...DEFAULT_SETTINGS, language: get().settings.language, theme: get().settings.theme };
    set({ settings });
    await get().store?.saveSettings(settings as unknown as Record<string, unknown>);
  },
}));

/** Whether the selected text provider is usable (key stored, or a base URL for local servers). */
export function textProviderReady(s: Settings, keys: KeyStatus): boolean {
  if (s.textProvider === "openai_compatible") return !!s.compatibleBaseUrl.trim();
  return keys[s.textProvider];
}

export function imageProviderReady(s: Settings, keys: KeyStatus): boolean {
  return s.imageProvider === "openai" && keys.openai;
}
