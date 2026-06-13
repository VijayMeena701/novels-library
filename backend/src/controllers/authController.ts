import { FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';

function roleForEmail(email: string): 'user' | 'admin' {
  const adminEmails = new Set(
    (process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || '')
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
  );

  return adminEmails.has(email.toLowerCase()) ? 'admin' : 'user';
}

function serializeUser(user: any) {
  return {
    id: user._id,
    username: user.username,
    email: user.email,
    avatarUrl: user.avatarUrl,
    authProvider: user.authProvider,
    role: user.role,
  };
}

export async function registerHandler(request: FastifyRequest, reply: FastifyReply) {
  const { username, email, password } = request.body as any;

  if (!username || !email || !password) {
    return reply.status(400).send({ error: 'Username, email, and password are required.' });
  }

  try {
    // Check if email already registered
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return reply.status(400).send({ error: 'A user with this email already exists.' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create user
    const user = await User.create({
      username,
      email: email.toLowerCase(),
      passwordHash,
      authProvider: 'password',
      role: roleForEmail(email),
    });

    // Generate JWT
    const token = await reply.jwtSign({ id: user._id, email: user.email, role: user.role });

    return reply.status(201).send({
      token,
      user: serializeUser(user),
    });
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error during registration.' });
  }
}

export async function loginHandler(request: FastifyRequest, reply: FastifyReply) {
  const { email, password } = request.body as any;

  if (!email || !password) {
    return reply.status(400).send({ error: 'Email and password are required.' });
  }

  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !user.passwordHash) {
      return reply.status(401).send({ error: 'Invalid email or password.' });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return reply.status(401).send({ error: 'Invalid email or password.' });
    }

    const envRole = roleForEmail(user.email);
    if (envRole === 'admin' && user.role !== 'admin') {
      user.role = 'admin';
      await user.save();
    }

    // Generate JWT
    const token = await reply.jwtSign({ id: user._id, email: user.email, role: user.role });

    return reply.send({
      token,
      user: serializeUser(user),
    });
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error during login.' });
  }
}

function getGoogleAuthConfig(request: FastifyRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID || '';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
  const callbackUrl = process.env.GOOGLE_CALLBACK_URL || `${request.protocol}://${request.hostname}/api/auth/google/callback`;
  const frontendOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';

  return {
    clientId,
    clientSecret,
    callbackUrl,
    frontendOrigin,
  };
}

export async function googleLoginHandler(request: FastifyRequest, reply: FastifyReply) {
  const { clientId, callbackUrl } = getGoogleAuthConfig(request);
  if (!clientId) {
    return reply.status(500).send({ error: 'GOOGLE_CLIENT_ID is not configured.' });
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUrl,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'select_account',
  });

  return reply.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
}

export async function googleCallbackHandler(request: FastifyRequest, reply: FastifyReply) {
  const { code, error } = request.query as any;
  const { clientId, clientSecret, callbackUrl, frontendOrigin } = getGoogleAuthConfig(request);

  if (error) {
    return reply.redirect(`${frontendOrigin}/login?error=${encodeURIComponent(error)}`);
  }
  if (!code) {
    return reply.redirect(`${frontendOrigin}/login?error=${encodeURIComponent('Missing Google authorization code.')}`);
  }
  if (!clientId || !clientSecret) {
    return reply.redirect(`${frontendOrigin}/login?error=${encodeURIComponent('Google OAuth is not configured.')}`);
  }

  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: callbackUrl,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error(`Google token exchange failed with HTTP ${tokenResponse.status}.`);
    }

    const tokenData = await tokenResponse.json() as { access_token?: string };
    if (!tokenData.access_token) {
      throw new Error('Google token response did not include an access token.');
    }

    const profileResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (!profileResponse.ok) {
      throw new Error(`Google profile fetch failed with HTTP ${profileResponse.status}.`);
    }

    const profile = await profileResponse.json() as {
      sub: string;
      email: string;
      name?: string;
      picture?: string;
    };
    if (!profile.email || !profile.sub) {
      throw new Error('Google profile is missing email or subject.');
    }

    let user = await User.findOne({ $or: [{ googleId: profile.sub }, { email: profile.email.toLowerCase() }] });
    if (!user) {
      user = await User.create({
        username: profile.name || profile.email.split('@')[0],
        email: profile.email.toLowerCase(),
        googleId: profile.sub,
        avatarUrl: profile.picture || '',
        authProvider: 'google',
        role: roleForEmail(profile.email),
      });
    } else {
      user.googleId = user.googleId || profile.sub;
      user.avatarUrl = profile.picture || user.avatarUrl;
      user.authProvider = user.passwordHash ? 'both' : 'google';
      if (roleForEmail(user.email) === 'admin') {
        user.role = 'admin';
      }
      await user.save();
    }

    const jwt = await reply.jwtSign({ id: user._id, email: user.email, role: user.role });
    return reply.redirect(`${frontendOrigin}/login?token=${encodeURIComponent(jwt)}`);
  } catch (err: any) {
    request.log.error(err);
    return reply.redirect(`${frontendOrigin}/login?error=${encodeURIComponent(err.message || 'Google login failed.')}`);
  }
}

export async function meHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = (request.user as any).id;
    const user = await User.findById(userId).select('-passwordHash');
    if (!user) {
      return reply.status(404).send({ error: 'User not found.' });
    }
    return reply.send({ user: serializeUser(user) });
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error fetching user.' });
  }
}
