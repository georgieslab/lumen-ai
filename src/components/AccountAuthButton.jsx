import React, { useEffect, useRef, useState } from 'react';
import { beginGithubSignIn, getAuthProviders, signOut } from '../services/api';

export default function AccountAuthButton({
  currentUser,
  memoryLabel = 'Memory',
  onLogout,
  onOpenMemory,
  onOpenSettings,
  conversationCount = 0
}) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [authError, setAuthError] = useState('');
  const [githubEnabled, setGithubEnabled] = useState(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
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

  const handleGithubSignIn = () => {
    if (githubEnabled === null) return;
    if (!githubEnabled) {
      setAuthError('GitHub sign-in is unavailable. The Lumen server needs its GitHub OAuth credentials and session secret configured.');
      return;
    }
    setAuthError('');
    beginGithubSignIn();
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      setShowDropdown(false);
      onLogout();
    } catch (error) {
      setAuthError(error.message || 'Could not sign out.');
    }
  };

  return (
    <div className="account-auth-wrapper" ref={dropdownRef}>
      {currentUser ? (
        <div className="account-user-container">
          <button
            type="button"
            className="account-memory-launcher"
            onClick={() => {
              setShowDropdown(false);
              onOpenMemory?.();
            }}
            aria-label={memoryLabel}
            aria-haspopup="dialog"
            title={memoryLabel}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 6.5c-1.7-1.7-4.1-2.5-7-2.5v13c2.9 0 5.3.8 7 2.5m0-13c1.7-1.7 4.1-2.5 7-2.5v13c-2.9 0-5.3.8-7 2.5M12 6.5v13" />
            </svg>
            <span>{memoryLabel}</span>
          </button>

          <button
            type="button"
            className="account-settings-button"
            onClick={() => onOpenSettings?.()}
            title="Open Lumen settings and navigation"
            aria-label="Open Lumen settings and navigation"
            aria-haspopup="dialog"
          >
            <svg className="account-settings-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 6h16M4 12h16M4 18h16" />
              <circle cx="8" cy="6" r="2" fill="currentColor" />
              <circle cx="15" cy="12" r="2" fill="currentColor" />
              <circle cx="10" cy="18" r="2" fill="currentColor" />
            </svg>
          </button>

          <button
            type="button"
            className="account-user-pill"
            onClick={() => setShowDropdown(!showDropdown)}
            title={`Signed in with ${currentUser.provider || 'GitHub'} as ${currentUser.name}${currentUser.email ? ` (${currentUser.email})` : ''}`}
            aria-expanded={showDropdown}
          >
            {currentUser.picture ? (
              <img
                src={currentUser.picture}
                alt={currentUser.name}
                className="account-user-avatar"
                onError={event => {
                  event.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              <div className="account-user-avatar fallback">
                {currentUser.name?.[0] || 'U'}
              </div>
            )}
            <span className="account-user-name">{currentUser.givenName || currentUser.name}</span>
            <span className="account-user-pulse" />
          </button>

          {showDropdown && (
            <div className="account-user-dropdown glass-elevated animate-fade-in">
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

              <div className="dropdown-divider" />

              <div className="dropdown-stats">
                <div className="stat-item">
                  <span className="stat-label">Account</span>
                  <span className="stat-value text-emerald">● {currentUser.provider || 'GitHub'}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Messages</span>
                  <span className="stat-value">{conversationCount} stored</span>
                </div>
              </div>

              <div className="dropdown-divider" />

              <button
                type="button"
                className="dropdown-memory-btn"
                onClick={() => {
                  setShowDropdown(false);
                  onOpenMemory?.();
                }}
              >
                Manage profile &amp; memory
              </button>

              <button type="button" className="dropdown-signout-btn" onClick={handleSignOut}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
        <div className="account-signin-container">
          <div className="account-oauth-row">
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
              <span className="account-btn-text">GitHub</span>
            </button>
          </div>
          <button
            type="button"
            className="account-settings-button"
            onClick={() => onOpenSettings?.()}
            title="Open Lumen settings and tools"
            aria-label="Open Lumen settings and tools"
          >
            <svg className="account-settings-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 6h16M4 12h16M4 18h16" />
              <circle cx="8" cy="6" r="2" fill="currentColor" />
              <circle cx="15" cy="12" r="2" fill="currentColor" />
              <circle cx="10" cy="18" r="2" fill="currentColor" />
            </svg>
          </button>
          {authError && <p className="auth-error-message" role="alert">{authError}</p>}
        </div>
      )}
      {currentUser && authError && <p className="auth-error-message" role="alert">{authError}</p>}
    </div>
  );
}
