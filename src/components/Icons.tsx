import type { SVGProps } from "react";

export type IconName =
  | "file-plus"
  | "folder-open"
  | "save"
  | "save-as"
  | "download"
  | "file-pdf"
  | "file-code"
  | "play"
  | "globe"
  | "plus"
  | "message"
  | "x"
  | "chevron-down"
  | "chevron-right"
  | "arrow-left"
  | "arrow-right"
  | "clock"
  | "pause"
  | "reset"
  | "check"
  | "alert"
  | "image"
  | "monitor"
  | "more";

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 17, className, ...rest }: IconProps) {
  const paths = (() => {
    switch (name) {
      case "file-plus":
        return (
          <>
            <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
            <path d="M14 3v5h5" />
            <path d="M12 12v6M9 15h6" />
          </>
        );
      case "folder-open":
        return (
          <>
            <path d="M3 7a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v1" />
            <path d="M3 9.5V18a2 2 0 0 0 2 2h12.2a2 2 0 0 0 1.9-1.4l2-6.6a1 1 0 0 0-.9-1.3H6.2a2 2 0 0 0-1.9 1.4L3 17" />
          </>
        );
      case "save":
        return (
          <>
            <path d="M5 3h11l3 3v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
            <path d="M7 3v6h8V3" />
            <path d="M7 21v-7h10v7" />
          </>
        );
      case "save-as":
        return (
          <>
            <path d="M5 3h9l3 3v8" />
            <path d="M5 3v18h6" />
            <path d="M7 3v6h7V3" />
            <path d="M14.5 21l-1 1-3 .5.5-3 7-7a1.4 1.4 0 0 1 2 2z" />
          </>
        );
      case "download":
        return (
          <>
            <path d="M12 3v12" />
            <path d="M7 10l5 5 5-5" />
            <path d="M4 19v2h16v-2" />
          </>
        );
      case "file-pdf":
      case "file-code":
        return (
          <>
            <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
            <path d="M14 3v5h5" />
            {name === "file-code" ? (
              <path d="M9.5 12.5L8 14l1.5 1.5M14.5 12.5L16 14l-1.5 1.5M12.8 11.5l-1.6 5" />
            ) : (
              <path d="M8.5 17v-4h1.2a1.3 1.3 0 0 1 0 2.6H8.5M13 13v4M13 17h1M15.5 13v4M15.5 13h1.8M15.5 15h1.4" />
            )}
          </>
        );
      case "play":
        return <path d="M8 5.5v13l10-6.5z" fill="currentColor" stroke="none" />;
      case "globe":
        return (
          <>
            <circle cx="12" cy="12" r="9" />
            <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
          </>
        );
      case "plus":
        return <path d="M12 5v14M5 12h14" />;
      case "message":
        return (
          <path d="M21 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z" />
        );
      case "x":
        return <path d="M6 6l12 12M18 6L6 18" />;
      case "chevron-down":
        return <path d="M6 9l6 6 6-6" />;
      case "chevron-right":
        return <path d="M9 6l6 6-6 6" />;
      case "arrow-left":
        return <path d="M19 12H5M11 18l-6-6 6-6" />;
      case "arrow-right":
        return <path d="M5 12h14M13 6l6 6-6 6" />;
      case "clock":
        return (
          <>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </>
        );
      case "pause":
        return (
          <>
            <path d="M9 5v14M15 5v14" strokeWidth="3" />
          </>
        );
      case "reset":
        return (
          <>
            <path d="M4 4v6h6" />
            <path d="M4.5 10a8 8 0 1 1 .8 8" />
          </>
        );
      case "check":
        return <path d="M20 6L9 17l-5-5" />;
      case "alert":
        return (
          <>
            <path d="M12 3l9 17H3z" />
            <path d="M12 9v5M12 17v.01" />
          </>
        );
      case "image":
        return (
          <>
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <circle cx="9" cy="10" r="2" />
            <path d="M21 16l-5-5-9 9" />
          </>
        );
      case "monitor":
        return (
          <>
            <rect x="3" y="4" width="18" height="13" rx="2" />
            <path d="M8 21h8M12 17v4" />
          </>
        );
      case "more":
        return (
          <>
            <circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" />
            <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
            <circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none" />
          </>
        );
      default:
        return null;
    }
  })();

  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className ? `icon ${className}` : "icon"}
      aria-hidden="true"
      {...rest}
    >
      {paths}
    </svg>
  );
}

export function LogoMark({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M4 19V6.5L12 14l8-7.5V19" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="18.5" r="1.7" fill="currentColor" />
    </svg>
  );
}
