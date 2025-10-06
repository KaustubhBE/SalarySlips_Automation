import { getApiUrl } from '../config.js';

/**
 * OAuth Service - Handles all Google OAuth operations
 */
class OAuthService {
  constructor() {
    this.clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    this.redirectUri = window.location.origin;
    this.scopes = [
      'openid',
      'email',
      'profile',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.compose',
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.file'
    ];
  }

  /**
   * Check if Google OAuth is properly configured
   */
  async checkConfiguration() {
    try {
      const response = await fetch(getApiUrl('auth/google/config'));
      const data = await response.json();
      console.log('Google OAuth config check:', data);
      return data;
    } catch (error) {
      console.error('Failed to check Google OAuth config:', error);
      return { success: false, error: 'Config check failed' };
    }
  }

  /**
   * Generate OAuth authorization URL
   */
  generateAuthUrl(state) {
    if (!this.clientId || this.clientId === 'your-google-client-id') {
      throw new Error('Google OAuth not configured. Please contact administrator.');
    }

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', this.clientId);
    authUrl.searchParams.set('redirect_uri', this.redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', this.scopes.join(' '));
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('prompt', 'consent'); // Force consent screen
    authUrl.searchParams.set('state', state);

    return authUrl.toString();
  }

  /**
   * Generate a random state parameter for CSRF protection
   */
  generateState() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  /**
   * Redirect current window to OAuth authorization URL
   */
  redirectToOAuth(authUrl) {
    console.log('🚀 Redirecting to Google OAuth...');
    window.location.href = authUrl;
  }

  /**
   * Extract OAuth parameters from URL (supports both search params and hash)
   */
  extractOAuthParams() {
    // Check search parameters
    const urlParams = new URLSearchParams(window.location.search);
    const searchCode = urlParams.get('code');
    const searchError = urlParams.get('error');
    const searchState = urlParams.get('state');

    // Check hash parameters
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const hashCode = hashParams.get('code');
    const hashError = hashParams.get('error');
    const hashState = hashParams.get('state');

    // Return whichever method found the parameters
    const result = {
      code: searchCode || hashCode,
      error: searchError || hashError,
      state: searchState || hashState
    };
    
    // Only log if we found OAuth parameters
    if (result.code || result.error) {
      console.log('OAuth parameters found:', { 
        code: result.code ? `${result.code.substring(0, 10)}...` : null, 
        error: result.error, 
        state: result.state ? `${result.state.substring(0, 10)}...` : null 
      });
    }
    
    return result;
  }

  /**
   * Verify state parameter for CSRF protection
   */
  verifyState(state) {
    const storedState = localStorage.getItem('oauth_state');
    if (state !== storedState) {
      throw new Error('Security error: Invalid state parameter');
    }
    // Clear the stored state after verification
    localStorage.removeItem('oauth_state');
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code, state) {
    const response = await fetch(getApiUrl('auth/google/callback'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        code,
        redirect_uri: this.redirectUri,
        state
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Backend error:', response.status, errorText);
      throw new Error(`Server error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    if (!data.success || !data.user) {
      throw new Error(data.error || 'OAuth callback failed');
    }

    return data;
  }

  /**
   * Store OAuth result in localStorage for direct window flow
   */
  storeOAuthResult(success, data) {
    const result = { success, ...data };
    localStorage.setItem('oauth_result', JSON.stringify(result));
    console.log('✅ OAuth result stored in localStorage');
  }

  /**
   * Handle OAuth callback in current window
   */
  async handleOAuthCallback() {
    console.log('🔄 Processing OAuth callback...');
    
    const { code, error, state } = this.extractOAuthParams();

    // Handle OAuth errors
    if (error) {
      console.error('❌ OAuth error:', error);
      const errorMessage = `Google authentication failed: ${error}`;
      this.storeOAuthResult(false, { error: errorMessage });
      return { success: false, error: errorMessage };
    }

    // Validate parameters
    if (!code || !state) {
      const errorMessage = 'Missing authorization code or state parameter';
      console.error('❌', errorMessage);
      this.storeOAuthResult(false, { error: errorMessage });
      return { success: false, error: errorMessage };
    }

    try {
      // Verify state parameter
      this.verifyState(state);
      
      // Exchange code for tokens
      const result = await this.exchangeCodeForTokens(code, state);
      
      console.log('✅ Google OAuth successful');
      
      // Store result for immediate use
      this.storeOAuthResult(true, { user: result.user });
      
      return { success: true, user: result.user };
      
    } catch (error) {
      console.error('❌ OAuth callback error:', error.message);
      const errorMessage = error.message || 'Google authentication failed';
      this.storeOAuthResult(false, { error: errorMessage });
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Check if current window is a popup (not needed for direct flow)
   */
  isPopupWindow() {
    return false; // Always false for direct window flow
  }

  /**
   * Check if current URL contains OAuth callback parameters
   */
  isOAuthCallback() {
    const { code, error } = this.extractOAuthParams();
    return !!(code || error);
  }

  /**
   * Close popup window safely (not needed for direct flow)
   */
  closePopup() {
    // No-op for direct window flow
  }
}

// Create and export a singleton instance
export const oauthService = new OAuthService();
export default oauthService;
