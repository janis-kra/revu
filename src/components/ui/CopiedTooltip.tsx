import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export interface CopiedTooltipProps {
  show: boolean;
  /** Extra positioning / layout classes (e.g. absolute placement). */
  className?: string;
  label?: string;
}

/**
 * Short-lived "Copied!" chip using the same green as diff additions.
 */
export function CopiedTooltip({
  show,
  className,
  label = "Copied!",
}: CopiedTooltipProps) {
  if (!show) return null;

  return (
    <span
      role="status"
      aria-live="polite"
      className={twMerge(
        clsx(
          "pointer-events-none z-20 whitespace-nowrap rounded px-2 py-0.5 text-xs font-medium shadow-sm",
          // Match DiffLine addition colors
          "bg-green-100 text-green-900 dark:bg-green-900/30 dark:text-green-100",
          className,
        ),
      )}
    >
      {label}
    </span>
  );
}
