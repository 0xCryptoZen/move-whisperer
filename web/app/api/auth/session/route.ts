/**
 * Session Management
 * GET /api/auth/session - Get current session
 * DELETE /api/auth/session - Logout
 */

import { NextResponse } from 'next/server';
import { getCloudflareEnv } from '@/lib/cloudflare/context';
import { extractToken, verifyToken, clearAuthCookie } from '@/lib/auth/jwt';
import { revokeSession } from '@/lib/db';

export const runtime = 'edge';

export async function GET(request: Request) {
  try {
    const token = extractToken(request);

    if (!token) {
      return NextResponse.json({
        authenticated: false,
        user: null,
      });
    }

    const { JWT_SECRET, JWT_ISSUER, JWT_AUDIENCE } = getCloudflareEnv();
    const payload = await verifyToken(JWT_SECRET, token, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });

    if (!payload) {
      return NextResponse.json({
        authenticated: false,
        user: null,
        error: 'Invalid or expired token',
      });
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: payload.sub,
        displayName: payload.name,
        avatarUrl: payload.avatar,
        email: payload.email,
        providers: payload.providers,
        wallets: payload.wallets,
      },
      session: {
        id: payload.jti,
        expiresAt: payload.exp * 1000,
      },
    });
  } catch (error) {
    console.error('[Session] Error getting session:', error);
    return NextResponse.json(
      { error: 'Failed to get session' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const token = extractToken(request);

    if (token) {
      const { JWT_SECRET, JWT_ISSUER, JWT_AUDIENCE, DB } = getCloudflareEnv();
      const payload = await verifyToken(JWT_SECRET, token, {
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
      });

      if (payload) {
        // Revoke session in D1
        await revokeSession(DB, payload.jti, 'user_logout');
      }
    }

    const response = NextResponse.json({
      success: true,
      message: 'Logged out successfully',
    });

    response.headers.set('Set-Cookie', clearAuthCookie());
    return response;
  } catch (error) {
    console.error('[Session] Error logging out:', error);
    return NextResponse.json(
      { error: 'Failed to logout' },
      { status: 500 }
    );
  }
}
