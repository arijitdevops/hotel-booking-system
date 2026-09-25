import { z } from 'zod';

import { PAYMENT_METHODS } from '../../domain/enums';
import { BOOKING_REFERENCE_PATTERN } from '../../utils/bookingReference';

/** Luhn checksum, so obviously invalid test cards are rejected client-side too. */
export function isLuhnValid(cardNumber: string): boolean {
  const digits = cardNumber.replace(/[^0-9]/g, '');
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

export const paymentParamsSchema = z.object({
  bookingReference: z
    .string()
    .trim()
    .toUpperCase()
    .regex(BOOKING_REFERENCE_PATTERN, 'Booking references look like BK-2026-0001'),
});

const cardSchema = z.object({
  method: z.literal('CARD'),
  cardHolder: z.string().trim().min(2).max(120),
  cardNumber: z
    .string()
    .trim()
    .regex(/^[0-9 ]{12,23}$/, 'Card number must be 12 to 19 digits')
    .refine(isLuhnValid, 'Card number failed the checksum test'),
  expiryMonth: z.coerce.number().int().min(1).max(12),
  expiryYear: z.coerce.number().int().min(2024).max(2099),
  cvc: z.string().trim().regex(/^[0-9]{3,4}$/, 'CVC must be 3 or 4 digits'),
});

const walletSchema = z.object({
  method: z.enum(['PAYPAL', 'BANK_TRANSFER']),
  accountReference: z.string().trim().min(3).max(64),
});

export const createPaymentSchema = z.discriminatedUnion('method', [cardSchema, walletSchema]);

export const paymentMethodValues = PAYMENT_METHODS;

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type PaymentParams = z.infer<typeof paymentParamsSchema>;
