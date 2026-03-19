/**
 * ThreadsAuthService - Handles Threads API authentication and oEmbed API calls
 * 
 * Meta Threads API requires:
 * 1. Meta App with App ID + App Secret
 * 2. Advanced Access level (requires App Review)
 * 3. OAuth flow to get user access token
 * 4. threads_basic_read permission
 * 
 * Documentation: https://developers.facebook.com/docs/threads
 * oEmbed API: https://developers.facebook.com/docs/threads/reply-moderation#oembed
 */

import { SocialConnection } from "@/types";

interface ThreadsOAuthConfig {
  appId: string;
  redirectUri: string;
}

interface ThreadsOEmbedResponse {
  author_name: string;
  author_url: string;
  html: string;
  provider_name: string;
  provider_url: string;
  thumbnail_url?: string;
  title?: string;
  type: string;
  version: string;
  width?: number;
}

interface ThreadsTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
}

export class ThreadsAuthService {
  private config: ThreadsOAuthConfig;

  constructor(config: ThreadsOAuthConfig) {
    this.config = config;
  }

  /**
   * Check if Threads API credentials are configured
   */
  isConfigured(): boolean {
    return !!(this.config.appId && this.config.redirectUri &&
              this.config.appId !== '');
  }

  /**
   * Get the OAuth authorization URL for Threads
   */
  getAuthorizationUrl(state?: string): string {
    if (!this.isConfigured()) {
      throw new Error('Threads API credentials not configured. Please set VITE_THREADS_APP_ID, VITE_THREADS_APP_SECRET, and VITE_THREADS_REDIRECT_URI in your .env file.');
    }
    const params = new URLSearchParams({
      client_id: this.config.appId,
      redirect_uri: this.config.redirectUri,
      scope: 'threads_basic,threads_content_publish',
      response_type: 'code',
      ...(state && { state }),
    });

    return `https://threads.net/oauth/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token.
   * Proxied through our Cloud Function so the app secret never touches the client.
   */
  async exchangeCodeForToken(code: string): Promise<ThreadsTokenResponse> {
    const redirectUri = this.config.redirectUri;
    const appId = this.config.appId;

    const response = await fetch("/api/threads-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, redirectUri, appId }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to exchange code for token: ${error}`);
    }

    return response.json();
  }

  /**
   * Get Threads user profile
   */
  async getUserProfile(accessToken: string): Promise<{ id: string; username: string }> {
    const response = await fetch(
      `https://graph.threads.net/v1.0/me?fields=id,username&access_token=${accessToken}`
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get user profile: ${error}`);
    }

    return response.json();
  }

  /**
   * Get oEmbed data for a Threads post using authenticated API
   */
  async getOEmbedData(
    url: string,
    accessToken: string,
    maxWidth?: number
  ): Promise<ThreadsOEmbedResponse> {
    const params = new URLSearchParams({
      url,
      access_token: accessToken,
      ...(maxWidth && { maxwidth: maxWidth.toString() }),
    });

    const response = await fetch(
      `https://graph.threads.net/v1.0/oembed?${params.toString()}`
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get oEmbed data: ${error}`);
    }

    return response.json();
  }

  /**
   * Refresh an expired access token (if using long-lived tokens)
   */
  async refreshAccessToken(accessToken: string): Promise<ThreadsTokenResponse> {
    const params = new URLSearchParams({
      grant_type: 'th_refresh_token',
      access_token: accessToken,
    });

    const response = await fetch(
      `https://graph.threads.net/refresh_access_token?${params.toString()}`
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to refresh access token: ${error}`);
    }

    return response.json();
  }

  /**
   * Check if a connection needs refresh (within 7 days of expiry)
   */
  shouldRefreshToken(connection: SocialConnection): boolean {
    if (!connection.expiresAt) return false;
    
    const now = new Date();
    const expiryDate = new Date(connection.expiresAt);
    const daysUntilExpiry = (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    
    return daysUntilExpiry < 7;
  }

  /**
   * Extract post ID from Threads URL
   */
  extractPostId(url: string): string | null {
    try {
      const urlObj = new URL(url);
      const match = urlObj.pathname.match(/\/@[^/]+\/post\/([^/?]+)/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }
}

// Create singleton instance with env vars
// Note: Threads uses the same Meta/Facebook app, so we can fall back to Facebook credentials.
// The app secret is NOT needed client-side — token exchange is proxied through the Cloud Function.
export const threadsAuthService = new ThreadsAuthService({
  appId: import.meta.env.VITE_THREADS_APP_ID || import.meta.env.VITE_FACEBOOK_APP_ID || '',
  redirectUri: import.meta.env.VITE_THREADS_REDIRECT_URI || `${window.location.origin}/threads-oauth-callback.html`,
});
