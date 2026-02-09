# ATM Locator PWA

A simple, offline-first Progressive Web App for finding ATM locations using OpenStreetMap. Completely free and open source.

## Features

- **Offline First**: Works without internet connection after first load
- **OpenStreetMap**: Free, open source maps (no API keys needed)
- **PWA**: Installable on mobile devices and desktops
- **Search & Filter**: Find ATMs by name, city, or bank
- **Geolocation**: Find ATMs near your current location
- **Navigation**: One-click navigation to any ATM
- **Multi-city/Multi-bank**: Supports multiple JSON data files

## Project Structure

```
atm-locator/
├── index.html          # Main HTML file
├── app.js             # Application logic
├── styles.css         # Styling
├── manifest.json      # PWA manifest
├── service-worker.js  # Offline support
├── data/              # ATM data directory
│   └── rt-bank-erbil.json  # RT Bank Erbil locations
└── README.md
```

## Getting Started

1. **Add your ATM data**:
   - Place your JSON files in the `data/` folder
   - **Important**: Use the naming convention `{bank-name}-{city}.json`
   - Examples: `rt-bank-erbil.json`, `rt-bank-sulaymaniyah.json`, `kurdistan-bank-dohuk.json`
   - Each JSON should have a `result` array with ATM objects
   - The app automatically extracts bank and city from the filename!

2. **Update the file list**:
   - Open `app.js`
   - Find the `scanDataFiles()` method
   - Add your new JSON file to the `patterns` array:
   ```javascript
   const patterns = [
       'data/rt-bank-erbil.json',
       'data/rt-bank-sulaymaniyah.json',
       'data/kurdistan-bank-dohuk.json',
       // Add more files here...
   ];
   ```

3. **Serve the app**:
   - Use any static file server
   - Examples:
     ```bash
     # Python 3
     python -m http.server 8000
     
     # Node.js (npx)
     npx serve .
     
     # PHP
     php -S localhost:8000
     ```

4. **Install as PWA**:
   - Open the app in your browser
   - Look for the "Install" or "Add to Home Screen" option
   - Works on iOS, Android, and desktop browsers

## JSON Data Format

```json
{
  "result": [
    {
      "id": "unique-id",
      "title": "ATM Location Name",
      "type": "ATM",
      "latitude": 36.2224,
      "longitude": 43.9970,
      "description": "Optional description"
    }
  ]
}
```

**Note**: You don't need to include `city` and `bank` fields in your JSON files - they are automatically extracted from the filename! For example, `rt-bank-erbil.json` will automatically set `bank: "RT Bank"` and `city: "Erbil"` for all ATMs in that file.

## Browser Support

- Chrome/Edge (recommended for best PWA support)
- Firefox
- Safari (iOS 11.3+)
- Samsung Internet

## License

MIT License - feel free to use, modify, and distribute!

## Customization

- **Colors**: Edit CSS variables in `styles.css`
- **Icons**: Replace the SVG data URIs in `manifest.json` and `index.html`
- **Map style**: Modify the tile layer in `app.js` initMap()
- **Language**: All text is in English but can be easily translated