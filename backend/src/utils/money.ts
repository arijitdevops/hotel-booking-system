/**
 * Money helpers.
 *
 * Amounts are handled as integer minor units (cents) everywhere inside the
 * application so no arithmetic ever touches a binary float. Values are only
 * converted back to a decimal string when they are written to the database
 * (NUMERIC columns) or serialised into a response.
 */

/** Anything Decimal-like (e.g. a decimal.js instance) satisfies this structurally. */
export interface DecimalLike {
  toFixed(decimalPlaces: number): string;
}

function isDecimalLike(value: unknown): value is DecimalLike {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { toFixed?: unknown }).toFixed === 'function'
  );
}

/**
 * Converts a decimal amount into integer cents without float rounding drift.
 * The string form is parsed digit by digit rather than multiplied by 100.
 */
export function toMinorUnits(value: number | string | DecimalLike): number {
  const asString =
    typeof value === 'number'
      ? value.toFixed(2)
      : typeof value === 'string'
        ? value
        : isDecimalLike(value)
          ? value.toFixed(2)
          : String(value);

  const match = /^(-)?(\d+)(?:\.(\d+))?$/.exec(asString.trim());
  if (!match) {
    throw new RangeError(`"${asString}" is not a valid monetary amount`);
  }

  const [, sign, whole = '0', fraction = ''] = match;
  const cents = `${fraction}00`.slice(0, 2);
  const rounded = fraction.length > 2 && Number(fraction[2]) >= 5 ? 1 : 0;
  const total = Number(whole) * 100 + Number(cents) + rounded;
  return sign === '-' ? -total : total;
}

/** Cents to a plain number, e.g. 12345 -> 123.45. Presentation only. */
export function fromMinorUnits(minorUnits: number): number {
  return Math.round(minorUnits) / 100;
}

/** Cents to a fixed 2dp string, safe to write to a NUMERIC money column. */
export function formatMinorUnits(minorUnits: number): string {
  const rounded = Math.round(minorUnits);
  const sign = rounded < 0 ? '-' : '';
  const absolute = Math.abs(rounded);
  const whole = Math.floor(absolute / 100);
  const cents = `${absolute % 100}`.padStart(2, '0');
  return `${sign}${whole}.${cents}`;
}

/** Percentage of an amount, rounded half up to the nearest cent. */
export function percentageOf(minorUnits: number, percent: number): number {
  return Math.round((minorUnits * percent) / 100);
}
