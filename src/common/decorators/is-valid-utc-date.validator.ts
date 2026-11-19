import { ValidateBy } from 'class-validator';
export function isValidUtcCalendarDate(value: unknown): boolean {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

export function IsValidUtcDate() {
  return ValidateBy({
    name: 'isValidUtcDate',
    validator: {
      validate: isValidUtcCalendarDate,
      defaultMessage: (args) =>
        `${args?.property ?? 'value'} must be a valid YYYY-MM-DD calendar date`,
    },
  });
}
