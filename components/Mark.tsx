// The Deep Waters mark. Draws in currentColor and defaults to the theme-aware
// .dw-mark class (purple in light, cream in dark). Callers can override the
// className to hard-code a colour when they know the background — e.g. a
// hero that's always purple can force cream regardless of theme.
type Props = {
  size?: number;
  className?: string;
  title?: string;
};

export default function Mark({ size = 40, className = "dw-mark", title }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className={className}
    >
      <rect x="18" y="24" width="64" height="11" rx="5.5" />
      <rect x="26" y="42" width="48" height="11" rx="5.5" />
      <rect x="34" y="60" width="32" height="11" rx="5.5" />
      <rect x="42" y="78" width="16" height="11" rx="5.5" />
    </svg>
  );
}
