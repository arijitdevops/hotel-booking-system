import { z } from 'zod';

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/\d/, 'Password must contain a digit');

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email('A valid email address is required'),
  password: passwordSchema,
  fullName: z.string().trim().min(2, 'Full name is required').max(120),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ()-]{6,20}$/, 'Phone number format is not recognised')
    .optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('A valid email address is required'),
  password: z.string().min(1, 'Password is required'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
