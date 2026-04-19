// Open-Meteo — free, no API key required.
// WMO weather interpretation codes
const WMO = {
  0:"Clear sky", 1:"Mainly clear", 2:"Partly cloudy", 3:"Overcast",
  45:"Foggy", 48:"Foggy",
  51:"Light drizzle", 53:"Drizzle", 55:"Heavy drizzle",
  61:"Light rain", 63:"Rain", 65:"Heavy rain",
  71:"Light snow", 73:"Snow", 75:"Heavy snow",
  80:"Rain showers", 81:"Rain showers", 82:"Heavy showers",
  95:"Thunderstorm", 99:"Thunderstorm",
};

const RAIN_CODES = new Set([51,53,55,61,63,65,80,81,82,95,99]);

function parse(data) {
  const tempNow  = Math.round(data.current.temperature_2m);
  const tempHigh = Math.round(data.daily.temperature_2m_max[0]);
  const tempLow  = Math.round(data.daily.temperature_2m_min[0]);
  const code     = data.current.weathercode;
  const condition = WMO[code] || "Variable";
  const rainChance = data.daily.precipitation_probability_max?.[0] ?? 0;
  const isRainy  = RAIN_CODES.has(code) || rainChance >= 40;
  const summary  = `${condition} · ${tempHigh}°/${tempLow}°F${isRainy ? ` · ${rainChance}% rain` : ""}`;
  return { tempNow, tempHigh, tempLow, condition, rainChance, isRainy, summary };
}

export async function fetchWeatherByCoords(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,weathercode` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
    `&temperature_unit=fahrenheit&timezone=auto&forecast_days=1`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Weather service unavailable");
  return parse(await res.json());
}

export async function fetchWeatherByCity(city) {
  const geo = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`);
  const gd  = await geo.json();
  const place = gd.results?.[0];
  if (!place) throw new Error(`City not found: "${city}"`);
  return fetchWeatherByCoords(place.latitude, place.longitude);
}

export function fetchWeatherByGeolocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error("Geolocation not supported")); return; }
    navigator.geolocation.getCurrentPosition(
      pos => fetchWeatherByCoords(pos.coords.latitude, pos.coords.longitude).then(resolve).catch(reject),
      ()  => reject(new Error("Location access denied — set a home city in Settings"))
    );
  });
}
