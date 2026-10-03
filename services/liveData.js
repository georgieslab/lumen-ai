/**
 * Zero-Key Real-Time Live Data Engine for Lumen AI
 * - Global Live Weather & Multi-Day Forecast (Open-Meteo API)
 * - Real-Time Cryptocurrency & Financial Market Tickers (CoinGecko / Binance)
 */

const WMO_CODES = {
  0: { desc: 'Clear Sky', icon: '☀️' },
  1: { desc: 'Mainly Clear', icon: '🌤️' },
  2: { desc: 'Partly Cloudy', icon: '⛅' },
  3: { desc: 'Overcast', icon: '☁️' },
  45: { desc: 'Foggy', icon: '🌫️' },
  48: { desc: 'Depositing Rime Fog', icon: '🌫️' },
  51: { desc: 'Light Drizzle', icon: '🌦️' },
  53: { desc: 'Moderate Drizzle', icon: '🌦️' },
  55: { desc: 'Dense Drizzle', icon: '🌧️' },
  61: { desc: 'Slight Rain', icon: '🌧️' },
  63: { desc: 'Moderate Rain', icon: '🌧️' },
  65: { desc: 'Heavy Rain', icon: '🌧️' },
  71: { desc: 'Slight Snow', icon: '🌨️' },
  73: { desc: 'Moderate Snow', icon: '🌨️' },
  75: { desc: 'Heavy Snow', icon: '❄️' },
  77: { desc: 'Snow Grains', icon: '❄️' },
  80: { desc: 'Slight Rain Showers', icon: '🌦️' },
  81: { desc: 'Moderate Rain Showers', icon: '🌧️' },
  82: { desc: 'Violent Rain Showers', icon: '⛈️' },
  85: { desc: 'Slight Snow Showers', icon: '🌨️' },
  86: { desc: 'Heavy Snow Showers', icon: '❄️' },
  95: { desc: 'Thunderstorm', icon: '🌩️' },
  96: { desc: 'Thunderstorm with Hail', icon: '⛈️' },
  99: { desc: 'Heavy Thunderstorm with Hail', icon: '⛈️' }
};

/**
 * Fetch live real-time weather and forecast for any city or coordinate
 */
export async function fetchLiveWeather(cityQuery) {
  const cleanCity = String(cityQuery || '').trim();
  if (!cleanCity) {
    return { error: 'No city name provided.' };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);

  try {
    // 1. Geocode city name to lat/lon
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cleanCity)}&count=1&language=en&format=json`;
    const geoRes = await fetch(geoUrl, { signal: controller.signal });
    if (!geoRes.ok) throw new Error(`Geocoding HTTP error ${geoRes.status}`);
    const geoData = await geoRes.json();

    if (!geoData.results || geoData.results.length === 0) {
      clearTimeout(timeout);
      return { error: `Could not locate coordinates for "${cleanCity}".` };
    }

    const loc = geoData.results[0];
    const { latitude, longitude, name, country, admin1 } = loc;

    // 2. Fetch live weather & daily forecast
    const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto`;
    const wRes = await fetch(forecastUrl, { signal: controller.signal });
    clearTimeout(timeout);

    if (!wRes.ok) throw new Error(`Weather forecast HTTP error ${wRes.status}`);
    const wData = await wRes.json();
    const current = wData.current || {};
    const daily = wData.daily || {};

    const code = current.weather_code ?? 0;
    const wmo = WMO_CODES[code] || { desc: 'Clear', icon: '☀️' };

    // Format 3-day forecast pills
    const forecastDays = [];
    if (Array.isArray(daily.time)) {
      for (let i = 0; i < Math.min(3, daily.time.length); i++) {
        const dCode = daily.weather_code?.[i] ?? 0;
        const dWmo = WMO_CODES[dCode] || { desc: 'Clear', icon: '☀️' };
        const dateObj = new Date(daily.time[i]);
        const dayLabel = i === 0 ? 'Today' : dateObj.toLocaleDateString('en-US', { weekday: 'short' });
        forecastDays.push({
          day: dayLabel,
          icon: dWmo.icon,
          desc: dWmo.desc,
          max: Math.round(daily.temperature_2m_max?.[i] ?? 0),
          min: Math.round(daily.temperature_2m_min?.[i] ?? 0)
        });
      }
    }

    const locationLabel = [name, admin1, country].filter(Boolean).slice(0, 2).join(', ');

    return {
      success: true,
      widgetType: 'weather',
      city: locationLabel,
      temp: Math.round(current.temperature_2m ?? 0),
      feelsLike: Math.round(current.apparent_temperature ?? current.temperature_2m ?? 0),
      humidity: Math.round(current.relative_humidity_2m ?? 0),
      wind: Math.round(current.wind_speed_10m ?? 0),
      condition: wmo.desc,
      icon: wmo.icon,
      high: Math.round(daily.temperature_2m_max?.[0] ?? current.temperature_2m ?? 0),
      low: Math.round(daily.temperature_2m_min?.[0] ?? current.temperature_2m ?? 0),
      forecast: forecastDays,
      summary: `Current weather in ${locationLabel}: ${Math.round(current.temperature_2m)}°C, ${wmo.desc} ${wmo.icon}. High of ${Math.round(daily.temperature_2m_max?.[0] || 0)}°C, low of ${Math.round(daily.temperature_2m_min?.[0] || 0)}°C with ${Math.round(current.relative_humidity_2m)}% humidity and wind at ${Math.round(current.wind_speed_10m)} km/h.`
    };
  } catch (err) {
    clearTimeout(timeout);
    console.warn(`Weather fetch failed for ${cityQuery}:`, err.message);
    return { error: `Failed to fetch weather: ${err.message}` };
  }
}

/**
 * Fetch live cryptocurrency and market prices
 */
export async function fetchCryptoPrices(assetQuery, currency = 'usd') {
  const raw = String(assetQuery || '').trim().toLowerCase();
  if (!raw) return { error: 'No cryptocurrency asset provided.' };

  const idMap = {
    btc: 'bitcoin',
    bitcoin: 'bitcoin',
    eth: 'ethereum',
    ethereum: 'ethereum',
    sol: 'solana',
    solana: 'solana',
    xrp: 'ripple',
    ripple: 'ripple',
    doge: 'dogecoin',
    dogecoin: 'dogecoin',
    ada: 'cardano',
    cardano: 'cardano',
    bnb: 'binancecoin',
    binancecoin: 'binancecoin',
    avax: 'avalanche-2',
    avalanche: 'avalanche-2'
  };

  const coinId = idMap[raw] || raw;
  const targetCurrency = currency.toLowerCase();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);

  // 1. Try CoinGecko Public Markets API
  try {
    const cgUrl = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=${targetCurrency}&ids=${encodeURIComponent(coinId)}&order=market_cap_desc&per_page=1&page=1&sparkline=false&price_change_percentage=24h`;
    const res = await fetch(cgUrl, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'LumenAI-Agent/1.0'
      }
    });

    if (res.ok) {
      clearTimeout(timeout);
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const c = data[0];
        const isPositive = (c.price_change_percentage_24h || 0) >= 0;
        return {
          success: true,
          widgetType: 'crypto',
          name: c.name,
          symbol: c.symbol.toUpperCase(),
          price: c.current_price,
          change24h: Number((c.price_change_percentage_24h || 0).toFixed(2)),
          isPositive,
          high24h: c.high_24h,
          low24h: c.low_24h,
          marketCap: c.market_cap,
          currency: targetCurrency.toUpperCase(),
          image: c.image,
          summary: `${c.name} (${c.symbol.toUpperCase()}) is currently trading at $${c.current_price.toLocaleString()} ${targetCurrency.toUpperCase()} (${isPositive ? '+' : ''}${c.price_change_percentage_24h.toFixed(2)}% in the last 24h). 24h range: $${c.low_24h?.toLocaleString()} - $${c.high_24h?.toLocaleString()}.`
        };
      }
    }
  } catch (cgErr) {
    console.warn('CoinGecko fetch failed, trying Binance fallback:', cgErr.message);
  }

  // 2. Fallback to Binance Ticker API (extremely fast & reliable without rate limits)
  try {
    const binanceSymbol = `${raw.replace(/bitcoin/i, 'btc').replace(/ethereum/i, 'eth').replace(/solana/i, 'sol').toUpperCase()}USDT`;
    const bUrl = `https://api.binance.com/api/v3/ticker/24hr?symbol=${binanceSymbol}`;
    const bRes = await fetch(bUrl, { signal: controller.signal });
    clearTimeout(timeout);

    if (bRes.ok) {
      const bData = await bRes.json();
      const price = parseFloat(bData.lastPrice);
      const change = parseFloat(bData.priceChangePercent);
      const high = parseFloat(bData.highPrice);
      const low = parseFloat(bData.lowPrice);
      const isPositive = change >= 0;

      return {
        success: true,
        widgetType: 'crypto',
        name: raw.toUpperCase(),
        symbol: raw.toUpperCase(),
        price,
        change24h: Number(change.toFixed(2)),
        isPositive,
        high24h: high,
        low24h: low,
        currency: 'USD',
        summary: `${raw.toUpperCase()} is currently trading at $${price.toLocaleString()} USD (${isPositive ? '+' : ''}${change.toFixed(2)}% in 24h). 24h high: $${high.toLocaleString()}, 24h low: $${low.toLocaleString()}.`
      };
    }
  } catch (bErr) {
    clearTimeout(timeout);
    console.warn('Binance fallback failed:', bErr.message);
  }

  return {
    error: `Could not retrieve live market price for "${assetQuery}". Please verify the asset name or try again shortly.`
  };
}
