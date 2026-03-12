# ATM Locator PWA

A modern, fast, and offline-first Progressive Web App (PWA) for finding ATM locations via OpenStreetMap. It features a beautiful glassmorphism-inspired UI and supports multiple cities and banks across Iraq and the Kurdistan Region.

## ✨ Features

- **Modern UI/UX**: Sleek, fully responsive design utilizing glassmorphism, floating action buttons, and a smooth bottom-sheet list for mobile users.
- **Offline First**: Works seamlessly even without an active internet connection using Service Workers.
- **OpenStreetMap Integration**: Interactive maps powered by Leaflet and Carto tile layers, complete with marker clustering for dense areas.
- **Geolocation & Routing**: Pinpoints your live location, calculates distances to nearby ATMs, tracks device heading, and offers direct navigation links.
- **Advanced Filtering**: Quickly filter ATMs by specific cities or banks.
- **Dark/Light Themes**: Integrated theme toggler that seamlessly switches UI elements and map tile styles.
- **PWA Ready**: Installable directly to the home screen on iOS, Android, and Desktop environments.

## 📂 Project Structure

```
atm-locator/
├── index.html          # Main application entry point with modern structure
├── app.js              # Application logic (Leaflet integration, location, filtering)
├── styles.css          # Styling & CSS variables (Glassmorphism, Dark/Light modes)
├── manifest.json       # PWA manifest containing app metadata
├── service-worker.js   # Offline caching and support
└── data/               # ATM data directory (split by bank and city)
    ├── cihan-erbil.json
    ├── rt-bank-slemani.json
    └── ...
```

## 🚀 Getting Started

1. **Add or Update ATM Data**:
   - Place your JSON files securely in the `data/` directory.
   - **Important**: Use the consistent naming convention `{bank-name}-{city}.json`.
   - Examples: `rt-bank-erbil.json`, `cihan-slemani.json`, `nbi-baghdad.json`.

2. **Update the Internal File Index**:
   - Open `app.js`.
   - Locate the `scanDataFiles()` method.
   - Add your newly created JSON file paths to the `patterns` array:
   ```javascript
   const patterns = [
       'data/rt-bank-erbil.json',
       'data/cihan-slemani.json',
       // Add new data files here...
   ];
   ```

3. **Serve the Application**:
   - Since the app fetches JSON data locally, you must serve it over HTTP/HTTPS (not `file://`).
   ```bash
   # Python 3
   python3 -m http.server 8000
   
   # Node.js (via serve)
   npx serve .
   ```

4. **Install as PWA**:
   - Open the web app on your preferred browser.
   - Select "Install" (Chrome/Edge) or "Add to Home Screen" (iOS Safari).

## 📄 JSON Data Format

The ATM dataset should be formatted securely as follows:

```json
[
  {
    "id": "unique-uuid-or-id",
    "title": "Main Branch ATM",
    "type": "ATM",
    "latitude": 36.1911,
    "longitude": 44.0092,
    "description": "24/7 Access, USD & IQD",
    "address": "60m Road, Erbil",
    "map_link": "https://maps.google.com/..."
  }
]
```
*Note: The app logic automatically infers the `city` and `bank` parameters natively from the file name. However, specifying explicit metadata per internal nodes is valid.*

## 🎨 Customization

- **Theming**: Edit CSS variables (`--bg-color`, `--glass-bg`) located within `styles.css`.
- **Map Styles**: Modify the `mapStyles` URLs under `initMap()` within `app.js` to hook up alternative tile providers.
- **Colors & Markers**: Adjust `bankColors` in `app.js` to change or brand new marker clusters dynamically.

## 📱 Browser Support

- Chrome / Edge (Recommended for highest PWA compatibility and installation)
- Safari (iOS 11.3+)
- Firefox
- Samsung Internet

## 📜 License

MIT License - feel free to use, modify, and distribute as needed!