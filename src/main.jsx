import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import LandingPage from './components/LandingPage.jsx';
import './App.css';

const APP_ROUTE_KEY = 'lumen_app_route';

function readAppRoute() {
  if (window.location.hash === '#app') {
    try {
      window.sessionStorage.setItem(APP_ROUTE_KEY, 'true');
    } catch (_) {
      // The hash route still works when session storage is unavailable.
    }
    return true;
  }

  try {
    return window.sessionStorage.getItem(APP_ROUTE_KEY) === 'true';
  } catch (_) {
    return new URLSearchParams(window.location.search).has('auth_error');
  }
}

function Root() {
  const [showApp, setShowApp] = React.useState(readAppRoute);

  React.useEffect(() => {
    const syncRoute = () => {
      const nextShowApp = window.location.hash === '#app';
      try {
        if (nextShowApp) {
          window.sessionStorage.setItem(APP_ROUTE_KEY, 'true');
        } else {
          window.sessionStorage.removeItem(APP_ROUTE_KEY);
        }
      } catch (_) {
        // Route switching does not depend on session storage.
      }
      setShowApp(nextShowApp);
      if (nextShowApp) window.scrollTo(0, 0);
    };

    window.addEventListener('hashchange', syncRoute);
    return () => window.removeEventListener('hashchange', syncRoute);
  }, []);

  return showApp ? <App /> : <LandingPage />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
