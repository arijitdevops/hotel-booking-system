import { useState, type FormEvent, type JSX } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { ErrorBanner } from '../components/ErrorBanner';
import { useAuth } from '../hooks/useAuth';
import { fieldErrors, loginSchema } from '../lib/validation';

interface LocationState {
  from?: string;
}

export function LoginPage(): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn } = useAuth();

  const [email, setEmail] = useState('guest@example.com');
  const [password, setPassword] = useState('Guest@123');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);

  const redirectTo = (location.state as LocationState | null)?.from ?? '/bookings';

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const result = loginSchema.safeParse({ email, password });

    if (!result.success) {
      setErrors(fieldErrors(result.error));
      return;
    }

    setErrors({});
    setSubmitError(null);
    setSubmitting(true);

    try {
      const user = await signIn(result.data);
      navigate(user.role === 'ADMIN' ? '/admin' : redirectTo, { replace: true });
    } catch (error) {
      setSubmitError(error);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page page--narrow">
      <h1 className="page__title">Sign in</h1>

      <form className="card form" onSubmit={(event) => void handleSubmit(event)} noValidate>
        {submitError !== null && <ErrorBanner error={submitError} />}

        <div className="field">
          <label className="field__label" htmlFor="login-email">
            Email
          </label>
          <input
            id="login-email"
            className="field__input"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
          />
          {errors['email'] && <p className="field__error">{errors['email']}</p>}
        </div>

        <div className="field">
          <label className="field__label" htmlFor="login-password">
            Password
          </label>
          <input
            id="login-password"
            className="field__input"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
          />
          {errors['password'] && <p className="field__error">{errors['password']}</p>}
        </div>

        <button type="submit" className="button button--primary button--block" disabled={submitting}>
          {submitting ? 'Signing in...' : 'Sign in'}
        </button>

        <p className="muted form__footer">
          No account yet? <Link className="link" to="/register">Create one</Link>.
        </p>
      </form>

      <aside className="card demo-accounts">
        <h2 className="card__title">Demo accounts</h2>
        <ul className="list">
          <li>
            <strong>Administrator</strong> - admin@example.com / Admin@123
          </li>
          <li>
            <strong>Guest</strong> - guest@example.com / Guest@123
          </li>
        </ul>
        <p className="muted">These exist only after the database has been seeded.</p>
      </aside>
    </div>
  );
}
