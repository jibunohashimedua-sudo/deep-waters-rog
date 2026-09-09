"use client";
import Link from "next/link";

/**
 * The private members row.
 *
 * In its own module for the same reason as the pastoral rows: MoreSheet
 * ships on every signed-in page, so a route named inline here would be a
 * route every member could read out of their own bundle. This file is
 * imported through next/dynamic and requested only when
 * my_private_members() has already come back with rows — which it does for
 * exactly one account. Another admin never asks for the chunk, so another
 * admin never receives the word.
 *
 * See components/PastoralNavHelpers.tsx for the same reasoning at length.
 */
export default function MoreSheetPrivateRow({
  className,
  onClose
}: {
  className: string;
  onClose: () => void;
}) {
  return (
    <Link href="/private" onClick={onClose} className={className}>
      Private members
    </Link>
  );
}
