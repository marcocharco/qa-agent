import manifest from "../bugs.json";

// Control build: NEXT_PUBLIC_NO_BUGS=1 turns every planted bug off.
export const bugs =
  process.env.NEXT_PUBLIC_NO_BUGS === "1"
    ? { couponMissesTeamAnnual: false, volumeDiscountOffByOne: false, teamMinSeatsDisplayOnly: false, annualCouponWrongBase: false }
    : manifest;
