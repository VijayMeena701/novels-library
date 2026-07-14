import { FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { User } from '../models/User';
import { Role } from '../models/Role';
import { getUserCapabilities } from '../services/rbac';
import { syncPolicies } from '../services/casbin';

async function getDefaultRoleId(email: string): Promise<string | undefined> {
  const adminEmails = new Set(
    (process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || '')
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  );
  const roleKey = adminEmails.has(email.toLowerCase()) ? 'superadmin' : 'user';
  const role = await Role.findOne({ key: roleKey }).lean();
  return role ? String(role._id) : undefined;
}

async function serializeUser(user: any) {
  const userDoc = await User.findById(user._id).populate('roles').lean();
  if (!userDoc) {
    return null;
  }

  const roleIds = (userDoc.roles || []).map((r: any) => String(r._id));
  const roleKeys = (userDoc.roles || []).map((r: any) => r.key as string);
  const isSuperuser = (userDoc.roles || []).some((r: any) => r.isSuperuser);
  const caps = await getUserCapabilities(String(userDoc._id));

  return {
    id: String(userDoc._id),
    username: userDoc.username,
    email: userDoc.email,
    avatarUrl: userDoc.avatarUrl,
    authProvider: userDoc.authProvider,
    roles: roleKeys,
    roleIds,
    isSuperuser: caps.isSuperuser || isSuperuser,
    isDisabled: userDoc.isDisabled,
    isDeleted: userDoc.isDeleted,
    isVerified: userDoc.isVerified,
    isLocked: userDoc.isLocked,
    capabilities: caps.capabilities,
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
    const roleId = await getDefaultRoleId(email);
    const user = await User.create({
      username,
      email: email.toLowerCase(),
      passwordHash,
      authProvider: 'password',
      roles: roleId ? [new mongoose.Types.ObjectId(roleId)] : [],
    });

    // Generate JWT
    const token = await reply.jwtSign({ id: user._id, email: user.email });

    // Re-sync Casbin policies so the new user has role mappings in memory
    await syncPolicies();

    return reply.status(201).send({
      token,
      user: await serializeUser(user),
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

    if (user.isDeleted || user.isDisabled || user.isLocked) {
      return reply.status(403).send({ error: 'Account is inactive or locked. Contact an administrator.' });
    }

    const envRoleId = await getDefaultRoleId(user.email);
    let roleChanged = false;
    if (envRoleId) {
      const current = new Set(user.roles.map((r) => String(r)));
      if (!current.has(envRoleId)) {
        user.roles.push(new mongoose.Types.ObjectId(envRoleId));
        await user.save();
        roleChanged = true;
      }
    }

    // Re-sync Casbin policies so role/flag changes are reflected in memory
    if (roleChanged) {
      await syncPolicies();
    }

    // Generate JWT
    const token = await reply.jwtSign({ id: user._id, email: user.email });

    return reply.send({
      token,
      user: await serializeUser(user),
    });
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error during login.' });
  }
}

function getGoogleAuthConfig(request: FastifyRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID || '';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
  const callbackUrl =
    process.env.GOOGLE_CALLBACK_URL || `${request.protocol}://${request.hostname}/api/auth/google/callback`;
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

    const tokenData = (await tokenResponse.json()) as { access_token?: string };
    if (!tokenData.access_token) {
      throw new Error('Google token response did not include an access token.');
    }

    const profileResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (!profileResponse.ok) {
      throw new Error(`Google profile fetch failed with HTTP ${profileResponse.status}.`);
    }

    const profile = (await profileResponse.json()) as {
      sub: string;
      email: string;
      name?: string;
      picture?: string;
    };
    if (!profile.email || !profile.sub) {
      throw new Error('Google profile is missing email or subject.');
    }

    let user = await User.findOne({ $or: [{ googleId: profile.sub }, { email: profile.email.toLowerCase() }] });
    const roleId = await getDefaultRoleId(profile.email);
    if (!user) {
      user = await User.create({
        username: profile.name || profile.email.split('@')[0],
        email: profile.email.toLowerCase(),
        googleId: profile.sub,
        avatarUrl: profile.picture || '',
        authProvider: 'google',
        roles: roleId ? [new mongoose.Types.ObjectId(roleId)] : [],
      });
    } else {
      user.googleId = user.googleId || profile.sub;
      user.avatarUrl = profile.picture || user.avatarUrl;
      user.authProvider = user.passwordHash ? 'both' : 'google';
      if (roleId) {
        const current = new Set(user.roles.map((r) => String(r)));
        if (!current.has(roleId)) {
          user.roles.push(new mongoose.Types.ObjectId(roleId));
        }
      }
      await user.save();
    }

    const jwt = await reply.jwtSign({ id: user._id, email: user.email });
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
    if (user.isDeleted || user.isDisabled || user.isLocked) {
      return reply.status(403).send({ error: 'Account is inactive or locked.' });
    }
    const serialized = await serializeUser(user);
    if (!serialized) {
      return reply.status(500).send({ error: 'Server error serializing user.' });
    }
    return reply.send({ user: serialized });
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error fetching user.' });
  }
}

export async function updateMeHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = (request.user as any).id;
    const { username, avatarUrl } = request.body as any;
    const update: Record<string, string> = {};

    if (typeof username === 'string' && username.trim()) {
      update.username = username.trim();
    }
    if (typeof avatarUrl === 'string') {
      update.avatarUrl = avatarUrl.trim();
    }

    if (Object.keys(update).length === 0) {
      return reply.status(400).send({ error: 'No valid fields to update.' });
    }

    const user = await User.findByIdAndUpdate(userId, { $set: update }, { new: true }).select('-passwordHash');
    if (!user) {
      return reply.status(404).send({ error: 'User not found.' });
    }

    const serialized = await serializeUser(user);
    if (!serialized) {
      return reply.status(500).send({ error: 'Server error serializing user.' });
    }
    return reply.send({ user: serialized });
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error updating user profile.' });
  }
}

export async function getCapabilitiesHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = (request.user as any).id;
    const data = await getUserCapabilities(userId);
    return reply.send(data);
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error fetching capabilities.' });
  }
}
