/**
 * Moving pub takes a while to settle in. Without this you could hop to whichever pub has the
 * best perk for the next ten seconds (double Lucky Rounds as a Free Round appears, cheaper
 * drinkers just before a big buy) and straight back again.
 */
export const PUB_COOLDOWN_SECONDS = 5 * 60;
