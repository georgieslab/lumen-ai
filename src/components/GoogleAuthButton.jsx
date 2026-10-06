import React, { useState, useEffect, useRef } from 'react';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { beginGithubSignIn, getAuthProviders, signInWithGoogle, signOut } from '../services/api';

/**
 * Official Google 'G' Multi-Color Icon
 */
export function GoogleIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
        fill="#EA4335"
      />
    </svg>
  );
}

export default function GoogleAuthButton({
  currentUser,
  onLoginSuccess,
  onLogout,
  onOpenMemory,
  onOpenSettings,
  activeLanguage = 'en-US',
  conversationCount = 0
}) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [clientIdInput, setClientIdInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [githubEnabled, setGithubEnabled] = useState(null);
  const [configuredClientId, setConfiguredClientId] = useState(() => {
    return import.meta.env.VITE_GOOGLE_CLIENT_ID || localStorage.getItem('lumen_google_client_id') || '';
  });
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    let active = true;
    getAuthProviders()
      .then(providers => {
        if (active) setGithubEnabled(providers.github === true);
      })
      .catch(error => {
        console.warn('Could not check sign-in providers:', error.message);
        if (active) setGithubEnabled(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get('auth_error') === 'github') {
      setAuthError('GitHub sign-in failed or was cancelled. Check the OAuth app configuration and try again.');
      url.searchParams.delete('auth_error');
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    }
  }, []);

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      if (!credentialResponse?.credential) return;
      setAuthError('');
      const result = await signInWithGoogle(credentialResponse.credential);
      onLoginSuccess(result.user);
      setShowConfigModal(false);
      setShowDropdown(false);
    } catch (err) {
      setAuthError(err.message || 'Google sign-in failed.');
    }
  };

  const handleGithubSignIn = async () => {
    if (githubEnabled === null) return;
    if (!githubEnabled) {
      setAuthError('GitHub sign-in is unavailable. The Lumen server needs its GitHub OAuth credentials and session secret configured.');
      return;
    }
    setAuthError('');
    beginGithubSignIn();
  };

  const handleSaveCustomClientId = (e) => {
    e.preventDefault();
    const trimmed = clientIdInput.trim();
    if (trimmed) {
      localStorage.setItem('lumen_google_client_id', trimmed);
      setConfiguredClientId(trimmed);
      setClientIdInput('');
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      setShowDropdown(false);
      onLogout();
    } catch (err) {
      setAuthError(err.message || 'Could not sign out.');
    }
  };

  return (
    <div className="google-auth-wrapper" ref={dropdownRef}>
      {/* 1. Signed-in state */}
      {currentUser ? (
        <div className="google-user-container">
          <button
            type="button"
            className="google-user-pill"
            onClick={() => setShowDropdown(!showDropdown)}
            title={`Signed in with ${currentUser.provider || 'Google'} as ${currentUser.name}${currentUser.email ? ` (${currentUser.email})` : ''}`}
            aria-expanded={showDropdown}
          >
            {currentUser.picture ? (
              <img
                src={currentUser.picture}
                alt={currentUser.name}
                className="google-user-avatar"
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            ) : (
              <div className="google-user-avatar fallback">
                {currentUser.name?.[0] || 'U'}
              </div>
            )}
            <span className="google-user-name">{currentUser.givenName || currentUser.name}</span>
            <span className="google-user-pulse"></span>
          </button>

          {/* Liquid Glass User Profile Dropdown */}
          {showDropdown && (
            <div className="google-user-dropdown glass-elevated animate-fade-in">
              <div className="dropdown-header">
                {currentUser.picture ? (
                  <img src={currentUser.picture} alt={currentUser.name} className="dropdown-avatar" />
                ) : (
                  <div className="dropdown-avatar fallback">
                    {currentUser.name?.[0] || 'U'}
                  </div>
                )}
                <div className="dropdown-info">
                  <div className="dropdown-name">{currentUser.name}</div>
                  <div className="dropdown-email">{currentUser.email || currentUser.provider}</div>
                </div>
              </div>

              <div className="dropdown-divider"></div>

              <div className="dropdown-stats">
                <div className="stat-item">
                  <span className="stat-label">Account</span>
                  <span className="stat-value text-emerald">● {currentUser.provider || 'Google'}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Messages</span>
                  <span className="stat-value">{conversationCount} stored</span>
                </div>
              </div>

              <div className="dropdown-divider"></div>

              <button
                type="button"
                className="dropdown-memory-btn"
                onClick={() => {
                  setShowDropdown(false);
                  onOpenMemory?.();
                }}
              >
                Manage profile & memory
              </button>

              <button
                type="button"
                className="dropdown-signout-btn"
                onClick={handleSignOut}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Sign Out
              </button>
            </div>
          )}
        </div>
      ) : (
        /* 2. Logged out state */
        <div className="google-signin-container">
          <div className="google-oauth-row">
            {configuredClientId ? (
              <GoogleOAuthProvider clientId={configuredClientId}>
                <div className="google-login-box">
                  <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={() => setAuthError('Google sign-in could not start. Check the authorized origin and OAuth client ID.')}
                    theme="filled_black"
                    shape="pill"
                    size="medium"
                    text="signin_with"
                  />
                </div>
              </GoogleOAuthProvider>
            ) : (
              <button
                type="button"
                className="google-auth-trigger-btn"
                onClick={() => setShowConfigModal(true)}
                title="Set up Google sign-in"
              >
                <GoogleIcon size={16} />
                <span className="google-btn-text">Google</span>
              </button>
            )}
            <button
              type="button"
              className="github-auth-trigger-btn"
              onClick={handleGithubSignIn}
              disabled={githubEnabled === null}
              aria-label="Sign in with GitHub"
              title={githubEnabled === null
                ? 'Checking GitHub sign-in availability'
                : githubEnabled
                  ? 'Sign in with GitHub'
                  : 'GitHub sign-in is not configured; click for details'}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 .9a11.1 11.1 0 0 0-3.51 21.63c.55.1.76-.24.76-.54v-2.08c-3.1.67-3.76-1.32-3.76-1.32-.5-1.29-1.24-1.63-1.24-1.63-1.01-.69.08-.68.08-.68 1.12.08 1.71 1.15 1.71 1.15 1 .1.75 2.23 3.03 1.58.1-.73.39-1.22.7-1.5-2.48-.28-5.08-1.24-5.08-5.52 0-1.22.44-2.22 1.15-3-.12-.28-.5-1.42.11-2.95 0 0 .94-.3 3.06 1.15a10.6 10.6 0 0 1 5.57 0c2.12-1.45 3.06-1.15 3.06-1.15.61 1.53.23 2.67.11 2.95.72.78 1.15 1.78 1.15 3 0 4.29-2.6 5.24-5.09 5.51.4.35.75 1.03.75 2.08v3.08c0 .3.2.65.77.54A11.1 11.1 0 0 0 12 .9Z" />
              </svg>
              <span className="google-btn-text">GitHub</span>
            </button>
          </div>
          <button
            type="button"
            className="google-help-pill-btn"
            onClick={() => onOpenSettings?.()}
            title="Open Lumen settings and tools"
            aria-label="Open Lumen settings and tools"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" />
              <path d="m19.4 15 .1.1a1.8 1.8 0 1 1-2.5 2.5l-.1-.1a1.8 1.8 0 0 0-3 .9v.2a1.8 1.8 0 1 1-3.6 0v-.2a1.8 1.8 0 0 0-3-.9l-.1.1a1.8 1.8 0 1 1-2.5-2.5l.1-.1a1.8 1.8 0 0 0-.9-3h-.2a1.8 1.8 0 1 1 0-3.6h.2a1.8 1.8 0 0 0 .9-3l-.1-.1a1.8 1.8 0 1 1 2.5-2.5l.1.1a1.8 1.8 0 0 0 3-.9v-.2a1.8 1.8 0 1 1 3.6 0v.2a1.8 1.8 0 0 0 3 .9l.1-.1a1.8 1.8 0 1 1 2.5 2.5l-.1.1a1.8 1.8 0 0 0 .9 3h.2a1.8 1.8 0 1 1 0 3.6h-.2a1.8 1.8 0 0 0-.9 3Z" />
            </svg>
          </button>
          {authError && <p className="auth-error-message" role="alert">{authError}</p>}
        </div>
      )}
      {currentUser && authError && <p className="auth-error-message" role="alert">{authError}</p>}

      {/* 3. Google OAuth Setup / Demo Modal */}
      {showConfigModal && (
        <div className="modal-backdrop" onClick={() => setShowConfigModal(false)}>
          <div className="google-modal-card glass-elevated" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-row">
                <GoogleIcon size={24} />
                <h3>Sign-In Setup</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowConfigModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="oauth-origin-alert">
              <div className="alert-badge">Fix "no registered origin" (Error 401)</div>
              <p className="alert-text">
                In Google Cloud Console, your OAuth Client ID requires your exact browser URL under <strong>Authorized JavaScript origins</strong>:
              </p>
              <div className="origin-copy-box">
                <code>{window.location.origin}</code>
                <button
                  type="button"
                  className="btn-copy-origin"
                  onClick={() => {
                    navigator.clipboard?.writeText(window.location.origin);
                    alert(`Copied "${window.location.origin}" to clipboard! Paste it into Authorized JavaScript origins in Google Cloud Console.`);
                  }}
                >
                  📋 Copy
                </button>
              </div>
            </div>

            <p className="modal-description">
              Sign in to sync your profile and personal memories. Google and GitHub accounts remain separate, even when their email addresses match.
            </p>

            <form onSubmit={handleSaveCustomClientId} className="client-id-form">
              <label htmlFor="clientIdInput" className="form-label">
                Google Cloud OAuth 2.0 Client ID:
              </label>
              <input
                id="clientIdInput"
                type="text"
                placeholder="xxxxxx.apps.googleusercontent.com"
                value={clientIdInput}
                onChange={(e) => setClientIdInput(e.target.value)}
                className="client-id-input"
              />
              <div className="form-buttons">
                <button
                  type="submit"
                  className="btn-save-client-id"
                  disabled={!clientIdInput.trim()}
                >
                  Activate Google OAuth
                </button>
              </div>
            </form>

            <div className="modal-instructions">
              <div className="instruction-step">
                <strong>1.</strong> Create OAuth Credentials in{' '}
                <a
                  href="https://console.cloud.google.com/apis/credentials"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link-highlight"
                >
                  Google Cloud Console ↗
                </a>
              </div>
              <div className="instruction-step">
                <strong>2.</strong> Add Authorized JavaScript origins:
                <code>{window.location.origin}</code>
              </div>
              <div className="instruction-step">
                <strong>3.</strong> Configure <code>VITE_GOOGLE_CLIENT_ID</code> and the matching server-side <code>GOOGLE_CLIENT_ID</code> in <code>.env</code>.
              </div>
              <div className="instruction-step">
                <strong>4.</strong> For GitHub, set <code>GITHUB_OAUTH_CLIENT_ID</code>, <code>GITHUB_OAUTH_CLIENT_SECRET</code>, <code>GITHUB_OAUTH_CALLBACK_URL</code>, and a valid <code>LUMEN_SESSION_SECRET</code> on the API server.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
