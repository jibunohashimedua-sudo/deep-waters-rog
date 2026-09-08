// The Elite lockup, for the app header of a pastoral reader.
//
// Drawn from public/deep-waters-elite-lockup.svg — same arrangement, same
// proportions: the mark, the wordmark, a hairline, then ELITE. Two things
// are deliberately not carried over from the file. Its fill is a two-stop
// gradient, and Fathom does not add gradients; and its wordmark is set in
// Poppins, which is not one of this app's three faces. Both would also be
// fixed colours in a header that has to work in dark as well as light.
//
// So the geometry comes from the asset and the colour comes from the
// tokens: currentColor throughout, exactly like <Mark>, sitting at the same
// size and in the same place as the standard lockup it replaces. The raw
// files stay in /public for anywhere a flat image is the right answer.
type Props = {
  /** Matches the standard header lockup's mark size. */
  size?: number;
};

export default function EliteLockup({ size = 22 }: Props) {
  return (
    <span className="dw-elite-lockup" aria-label="Deep Waters Elite">
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
        className="dw-mark"
        aria-hidden
      >
        <rect x="18" y="24" width="64" height="11" rx="5.5" />
        <rect x="26" y="42" width="48" height="11" rx="5.5" />
        <rect x="34" y="60" width="32" height="11" rx="5.5" />
        <rect x="42" y="78" width="16" height="11" rx="5.5" />
      </svg>
      <span className="dw-elite-word" aria-hidden>
        Deep Waters
      </span>
      <span className="dw-elite-rule" aria-hidden />
      <span className="dw-elite-tag" aria-hidden>
        Elite
      </span>
    </span>
  );
}
