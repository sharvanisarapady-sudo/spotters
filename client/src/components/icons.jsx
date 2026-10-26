// Small, purpose-built line icons for Spotters.com.
// Kept as inline SVG (not an npm icon package) so the marketing
// page has zero extra install surface.

const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

export function IconCrosshair(props) {
  return (
    <svg viewBox="0 0 24 24" {...base} {...props}>
      <circle cx="12" cy="12" r="7.5" />
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconLayers(props) {
  return (
    <svg viewBox="0 0 24 24" {...base} {...props}>
      <path d="M12 3 3 8l9 5 9-5-9-5Z" />
      <path d="M3 13l9 5 9-5" />
    </svg>
  );
}

export function IconTimer(props) {
  return (
    <svg viewBox="0 0 24 24" {...base} {...props}>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2.5 2.5M9.5 2h5" />
    </svg>
  );
}

export function IconChart(props) {
  return (
    <svg viewBox="0 0 24 24" {...base} {...props}>
      <path d="M4 20V10M11 20V4M18 20v-7" />
      <path d="M2 20h20" />
    </svg>
  );
}

export function IconSpark(props) {
  return (
    <svg viewBox="0 0 24 24" {...base} {...props}>
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M6 6l2 2M16 16l2 2M18 6l-2 2M8 16l-2 2" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function IconMic(props) {
  return (
    <svg viewBox="0 0 24 24" {...base} {...props}>
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v4M9 22h6" />
    </svg>
  );
}

export function IconBookOpen(props) {
  return (
    <svg viewBox="0 0 24 24" {...base} {...props}>
      <path d="M12 6c-2-1.5-5-2-8-1.5v13.5c3-0.5 6 0 8 1.5 2-1.5 5-2 8-1.5V4.5C17 4 14 4.5 12 6Z" />
      <path d="M12 6v13.5" />
    </svg>
  );
}

export function IconVideo(props) {
  return (
    <svg viewBox="0 0 24 24" {...base} {...props}>
      <rect x="2.5" y="6" width="13" height="12" rx="2" />
      <path d="M15.5 10l6-3.5v11l-6-3.5" />
    </svg>
  );
}

export function IconStethoscope(props) {
  return (
    <svg viewBox="0 0 24 24" {...base} {...props}>
      <path d="M5 3v6a4 4 0 0 0 8 0V3" />
      <path d="M9 13v2a5 5 0 0 0 10 0v-1.5" />
      <circle cx="19.5" cy="12.5" r="1.6" />
    </svg>
  );
}

export function IconGraduate(props) {
  return (
    <svg viewBox="0 0 24 24" {...base} {...props}>
      <path d="M2 8l10-4 10 4-10 4-10-4Z" />
      <path d="M6 10.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-5.5M22 8v6" />
    </svg>
  );
}

export function IconArrowRight(props) {
  return (
    <svg viewBox="0 0 24 24" {...base} {...props}>
      <path d="M4 12h16M13 5l7 7-7 7" />
    </svg>
  );
}

export function IconCheck(props) {
  return (
    <svg viewBox="0 0 24 24" {...base} {...props}>
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

export function IconBookmark(props) {
  return (
    <svg viewBox="0 0 24 24" {...base} {...props}>
      <path d="M6 3h12v18l-6-4-6 4V3Z" />
    </svg>
  );
}

export function IconTrophy(props) {
  return (
    <svg viewBox="0 0 24 24" {...base} {...props}>
      <path d="M7 4h10v4a5 5 0 0 1-10 0V4Z" />
      <path d="M7 5H4v2a3 3 0 0 0 3 3M17 5h3v2a3 3 0 0 1-3 3" />
      <path d="M12 13v3M9 20h6M10 17h4v3h-4z" />
    </svg>
  );
}

export function IconZoomIn(props) {
  return (
    <svg viewBox="0 0 24 24" {...base} {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3M11 8v6M8 11h6" />
    </svg>
  );
}

export function IconZoomOut(props) {
  return (
    <svg viewBox="0 0 24 24" {...base} {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3M8 11h6" />
    </svg>
  );
}

export function IconReset(props) {
  return (
    <svg viewBox="0 0 24 24" {...base} {...props}>
      <path d="M3 12a9 9 0 1 1 3 6.7" />
      <path d="M3 20v-5h5" />
    </svg>
  );
}

export function IconExpand(props) {
  return (
    <svg viewBox="0 0 24 24" {...base} {...props}>
      <path d="M8 3H4v4M16 3h4v4M8 21H4v-4M16 21h4v-4" />
    </svg>
  );
}

export function IconBack(props) {
  return (
    <svg viewBox="0 0 24 24" {...base} {...props}>
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </svg>
  );
}
