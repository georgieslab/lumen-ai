import React, { useState, useEffect, useRef } from 'react';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';

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
  conversationCount = 0
}) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [clientIdInput, setClientIdInput] = useState('');
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

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      if (!credentialResponse?.credential) return;
      const decoded = jwtDecode(credentialResponse.credential);
      
      const userData = {
        id: decoded.sub,
        email: decoded.email,
        name: decoded.name || 'Google User',
        givenName: decoded.given_name || decoded.name?.split(' ')[0] || 'User',
        picture: decoded.picture || null,
        credential: credentialResponse.credential
      };

      // Also inform backend server
      try {
        await fetch('/api/auth/google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ credential: credentialResponse.credential, userInfo: userData })
        });
      } catch (err) {
        console.warn('Backend google auth sync notice:', err.message);
      }

      onLoginSuccess(userData);
      setShowConfigModal(false);
      setShowDropdown(false);
    } catch (err) {
      console.error('Google token decoding failed:', err);
    }
  };

  const handleDemoLogin = () => {
    const demoUser = {
      id: 'demo-google-user-101',
      email: 'alex.creator@gmail.com',
      name: 'Alex Rivera',
      givenName: 'Alex',
      picture: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
      isDemo: true
    };
    onLoginSuccess(demoUser);
    setShowConfigModal(false);
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

  const handleSignOut = () => {
    setShowDropdown(false);
    onLogout();
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
            title={`Signed in as ${currentUser.name} (${currentUser.email})`}
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
                {currentUser.givenName?.[0] || currentUser.name?.[0] || 'U'}
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
                    {currentUser.givenName?.[0] || currentUser.name?.[0] || 'U'}
                  </div>
                )}
                <div className="dropdown-info">
                  <div className="dropdown-name">{currentUser.name}</div>
                  <div className="dropdown-email">{currentUser.email}</div>
                  {currentUser.isDemo && (
                    <span className="demo-badge">Demo Google Account</span>
                  )}
                </div>
              </div>

              <div className="dropdown-divider"></div>

              <div className="dropdown-stats">
                <div className="stat-item">
                  <span className="stat-label">Cloud Memory</span>
                  <span className="stat-value text-emerald">● Synchronized</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Messages</span>
                  <span className="stat-value">{conversationCount} stored</span>
                </div>
              </div>

              <div className="dropdown-divider"></div>

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
          {configuredClientId ? (
            <GoogleOAuthProvider clientId={configuredClientId}>
              <div className="google-login-box">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => console.warn('Google Sign-In failed')}
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
              title="Sign in with Google Account"
            >
              <GoogleIcon size={16} />
              <span className="google-btn-text">Sign In</span>
            </button>
          )}
        </div>
      )}

      {/* 3. Google OAuth Setup / Demo Modal */}
      {showConfigModal && (
        <div className="modal-backdrop" onClick={() => setShowConfigModal(false)}>
          <div className="google-modal-card glass-elevated" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-row">
                <GoogleIcon size={24} />
                <h3>Google Sign-In</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowConfigModal(false)}
              >
                ✕
              </button>
            </div>

            <p className="modal-description">
              Sign in with your Google account to enable persistent cloud conversation memory, custom voice preferences, and personalized ambient AI experiences.
            </p>

            <div className="modal-demo-section">
              <button
                type="button"
                className="btn-demo-login"
                onClick={handleDemoLogin}
              >
                <GoogleIcon size={18} />
                <span>Instant Sign In (Demo Profile)</span>
              </button>
              <span className="demo-hint">Tests user profile, avatar, cloud sync status & private memory</span>
            </div>

            <div className="modal-divider">
              <span>OR CONNECT REAL CLIENT ID</span>
            </div>

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
                <strong>3.</strong> Paste in your <code>.env</code> file:
                <code>VITE_GOOGLE_CLIENT_ID=your_id.apps.googleusercontent.com</code>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
