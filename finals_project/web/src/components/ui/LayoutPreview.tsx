"use client";

interface LayoutPreviewProps {
  /** Raw `layout_file` value: https URL, legacy filename, or empty. */
  value: string;
  /** Thumbnail box size in px (table cell vs detail card). */
  size?: number;
  className?: string;
}

function isUrl(v: string): boolean {
  return v.startsWith("http://") || v.startsWith("https://");
}

function isImageUrl(v: string): boolean {
  const lower = v.split("?")[0].toLowerCase();
  return (
    lower.endsWith(".png") ||
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg") ||
    lower.endsWith(".webp") ||
    lower.endsWith(".gif")
  );
}

/**
 * Layout file preview - renders an inline image thumbnail for uploaded
 * image URLs (click opens full file), a "View file" link for uploaded
 * non-images (PDFs), and plain text for legacy filename-only records.
 */
export function LayoutPreview({
  value,
  size = 56,
  className = "",
}: LayoutPreviewProps) {
  if (!value) return <span className={className}>-</span>;
  if (!isUrl(value)) {
    return (
      <span
        className={`text-xs underline decoration-dotted break-all ${className}`}
      >
        {value}
      </span>
    );
  }
  if (!isImageUrl(value)) {
    return (
      <a
        href={value}
        target="_blank"
        rel="noopener noreferrer"
        className={`text-xs text-printflow-primary hover:underline ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        View file 
      </a>
    );
  }
  return (
    <a
      href={value}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      title="Open full layout file"
      className={`inline-block shrink-0 ${className}`}
    >
      {/* Plain <img>: next/image needs a server, this app is static-export. */}
      <img
        src={value}
        alt="Order layout preview"
        width={size}
        height={size}
        loading="lazy"
        className="rounded-lg object-cover border border-printflow-outline-variant/50 bg-printflow-surface-container"
        style={{ width: size, height: size }}
      />
    </a>
  );
}
