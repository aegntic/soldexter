/**
 * Every published number is either measured (with source and UTC time) or
 * explicitly unverifiable. Callers must not substitute a zero or a guess.
 */

export type Field<T> =
  | { kind: 'measured'; value: T; source: string; as_of_utc: string }
  | { kind: 'unverifiable'; reason: string };

export function measured<T>(value: T, source: string, asOfUtc: string): Field<T> {
  return { kind: 'measured', value, source, as_of_utc: asOfUtc };
}

export function unverifiable<T>(reason: string): Field<T> {
  return { kind: 'unverifiable', reason };
}

export function isMeasured<T>(field: Field<T>): field is Extract<Field<T>, { kind: 'measured' }> {
  return field.kind === 'measured';
}

export function formatField(field: Field<unknown>, render?: (value: unknown) => string): string {
  switch (field.kind) {
    case 'unverifiable':
      return `unverifiable (${field.reason})`;
    case 'measured': {
      const text = render ? render(field.value) : String(field.value);
      return `${text} (source: ${field.source}, as_of_utc: ${field.as_of_utc})`;
    }
    default: {
      const _exhaustive: never = field;
      return _exhaustive;
    }
  }
}

export function utcNow(date: Date = new Date()): string {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}
