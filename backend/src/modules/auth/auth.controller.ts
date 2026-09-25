import type { Request, Response } from 'express';

import { UnauthorizedError } from '../../errors/AppError';
import { parsedBody } from '../../middleware/validate';
import { loginSchema, registerSchema } from './auth.schema';
import * as authService from './auth.service';

export async function registerHandler(req: Request, res: Response): Promise<void> {
  const input = parsedBody(req, registerSchema);
  const result = await authService.register(input);
  res.status(201).json(result);
}

export async function loginHandler(req: Request, res: Response): Promise<void> {
  const input = parsedBody(req, loginSchema);
  const result = await authService.login(input);
  res.status(200).json(result);
}

export async function meHandler(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new UnauthorizedError('A valid access token is required');
  }
  const user = await authService.getProfile(req.user.id);
  res.status(200).json({ user });
}
