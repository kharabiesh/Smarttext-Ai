export const IMAGE_STYLES = ["none", "photographic", "digital_art", "watercolor", "3d_render", "line_art", "cinematic", "anime"] as const;
export type ImageStyle = (typeof IMAGE_STYLES)[number];

const SUFFIX: Record<ImageStyle, string> = {
  none: "",
  photographic: "Style: realistic photograph, natural lighting, sharp focus.",
  digital_art: "Style: polished digital illustration, vibrant colours.",
  watercolor: "Style: soft watercolour painting on textured paper.",
  "3d_render": "Style: high-quality 3D render, soft global illumination.",
  line_art: "Style: clean black-and-white line art.",
  cinematic: "Style: cinematic film still, dramatic lighting, shallow depth of field.",
  anime: "Style: anime illustration, clean cel shading.",
};

/** Style presets are applied by appending a short instruction to the prompt (the Images API has no style field for gpt-image models). */
export function stylePromptSuffix(style: string): string {
  const s = SUFFIX[style as ImageStyle];
  return s ? `\n\n${s}` : "";
}
