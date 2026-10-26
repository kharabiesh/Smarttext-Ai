import { isTauri, tauriInvoke } from "./platform";

function utf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** Saves a file through the native "Save as" dialog (desktop) or a browser download. Returns the path, if known. */
export async function saveFile(opts: {
  defaultName: string;
  base64: string;
  mimeType: string;
  filterName: string;
  extensions: string[];
}): Promise<string | null> {
  if (isTauri()) {
    return tauriInvoke<string | null>("save_file", {
      defaultName: opts.defaultName,
      contentBase64: opts.base64,
      filterName: opts.filterName,
      extensions: opts.extensions,
    });
  }
  const a = document.createElement("a");
  a.href = `data:${opts.mimeType};base64,${opts.base64}`;
  a.download = opts.defaultName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  return opts.defaultName;
}

export function saveText(name: string, text: string) {
  return saveFile({ defaultName: name, base64: utf8ToBase64(text), mimeType: "text/plain;charset=utf-8", filterName: "Text", extensions: ["txt", "md"] });
}

export async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
}
