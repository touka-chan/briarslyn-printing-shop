import { CSSProperties } from "react";

interface SkeletonProps {
 variant?: "text" | "avatar" | "rect" | "row";
 className?: string;
 style?: CSSProperties;
 width?: string | number;
 height?: string | number;
}

const VARIANT_CLASSES: Record<NonNullable<SkeletonProps["variant"]>, string> = {
 text: "h-3 w-full rounded",
 avatar: "w-10 h-10 rounded-full",
 rect: "w-full rounded-lg",
 row: "h-12 w-full rounded-lg",
};

export function Skeleton({
 variant = "text",
 className = "",
 style,
 width,
 height,
}: SkeletonProps) {
 const styleWithDims: CSSProperties = {
  ...style,
  ...(width !== undefined ? { width } : {}),
  ...(height !== undefined ? { height } : {}),
 };
 return (
  <div
   role="status"
   aria-label="Loading"
   className={`skeleton-shimmer ${VARIANT_CLASSES[variant]} ${className}`.trim()}
   style={styleWithDims}
  />
 );
}
