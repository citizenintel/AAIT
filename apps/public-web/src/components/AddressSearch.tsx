import { useState, useCallback, useRef } from 'react';
import { useAppStore } from '@/stores/app-store';

interface SearchResult {
  lat: number;
  lng: number;
  displayName: string;
}

const RADIUS_OPTIONS = [
  { value: 5, label: '5 km' },
  { value: 15, label: '15 km' },
  { value: 30, label: '30 km' },
  { value: 50, label: '50 km' },
  { value: 100, label: '100 km' },
];

export function AddressSearch() {
  const [query, setQuery] = useState('');
  const [radius, setRadius] = useState(15);
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<number>(0);

  const searchLocation = useAppStore((s) => s.searchLocation);
  const setSearchLocation = useAppStore((s) => s.setSearchLocation);

  const geocode = useCallback(async (text: string) => {
    if (text.length < 3) { setSuggestions([]); return; }
    setLoading(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?` +
        `q=${encodeURIComponent(text)}&countrycodes=za&format=json&limit=5&addressdetails=1`;
      const res = await fetch(url, {
        headers: { 'Accept-Language': 'en' },
      });
      const data = await res.json();
      setSuggestions(
        data.map((r: { lat: string; lon: string; display_name: string }) => ({
          lat: parseFloat(r.lat),
          lng: parseFloat(r.lon),
          displayName: r.display_name,
        })),
      );
      setShowSuggestions(true);
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInput = (value: string) => {
    setQuery(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => geocode(value), 400);
  };

  const selectResult = (result: SearchResult) => {
    setQuery(result.displayName.split(',').slice(0, 2).join(','));
    setShowSuggestions(false);
    setSuggestions([]);
    setSearchLocation({ lat: result.lat, lng: result.lng, radiusKm: radius, label: result.displayName });
  };

  const handleSearch = () => {
    if (suggestions.length > 0) {
      selectResult(suggestions[0]);
    } else if (query.length >= 3) {
      geocode(query).then(() => {
        // Will select first result on next render
      });
    }
  };

  const resetSearch = () => {
    setQuery('');
    setSuggestions([]);
    setShowSuggestions(false);
    setSearchLocation(null);
  };

  const handleRadiusChange = (newRadius: number) => {
    setRadius(newRadius);
    if (searchLocation) {
      setSearchLocation({ ...searchLocation, radiusKm: newRadius });
    }
  };

  return (
    <div className="address-search">
      <div className="address-search-row">
        <div className="address-search-input-wrap">
          <svg className="address-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            className="address-search-input"
            placeholder="Search near an address or farm..."
            value={query}
            onChange={(e) => handleInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSearch(); } }}
            onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
          />
          {loading && <span className="address-search-spinner" />}
        </div>
        <select
          className="address-search-radius"
          value={radius}
          onChange={(e) => handleRadiusChange(parseInt(e.target.value))}
        >
          {RADIUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>Within {opt.label}</option>
          ))}
        </select>
        <button className="address-search-btn" onClick={handleSearch}>Search</button>
        {searchLocation && (
          <button className="address-search-reset" onClick={resetSearch}>Reset</button>
        )}
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <ul className="address-search-suggestions">
          {suggestions.map((s, i) => (
            <li key={i} onClick={() => selectResult(s)}>
              {s.displayName}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
