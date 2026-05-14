import type { AspectRatioId } from "./cropUtils";

export type BackgroundId =
  | "cozy_sofa"
  | "studio"
  | "windowsill"
  | "armchair"
  | "blanket"
  | "greenery"
  | "random";

export type BackgroundPreset = {
  id: BackgroundId;
  name: string;
  short: string;
  prompt: string;
};

export type SubjectPlacement = {
  leftPct: number;
  topPct: number;
  rightPct: number;
  bottomPct: number;
  centerXPct: number;
  centerYPct: number;
  widthPct: number;
  heightPct: number;
};

export const BACKGROUNDS: BackgroundPreset[] = [
  {
    id: "cozy_sofa",
    name: "Уютный диван",
    short: "Диван",
    prompt:
      "A cozy neutral sofa upholstery background plate, photographed close-up. The lower two thirds should read as one continuous soft fabric support surface that continues to the bottom edge of the frame behind the future cat cutout. Avoid a full empty sofa shape, visible front cushion edge, vertical seat face, or furniture geometry that could make the cat look below the seat. Warm ambient light, shallow depth of field, clean home background."
  },
  {
    id: "studio",
    name: "Студийный",
    short: "Студия",
    prompt:
      "A professional pet photography studio with a seamless light gray paper sweep and floor. Soft diffused light from two softboxes. Minimal clean catalog look, no props, no surreal shapes."
  },
  {
    id: "windowsill",
    name: "Подоконник",
    short: "Окно",
    prompt:
      "A wide clean wooden windowsill surface spanning the full frame width under the future cat cutout, with soft natural daylight and a blurred window view behind. The sill must be a continuous support plane that continues behind the reserved cat area, not a small object off to the side, not a ledge higher than the cat contact point, and not a narrow edge that makes the cat appear to hang in front of the window."
  },
  {
    id: "armchair",
    name: "Кресло",
    short: "Кресло",
    prompt:
      "A close-up plush armchair upholstery background plate for compositing, not a full chair portrait. Render a broad continuous seat cushion fabric surface under and behind the future cat cutout, continuing down to the bottom edge of the frame. Add only a softly blurred chair-back texture in the upper background. Do not draw a complete empty armchair, visible front cushion edge, vertical seat face, high armrests crossing the subject area, or a separate chair placed away from the subject area."
  },
  {
    id: "blanket",
    name: "Плед",
    short: "Плед",
    prompt:
      "A soft knitted blanket or bed blanket close-up background plate spanning the frame as one continuous support surface directly under and behind the future cat cutout, with gentle fabric folds and warm cozy natural light. Do not show a bed edge, mattress side, blanket drop-off, pillow, headboard, or any horizontal furniture edge that could make the cat appear below the bed surface."
  },
  {
    id: "greenery",
    name: "Зелень",
    short: "Зелень",
    prompt:
      "A calm indoor plant corner with plants only in the background and frame edges, natural window light, and a clean neutral floor or low surface spanning the lower half. Keep the central foreground empty for compositing."
  },
  {
    id: "random",
    name: "Случайный",
    short: "Случайно",
    prompt: ""
  }
];

export const GENERATION_SYSTEM_PROMPT =
  "You are a professional pet adoption photography background designer. Generate only a clean photorealistic background for a cat adoption portrait. Do not generate a cat, animal, person, hand, text, logo, watermark, cage, litter box, food bowl, or distracting object. Leave the central subject area visually calm so an existing cat cutout can be composited on top. Use flattering soft light, realistic shadows, natural perspective, and slight background bokeh.";

export function resolveBackground(id: BackgroundId): BackgroundPreset {
  if (id !== "random") {
    return BACKGROUNDS.find((item) => item.id === id) ?? BACKGROUNDS[0];
  }
  const concrete = BACKGROUNDS.filter((item) => item.id !== "random");
  return concrete[Math.floor(Math.random() * concrete.length)];
}

export function buildBackgroundPrompt(
  description: string,
  aspectRatio: AspectRatioId,
  placement?: SubjectPlacement
): string {
  const outputFormat = aspectRatio === "original" ? "same aspect ratio as the prepared photo" : aspectRatio;
  const placementText = placement
    ? `The existing cat cutout will be composited locally in this exact area:
- bounding box left ${placement.leftPct}%, top ${placement.topPct}%, right ${placement.rightPct}%, bottom ${placement.bottomPct}%
- visual center ${placement.centerXPct}% x ${placement.centerYPct}%
- subject size ${placement.widthPct}% of frame width and ${placement.heightPct}% of frame height

Composition rules:
- treat ${placement.bottomPct}% of frame height as the lowest visible part of the real cat cutout
- the reserved bounding box is not empty air: it is the area that will be covered by the real cat, so the support surface must exist behind that whole area
- for beds, blankets, sofas, armchairs, and windowsills, generate a close-up background plate where the support surface continues through the reserved cat area and down to the bottom edge of the frame
- never put a visible chair seat edge, sofa cushion edge, windowsill edge, bed edge, mattress side, blanket drop-off, floor line, or vertical furniture face through the reserved box or above the cat's lowest contact point
- avoid strong horizontal seams or perspective breaks between ${Math.max(0, placement.centerYPct - 8)}% and ${Math.min(100, placement.bottomPct + 6)}% of frame height
- the support surface must span the full width or at least the whole subject area plus generous margins
- do not place the main chair, sofa, windowsill, blanket, or surface somewhere else in the image
- avoid perspective that would make the subject float, hang below the seat, or miss the support surface
- the generated background must look like the existing cat cutout is already resting on that support plane
- keep the subject bounding box visually calm and empty because the original cat pixels will cover it`
    : "Keep the central subject area visually calm and empty for a cat cutout.";

  return `Generate a photorealistic empty background for a pet adoption / PR photo.

Important compositing requirement:
- the cat will be added later from the original photo
- do not include any cat or animal in the generated image
- do not include a pet-shaped placeholder, silhouette, shadow, body, fur, ears, eyes, paws, or tail
- lighting direction should work naturally for a cat placed in the foreground
- the output must be a background plate for compositing, not a finished scene with a missing subject

${placementText}

Background: ${description}

Output format: ${outputFormat}.

The image must be a realistic high-quality photo background with soft flattering light and shallow depth of field. No visible text, logos, watermarks, people, hands, animals, cages, food bowls, litter boxes, toys, clutter, empty standalone furniture placed away from the subject, or surreal studio artifacts.`;
}
