import { useState, type FormEvent, type JSX } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { ErrorBanner } from '../components/ErrorBanner';
import { useAuth } from '../hooks/useAuth';
import { fieldErrors, registerSchema } from '../lib/validation';

export function RegisterPage(): JSX.Element {
  const navigate = useNavigate();
  const { signUp } = useAuth();

  const [form, setForm] = useState({ fullName: '', email: '', password: '', phone: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);

  function update(key: keyof typeof form, value: string): void {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const result = registerSchema.safeParse(form);

    if (!result.success) {
      setErrors(fieldErrors(result.error));
      return;
    }

    setErrors({});
    setSubmitError(null);
    setSubmitting(true);

    try {
      await signUp({
        email: result.data.email,
        password: result.data.password,
        fullName: result.data.fullName,
        ...(result.data.phone ? { phone: result.data.phone } : {}),
      });
      navigate('/bookings', { replace: true });
    } catch (error) {
      setSubmitError(error);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page page--narrow">
      <h1 className="page__title">Create an account</h1>

      <form className="card form" onSubmit={(event) => void handleSubmit(event)} noValidate>
        {submitError !== null && <ErrorBanner error={submitError} />}

        <div className="field">
          <label className="field__label" htmlFor="register-name">
            Full name
          </label>
          <input
            id="register-name"
            className="field__input"
            value={form.fullName}
            onChange={(event) => update('fullName', event.target.value)}
            autoComplete="name"
          />
          {errors['fullName'] && <p className="field__error">{errors['fullName']}</p>}
        </div>

        <div className="field">
          <label className="field__label" htmlFor="register-email">
            Email
          </label>
          <input
            id="register-email"
            className="field__input"
            type="email"
            value={form.email}
            onChange={(event) => update('email', event.target.value)}
            autoComplete="email"
          />
          {errors['email'] && <p className="field__error">{errors['email']}</p>}
        </div>

        <div className="field">
          <label className="field__label" htmlFor="register-phone">
            Phone (optional)
          </label>
          <input
            id="register-phone"
            className="field__input"
            value={form.phone}
            onChange={(event) => update('phone', event.target.value)}
            autoComplete="tel"
          />
          {errors['phone'] && <p className="field__error">{errors['phone']}</p>}
        </div>

        <div className="field">
          <label className="field__label" htmlFor="register-password">
            Password
          </label>
          <input
            id="register-password"
            className="field__input"
            type="password"
            value={form.password}
            onChange={(event) => update('password', event.target.value)}
            autoComplete="new-password"
          />
          <p className="field__hint muted">
            At least 8 characters, with an uppercase letter, a lowercase letter and a digit.
          </p>
          {errors['password'] && <p className="field__error">{errors['password']}</p>}
        </div>

        <button type="submit" className="button button--primary button--block" disabled={submitting}>
          {submitting ? 'Creating your account...' : 'Create account'}
        </button>

        <p className="muted form__footer">
          Already registered? <Link className="link" to="/login">Sign in</Link>.
        </p>
      </form>
    </div>
  );
}
