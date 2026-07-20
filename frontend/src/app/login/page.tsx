'use client';

import { Suspense, useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../utils/api';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Spinner } from '../../components/ui/spinner';

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex flex-1 items-center justify-center"><Spinner size="md" /></div>}>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const { login, register } = useAuth();
  const searchParams = useSearchParams();
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(() => searchParams.get('error') || '');
  const [submitting, setSubmitting] = useState(false);
  const showPasswordLogin = process.env.NEXT_PUBLIC_AUTH_MODE !== 'google';

  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      api.setToken(token);
      window.location.href = '/profile';
    }
  }, [searchParams]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!email || !password) {
      setError('Please fill in all required fields.');
      return;
    }
    if (isRegister && !username) {
      setError('Please choose a username.');
      return;
    }

    setSubmitting(true);
    try {
      if (isRegister) {
        await register(username, email, password);
      } else {
        await login(email, password);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred during authentication.');
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-8">
      <Card className="flex w-full max-w-[420px] flex-col gap-5 p-8">
        <div className="text-center">
          <div className="mx-auto mb-4 inline-flex size-12 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-[#263a5c] text-2xl font-black text-white shadow-focus">
            N
          </div>
          <h2 className="mb-1 text-[1.75rem] font-black leading-tight">
            {isRegister ? 'Create Account' : 'Welcome Back'}
          </h2>
          <p className="text-sm text-copy">
            {isRegister ? 'Sign up to track and archive your books' : 'Sign in to access your book library'}
          </p>
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        <Button asChild variant="secondary" className="w-full border-border-hover">
          <a href={api.getGoogleLoginUrl()}>Continue with Google</a>
        </Button>

        {showPasswordLogin && (
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border"></div>
            <span className="text-xs text-muted-copy">Development login</span>
            <div className="h-px flex-1 bg-border"></div>
          </div>
        )}

        {showPasswordLogin && (
          <>
            <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
              {isRegister && (
                <div>
                  <label className="mb-2 block text-xs font-bold text-copy">Username</label>
                  <Input
                    type="text" 
                    placeholder="e.g. book_reader"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>
              )}

              <div>
                <label className="mb-2 block text-xs font-bold text-copy">Email Address</label>
                <Input
                  type="email" 
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold text-copy">Password</label>
                <Input
                  type="password" 
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <Button
                type="submit" 
                className="mt-2 w-full"
                disabled={submitting}
              >
                {submitting ? (
                  <Spinner size="sm" />
                ) : (
                  isRegister ? 'Create Account' : 'Sign In'
                )}
              </Button>
            </form>

            <div className="mt-2 text-center text-sm text-copy">
              {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
              <button
                onClick={() => {
                  setIsRegister(!isRegister);
                  setError('');
                }}
                className="cursor-pointer border-0 bg-transparent px-0.5 font-semibold text-primary underline"
              >
                {isRegister ? 'Sign In' : 'Sign Up'}
              </button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
