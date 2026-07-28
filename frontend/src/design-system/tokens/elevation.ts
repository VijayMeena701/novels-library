/**
 * Elevation scale.
 *
 * Elevation is expressed as a 0-5 numeric scale. Actual shadow values are
 * theme-specific and live in the color themes (`shadow.elevation-*`).
 */

export type ElevationToken = 0 | 1 | 2 | 3 | 4 | 5;

export const ELEVATIONS: readonly ElevationToken[] = [0, 1, 2, 3, 4, 5];

export function isElevationToken(value: number): value is ElevationToken {
  return (ELEVATIONS as readonly number[]).includes(value);
}
