import { api } from './client';
import type { AuthResponse, User } from '../types';

export interface RegisterPayload {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export function register(payload: RegisterPayload): Promise<AuthResponse> {
  return api.post<AuthResponse>('/auth/register', payload);
}

export function login(payload: LoginPayload): Promise<AuthResponse> {
  return api.post<AuthResponse>('/auth/login', payload);
}

export function fetchProfile(): Promise<{ user: User }> {
  return api.get<{ user: User }>('/auth/me');
}
