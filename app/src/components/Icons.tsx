import type { ReactNode } from "react";
import type { DocumentKind } from "../types";

interface IconProps {
  size?: number;
  className?: string;
  strokeWidth?: number;
}

function Svg({ size = 18, className, strokeWidth = 1.7, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export function IconOpen(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h4l2 2H19a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
      <path d="M3 10h17" />
    </Svg>
  );
}

export function IconPlus(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

export function IconPencil(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m4 20 4.2-1 10.3-10.3a2.1 2.1 0 0 0-3-3L5.2 16 4 20Z" />
      <path d="m14.5 6.3 3 3" />
    </Svg>
  );
}

export function IconSave(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 4h11l3 3v13H5z" />
      <path d="M8 4v5h7V4M8 20v-6h8v6" />
    </Svg>
  );
}

export function IconSearch(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </Svg>
  );
}

export function IconChevronLeft(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m14.5 5.5-6 6.5 6 6.5" />
    </Svg>
  );
}

export function IconChevronRight(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m9.5 5.5 6 6.5-6 6.5" />
    </Svg>
  );
}

export function IconChevronDown(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m6 9.5 6 6 6-6" />
    </Svg>
  );
}

export function IconZoomIn(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="M10.5 8v5M8 10.5h5M15 15l4.5 4.5" />
    </Svg>
  );
}

export function IconZoomOut(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="M8 10.5h5M15 15l4.5 4.5" />
    </Svg>
  );
}

export function IconFitWidth(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 5v14M20 5v14" />
      <path d="M8 12h8M8 12l2.5-2.5M8 12l2.5 2.5M16 12l-2.5-2.5M16 12l-2.5 2.5" />
    </Svg>
  );
}

export function IconSidebar(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="4.5" width="18" height="15" rx="2" />
      <path d="M9 4.5v15" />
    </Svg>
  );
}

export function IconSun(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </Svg>
  );
}

export function IconMoon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M20 14.5A8.2 8.2 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z" />
    </Svg>
  );
}

export function IconPalette(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.5 0 2.2-1 1.6-2.1-.7-1.5.2-2.9 1.9-2.9h1.2a3.8 3.8 0 0 0 3.8-3.8c0-4.5-3.8-8.2-8.5-8.2Z" />
      <path d="M7.5 10h.01M9.5 6.8h.01M13.5 6.5h.01M17 8.8h.01" />
    </Svg>
  );
}

export function IconSettings(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" />
      <path d="m19.4 15 .1.1a1.8 1.8 0 0 1-2.5 2.5l-.1-.1a1.8 1.8 0 0 0-3.1 1.3v.2a1.8 1.8 0 0 1-3.6 0v-.2a1.8 1.8 0 0 0-3.1-1.3l-.1.1a1.8 1.8 0 1 1-2.5-2.5l.1-.1A1.8 1.8 0 0 0 3.3 12v-.1a1.8 1.8 0 0 1 0-3.6h.2a1.8 1.8 0 0 0 1.3-3.1l-.1-.1a1.8 1.8 0 1 1 2.5-2.5l.1.1a1.8 1.8 0 0 0 3.1-1.3v-.2a1.8 1.8 0 0 1 3.6 0v.2a1.8 1.8 0 0 0 3.1 1.3l.1-.1a1.8 1.8 0 1 1 2.5 2.5l-.1.1a1.8 1.8 0 0 0 1.3 3.1h.2a1.8 1.8 0 0 1 0 3.6h-.2a1.8 1.8 0 0 0-1.3 3.1Z" />
    </Svg>
  );
}

export function IconGlass(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
      <path d="M7 17 17 7M12 17l5-5" />
    </Svg>
  );
}

export function IconClose(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m6 6 12 12M18 6 6 18" />
    </Svg>
  );
}

export function IconFile(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 3.5h7l5 5v12H6z" />
      <path d="M13 3.5v5h5M9 13h6M9 16.5h4" />
    </Svg>
  );
}

export function IconFilePdf(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 3.5h7l5 5v12H6z" />
      <path d="M13 3.5v5h5" />
      <path d="M8.6 17.5c.9-2.5 1.2-5.4 1.4-7.3.2-1.4 1.4-1.5 1.4-.4 0 1.9-2 6.1-1.7 7.3.2 1 2.1-1 3.4-2.1" />
    </Svg>
  );
}

export function IconImage(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <circle cx="9" cy="10" r="1.5" />
      <path d="m4 17 4.5-4.5 3.5 3.5 3-3 5 5" />
    </Svg>
  );
}

export function IconTable(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <path d="M3.5 9.5h17M3.5 14.5h17M9.5 9.5v10M15 9.5v10" />
    </Svg>
  );
}

export function IconCode(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m8.5 7-5 5 5 5M15.5 7l5 5-5 5M13.5 4l-3 16" />
    </Svg>
  );
}

export function IconDoc(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 3.5h7l5 5v12H6z" />
      <path d="M13 3.5v5h5M9 12h6M9 15h6M9 18h4" />
    </Svg>
  );
}

export function IconPresentation(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="4.5" width="18" height="12" rx="2" />
      <path d="M12 16.5v3M8.5 19.5h7" />
      <path d="m9 12 2.2-2.6 2 1.8L16 8" />
    </Svg>
  );
}

export function IconBook(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 5.5A2 2 0 0 1 6 3.5h13v16H6a2 2 0 0 0-2 2z" />
      <path d="M4 5.5v14M8 7.5h7M8 11h5" />
    </Svg>
  );
}

export function IconTrash(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4.5 7h15M9.5 7V5h5v2M6.5 7l.8 12h9.4l.8-12M10 10.5v5M14 10.5v5" />
    </Svg>
  );
}

export function IconClock(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </Svg>
  );
}

export function IconLock(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d="M8 10V7.5a4 4 0 0 1 8 0V10M12 14v2.5" />
    </Svg>
  );
}

export function IconKeyboard(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M6.5 9.5h.01M9.5 9.5h.01M12.5 9.5h.01M15.5 9.5h.01M18 9.5h.01M6.5 12.5h.01M9.5 12.5h.01M12.5 12.5h.01M15.5 12.5h.01M18 12.5h.01M8 15.5h8" />
    </Svg>
  );
}

export function IconList(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />
    </Svg>
  );
}

export function IconArrowLeft(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M20 12H4M10 6l-6 6 6 6" />
    </Svg>
  );
}

export function IconAlert(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3.5 21 20H3z" />
      <path d="M12 9v5M12 17h.01" />
    </Svg>
  );
}

export function IconInfo(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v6M12 7.5h.01" />
    </Svg>
  );
}

export function IconWrap(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 6h16M4 12h12a3 3 0 1 1 0 6h-2M4 18h4M14 15l-2 3 2 3" />
    </Svg>
  );
}

export function IconHash(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9.5 3.5 7 20.5M17 3.5l-2.5 17M4 8.5h16M3 15.5h16" />
    </Svg>
  );
}

export function IconCheck(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m4.5 12.5 5 5 10-11" />
    </Svg>
  );
}

export function IconRotate(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M20 12a8 8 0 1 1-2.4-5.7" />
      <path d="M20 4v5h-5" />
    </Svg>
  );
}

export function IconFolder(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h4l2 2h7A1.5 1.5 0 0 1 19 9.5v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
    </Svg>
  );
}

export function IconFolderOpen(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 8V7a2 2 0 0 1 2-2h4l2 2h5a2 2 0 0 1 2 2v1" />
      <path d="m3 9 2.1 8.4A2 2 0 0 0 7 19h11.3a2 2 0 0 0 1.9-1.4L21.5 10H6a2 2 0 0 0-2 1.6L3.3 15" />
    </Svg>
  );
}

export function IconFolderPlus(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h4l2 2h7A1.5 1.5 0 0 1 19 9.5v1.5" />
      <path d="M3 11v5.5a2 2 0 0 0 2 2h8" />
      <path d="M18 15v6M15 18h6" />
    </Svg>
  );
}

export function IconVault(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <circle cx="12" cy="12" r="3.4" />
      <path d="M12 8.6V7M12 17v-1.6M8.6 12H7M17 12h-1.6M6.5 6.5h2M15.5 6.5h2M6.5 17.5h2M15.5 17.5h2" />
    </Svg>
  );
}

export function IconRefresh(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M20 11a8 8 0 0 0-14.3-4.9L4 8" />
      <path d="M4 4v4h4" />
      <path d="M4 13a8 8 0 0 0 14.3 4.9L20 16" />
      <path d="M20 20v-4h-4" />
    </Svg>
  );
}

export function IconArrowRight(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 12h16M14 6l6 6-6 6" />
    </Svg>
  );
}

export function KindIcon({ kind, ...props }: IconProps & { kind: DocumentKind }) {
  switch (kind) {
    case "pdf":
      return <IconFilePdf {...props} />;
    case "image":
      return <IconImage {...props} />;
    case "csv":
      return <IconTable {...props} />;
    case "spreadsheet":
      return <IconTable {...props} />;
    case "code":
      return <IconCode {...props} />;
    case "docx":
      return <IconDoc {...props} />;
    case "presentation":
      return <IconPresentation {...props} />;
    case "markdown":
    case "text":
    default:
      return <IconFile {...props} />;
  }
}

export function BrandMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect x="1" y="1" width="30" height="30" rx="9" fill="currentColor" opacity="0.1" />
      <path
        d="M9 22V10.5c0-.8.7-1.5 1.5-1.5h1.2c.6 0 1.1.3 1.3.9l2.6 6 2.6-6c.2-.6.7-.9 1.3-.9h1.2c.8 0 1.5.7 1.5 1.5V22"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <path d="M22 24.5h-5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}
