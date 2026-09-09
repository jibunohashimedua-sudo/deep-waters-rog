"use client";
/**
 * A checkbox, or a radio, drawn rather than inherited.
 *
 * The native control is still the control: it keeps the label
 * association, the keyboard, the accessibility tree and the form value.
 * It is visually hidden and the square beside it is driven by its
 * :checked state in CSS. Nothing here is a div with a click handler.
 *
 * Square, both of them. A radio is round on every other platform because
 * round means "one of these"; here round means "you can press this", the
 * row is what you press, and the mark is not the target.
 */
export default function Check({
  type = "checkbox",
  label,
  ...props
}: {
  type?: "checkbox" | "radio";
  label: React.ReactNode;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">) {
  return (
    <label className="control-row">
      <input {...props} type={type} className="control-native" />
      <span className="control-box" aria-hidden />
      <span>{label}</span>
    </label>
  );
}
