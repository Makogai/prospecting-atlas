/**
 * Grind estimates: how many minerals an hour, and how long until the one you want.
 *
 * Two things the wiki states outright, and the whole model rests on them:
 *
 *   - Pan Capacity: "square root of capacity = average minerals" per pan cycle.
 *   - Sluice Efficiency: "the amount of minerals a given sluice will accumulate
 *     each 10 minutes".
 *
 * So sluice output is fully determined and needs nothing from the player.
 *
 * WHAT THE WIKI DOES NOT GIVE: how long a pan cycle takes. Dig Speed, Shake Speed
 * and the strength stats clearly drive it, but no page states a base rate in
 * seconds, and inventing one would put a fabricated number underneath every
 * estimate on the page. So panning asks the player to time a cycle themselves,
 * and that input is labelled as theirs rather than dressed up as game data.
 */

/** Average minerals from one pan cycle, straight from the Stats page. */
export const mineralsPerCycle = (capacity) => Math.sqrt(Math.max(capacity, 0));

/**
 * Minerals per hour from panning.
 * @param {number} capacity        Pan capacity.
 * @param {number} secondsPerCycle The player's own measured cycle time.
 */
export function panRate(capacity, secondsPerCycle) {
  if (!(secondsPerCycle > 0)) return 0;
  return mineralsPerCycle(capacity) * (3600 / secondsPerCycle);
}

/** Minerals per hour from a sluice. Efficiency is stated per 10 minutes. */
export const sluiceRate = (efficiency) => Math.max(efficiency, 0) * 6;

/** Minutes for a sluice to fill up and stop collecting. */
export function sluiceFillMinutes(capacity, efficiency) {
  if (!(efficiency > 0)) return Infinity;
  return (capacity / efficiency) * 10;
}

/**
 * Expected number of minerals you have to pull before seeing one target.
 * A geometric distribution, so the mean is simply 1/p.
 */
export const expectedPulls = (p) => (p > 0 ? 1 / p : Infinity);

/**
 * Pulls for a given confidence of seeing at least one — the "half the time you'll
 * have it by here" figure, which is a fairer expectation than the mean.
 */
export function pullsForConfidence(p, confidence = 0.5) {
  if (!(p > 0) || p >= 1) return p >= 1 ? 1 : Infinity;
  return Math.log(1 - confidence) / Math.log1p(-p);
}

/** Chance of at least one target in a number of pulls. */
export function chanceWithin(p, pulls) {
  if (!(p > 0)) return 0;
  return 1 - Math.exp(pulls * Math.log1p(-p));
}

/**
 * Hours to collect `count` of a mineral at drop rate `p`, pulling `ratePerHour`
 * minerals an hour.
 */
export function hoursFor(p, ratePerHour, count = 1) {
  if (!(p > 0) || !(ratePerHour > 0)) return Infinity;
  return (count / p) / ratePerHour;
}

/**
 * Average value of a single mineral at a site, under the player's luck.
 * Recomputed rather than reusing the base figure, because luck shifts the whole
 * distribution toward the rarer, more valuable end.
 *
 * @param {{id: string, value: number|null}[]} siteMinerals
 * @param {(id: string) => {percent: number}|null} chanceOf
 */
export function valuePerMineral(siteMinerals, chanceOf) {
  let total = 0;
  for (const m of siteMinerals) {
    const c = chanceOf(m.id);
    if (!c) continue;
    total += (c.percent / 100) * (m.value ?? 0);
  }
  return total;
}

/** "3.5 h" / "2 d 4 h" / "18 min" / "45 s" */
export function duration(hours) {
  if (!Number.isFinite(hours) || hours <= 0) return '—';
  if (hours < 1 / 60) return `${Math.max(1, Math.round(hours * 3600))} s`;
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 24) return `${hours < 10 ? hours.toFixed(1) : Math.round(hours)} h`;

  const days = hours / 24;
  if (days < 30) {
    const d = Math.floor(days);
    const h = Math.round(hours - d * 24);
    return h ? `${d} d ${h} h` : `${d} d`;
  }
  if (days < 365) return `${(days / 30.44).toFixed(1)} months`;

  const years = days / 365.25;
  if (years < 1000) return `${years < 10 ? years.toFixed(1) : Math.round(years).toLocaleString('en-US')} years`;
  return `${Math.round(years).toLocaleString('en-US')} years`;
}
