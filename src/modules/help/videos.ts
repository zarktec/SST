import meta from "./video-meta.json";

type VideoMeta = { title: string; seconds: number };

const VIDEOS = meta as Record<string, VideoMeta>;

/** Video grabado para la guía `slug` (los genera `pnpm help:videos`; ver `help-videos/`). */
export const videoOf = (slug: string): VideoMeta | undefined => VIDEOS[slug];

export const videoSlugs = (): string[] => Object.keys(VIDEOS);

/** `75` → `1:15`. */
export const formatDuration = (seconds: number): string =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
