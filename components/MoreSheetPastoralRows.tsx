"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import Icon from "./Icons";
import { matchesPastoralMoreRoute } from "./PastoralNavHelpers";

type Props = {
  /** The sheet's own row class, passed in so these two rows are the same
      object as the six around them rather than a near-copy of them. */
  className: string;
  onClose: () => void;
  /**
   * Reports whether the current path is one of these rows' routes, so the
   * bars can light the More tab without shared code ever naming a
   * pastoral route. Non-pastoral readers never mount this component, so
   * the pastoral half of that decision is simply never true for them.
   */
  onMoreMatch?: (matches: boolean) => void;
};

/**
 * The More sheet's two pastoral rows, in their own module so they can be
 * loaded on demand.
 *
 * They used to sit inline behind `{isPastoral && …}`, which is correct at
 * runtime and wrong in the bundle: MoreSheet is a client component reached
 * from Nav, so it ships on every signed-in page, and the words "Church
 * pulse", "Sermons" and the paths behind them shipped with it. A member who
 * opened devtools could read the names of two features they have no access
 * to.
 *
 * Split out and imported through next/dynamic, this file is its own chunk
 * and the chunk is only ever requested when the flag is true. What remains
 * in the shared bundle is the two icon names in the ICONS vocabulary
 * (`pulse`, `sermon`), which are generic words and name nothing.
 *
 * Church pulse sits above Sermons: it is about people, and a sermon is
 * about a passage. Neither is a bottom tab and neither is inside Admin —
 * admin is running the app.
 */
export default function MoreSheetPastoralRows({
  className,
  onClose,
  onMoreMatch
}: Props) {
  const pathname = usePathname();

  useEffect(() => {
    onMoreMatch?.(matchesPastoralMoreRoute(pathname ?? ""));
  }, [pathname, onMoreMatch]);

  // Nothing to undo on unmount beyond the claim itself: if these rows go
  // away, the path they matched is no longer anybody's business.
  useEffect(() => () => onMoreMatch?.(false), [onMoreMatch]);

  return (
    <>
      <Link href="/pulse" onClick={onClose} className={className}>
        <Icon name="pulse" /> Church pulse
      </Link>
      <Link href="/sermons" onClick={onClose} className={className}>
        <Icon name="sermon" /> Sermons
      </Link>
    </>
  );
}
