import { z } from 'zod';

import { nightsBetween, todayIso } from './format';

/**
 * Client-side schemas.
 *
 * These mirror the zod schemas in backend/src/modules/**.schema.ts so the user
 * gets immediate feedback; the server still validates everything again, and it
 * remains the authority.
 */

export const MAX_STAY_NIGHTS = 30;

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a date');

export const passwordSchema = z
  .string()
  .min(8, 'At least 8 characters')
  .max(72, 'At most 72 characters')
  .regex(/[a-z]/, 'Add a lowercase letter')
  .regex(/[A-Z]/, 'Add an uppercase letter')
  .regex(/\d/, 'Add a digit');

export const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});

export const registerSchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  password: passwordSchema,
  fullName: z.string().trim().min(2, 'Enter your full name').max(120),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ()-]{6,20}$/, 'Enter a valid phone number')
    .optional()
    .or(z.literal('')),
});

export const searchSchema = z
  .object({
    city: z.string().trim().max(80).optional().or(z.literal('')),
    checkIn: isoDate,
    checkOut: isoDate,
    guests: z.coerce.number().int().min(1, 'At least one guest').max(10, 'At most 10 guests'),
  })
  .superRefine((value, ctx) => {
    if (value.checkIn < todayIso()) {
      ctx.addIssue({
        code: 'custom',
        path: ['checkIn'],
        message: 'Check-in cannot be in the past',
      });
    }
    const nights = nightsBetween(value.checkIn, value.checkOut);
    if (nights <= 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['checkOut'],
        message: 'Check-out must be after check-in',
      });
    } else if (nights > MAX_STAY_NIGHTS) {
      ctx.addIssue({
        code: 'custom',
        path: ['checkOut'],
        message: `Stays are limited to ${MAX_STAY_NIGHTS} nights`,
      });
    }
  });

export const guestDetailsSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter the lead guest name').max(120),
  email: z.string().trim().email('Enter a valid email address'),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ()-]{6,20}$/, 'Enter a valid phone number')
    .optional()
    .or(z.literal('')),
  specialRequests: z.string().trim().max(500, 'Keep requests under 500 characters').optional(),
});

export const cardPaymentSchema = z.object({
  cardHolder: z.string().trim().min(2, 'Enter the name on the card').max(120),
  cardNumber: z
    .string()
    .trim()
    .regex(/^[0-9 ]{12,23}$/, 'Enter a 12 to 19 digit card number')
    .refine((value) => isLuhnValid(value), 'That card number is not valid'),
  expiryMonth: z.coerce.number().int().min(1, 'MM').max(12, 'MM'),
  expiryYear: z.coerce.number().int().min(2024, 'YYYY').max(2099, 'YYYY'),
  cvc: z.string().trim().regex(/^\d{3,4}$/, '3 or 4 digits'),
});

export const reviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().trim().min(3, 'Add a short title').max(120),
  comment: z.string().trim().min(10, 'Tell future guests a little more').max(2000),
});

/** Same checksum the API applies, so bad numbers never leave the browser. */
export function isLuhnValid(cardNumber: string): boolean {
  const digits = cardNumber.replace(/\D/g, '');
  if (digits.length < 12 || digits.length > 19) {
    return false;
  }

  let sum = 0;
  let double = false;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    const char = digits[index];
    if (char === undefined) {
      return false;
    }
    let digit = Number(char);
    if (double) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    sum += digit;
    double = !double;
  }
  return sum % 10 === 0;
}

/** Flattens a zod error into `{ field: 'first message' }`. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || 'form';
    if (!(key in result)) {
      result[key] = issue.message;
    }
  }
  return result;
}
