// ATM Locator App
class ATMLocator {
    constructor() {
        this.map = null;
        this.markers = [];
        this.atmData = [];
        this.filteredData = [];
        this.userLocation = null;
        this.userMarker = null;
        this.headingMarker = null;
        this.heading = null;
        this.cities = new Set();
        this.banks = new Set();
        
        this.init();
    }

    async init() {
        this.registerServiceWorker();
        this.initMap();
        await this.loadData();
        this.setupEventListeners();
        this.updateConnectionStatus();
        
        // Watch for online/offline changes
        window.addEventListener('online', () => this.updateConnectionStatus());
        window.addEventListener('offline', () => this.updateConnectionStatus());
    }

    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('service-worker.js')
                .then(registration => {
                    console.log('Service Worker registered:', registration);
                })
                .catch(error => {
                    console.log('Service Worker registration failed:', error);
                });
        }
    }

    updateConnectionStatus() {
        const statusEl = document.getElementById('connectionStatus');
        const statusText = statusEl.querySelector('.status-text');
        const statusDot = statusEl.querySelector('.status-dot');
        
        if (navigator.onLine) {
            statusEl.classList.remove('offline');
            statusText.textContent = 'Online';
            statusDot.style.background = '#2ecc71';
        } else {
            statusEl.classList.add('offline');
            statusText.textContent = 'Offline';
            statusDot.style.background = '#e74c3c';
        }
    }

    initMap() {
        // Initialize map centered on Erbil
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        this.map = L.map('map', {
            center: [36.1911, 44.0092],
            zoom: 12,
            zoomControl: true,
            attributionControl: true,
            // Enable rotation on mobile (two-finger rotate)
            rotate: isMobile,
            rotateControl: isMobile
        });

        // Bank colors for markers
        this.bankColors = {
            'Cihan Bank': '#3498db',
            'NBI': '#27ae60',
            'RT Bank': '#e67e22'
        };

        // Map tile providers
        this.mapStyles = {
            dark: {
                url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
                subdomains: 'abcd',
                maxZoom: 20
            },
            light: {
                url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
                subdomains: 'abcd',
                maxZoom: 20
            }
        };

        this.currentTileLayer = null;
        this.setMapStyle('dark');
    }

    setMapStyle(styleKey) {
        if (this.currentTileLayer) {
            this.map.removeLayer(this.currentTileLayer);
        }

        const style = this.mapStyles[styleKey];
        this.currentTileLayer = L.tileLayer(style.url, {
            attribution: style.attribution,
            subdomains: style.subdomains || undefined,
            maxZoom: style.maxZoom
        }).addTo(this.map);
        
        this.map.invalidateSize();

        const toggleBtn = document.getElementById('themeToggle');
        if (styleKey === 'light') {
            toggleBtn.classList.add('light');
        } else {
            toggleBtn.classList.remove('light');
        }
    }

    async loadData() {
        try {
            const dataFiles = await this.scanDataFiles();
            const loadedData = [];
            
            for (const file of dataFiles) {
                try {
                    const response = await fetch(file);
                    if (response.ok) {
                        const data = await response.json();
                        const parsed = this.parseATMData(data, file);
                        loadedData.push(...parsed);
                    }
                } catch (e) {
                    console.warn(`Could not load ${file}:`, e);
                }
            }

            if (loadedData.length === 0) {
                loadedData.push(...this.getSampleData());
            }

            this.atmData = loadedData;
            this.filteredData = [...this.atmData];
            
            console.log('Loaded ATMs:', this.atmData.length);
            console.log('Banks found:', [...this.banks]);
            console.log('Cities found:', [...this.cities]);
            
            this.extractCitiesAndBanks();
            this.populateFilters();
            this.renderMarkers();
            this.updateStats();
            this.updateList();

        } catch (error) {
            console.error('Error loading data:', error);
        }
    }

    async scanDataFiles() {
        const existingFiles = [];
        
        try {
            const response = await fetch('data/');
            const text = await response.text();
            const fileMatches = text.match(/href="([^"]*\.json)"/g);
            
            if (fileMatches) {
                for (const match of fileMatches) {
                    const filename = match.replace('href="', '').replace('"', '');
                    existingFiles.push(`data/${filename}`);
                }
            }
        } catch (e) {
            const patterns = [
                'data/rt-bank-erbil.json',
                'data/rt-bank-slemani.json',
                'data/rt-bank-duhok.json',
                'data/cihan-bank.json',
                'data/nbi-bank.json',
            ];
            
            for (const file of patterns) {
                try {
                    const response = await fetch(file, { method: 'HEAD' });
                    if (response.ok) {
                        existingFiles.push(file);
                    }
                } catch (err) {}
            }
        }

        return existingFiles;
    }

    parseATMData(data, filename) {
        const basename = filename.replace('data/', '').replace('.json', '');
        
        if (basename.startsWith('cihan-bank')) {
            return this.parseCihanBank(data);
        } else if (basename.startsWith('nbi-bank')) {
            return this.parseNBIBank(data);
        } else {
            return this.parseRTBank(data, filename);
        }
    }

    parseCihanBank(data) {
        const atms = [];
        const cities = Object.keys(data);
        
        for (const city of cities) {
            const cityATMs = data[city];
            const atmKeys = Object.keys(cityATMs);
            
            for (const atmKey of atmKeys) {
                const atm = cityATMs[atmKey];
                if (atm.lat && atm.lng) {
                    atms.push({
                        id: `${city.toLowerCase()}-${atmKey}`,
                        title: atmKey,
                        latitude: atm.lat,
                        longitude: atm.lng,
                        address: atm.address,
                        city: city,
                        bank: 'Cihan Bank'
                    });
                }
            }
        }
        
        return atms;
    }

    parseNBIBank(data) {
        const atms = [];
        
        if (!data.Result || !data.Result.Locations) {
            return atms;
        }
        
        for (const location of data.Result.Locations) {
            if (location.LocationType !== 1) continue;
            
            const coords = this.extractCoordsFromEmbed(location.EmebededGoogleMapsLink);
            if (!coords) continue;
            
            const city = this.inferCityFromCoords(coords.lat, coords.lng);
            
            atms.push({
                id: `nbi-${atms.length}`,
                title: location.LocationName?.trim() || 'NBI ATM',
                latitude: coords.lat,
                longitude: coords.lng,
                city: city,
                bank: 'NBI'
            });
        }
        
        return atms;
    }

    parseRTBank(data, filename) {
        const { bank, city } = this.parseFilename(filename);
        const atms = [];
        
        if (data.result && Array.isArray(data.result)) {
            for (const item of data.result) {
                if (item.latitude && item.longitude) {
                    if (item.type && item.type !== 'ATM') continue;
                    
                    atms.push({
                        id: item.id,
                        title: item.title,
                        latitude: item.latitude,
                        longitude: item.longitude,
                        city: city,
                        bank: bank
                    });
                }
            }
        }
        
        return atms;
    }

    extractCoordsFromEmbed(embedUrl) {
        if (!embedUrl) return null;
        
        const match = embedUrl.match(/!2d(-?\d+\.?\d*)!3d(-?\d+\.?\d*)/);
        if (match) {
            return {
                lng: parseFloat(match[1]),
                lat: parseFloat(match[2])
            };
        }
        
        return null;
    }

    inferCityFromCoords(lat, lng) {
        const cities = [
            { name: 'Erbil', minLat: 36.0, maxLat: 36.6, minLng: 43.8, maxLng: 44.4 },
            { name: 'Sulaymaniyah', minLat: 35.1, maxLat: 35.9, minLng: 44.9, maxLng: 46.2 },
            { name: 'Duhok', minLat: 36.8, maxLat: 37.5, minLng: 42.6, maxLng: 43.5 },
            { name: 'Mosul', minLat: 35.9, maxLat: 36.5, minLng: 42.8, maxLng: 43.5 },
            { name: 'Kirkuk', minLat: 35.2, maxLat: 35.8, minLng: 44.1, maxLng: 44.7 },
            { name: 'Baghdad', minLat: 32.9, maxLat: 33.7, minLng: 43.8, maxLng: 44.7 },
            { name: 'Basra', minLat: 29.8, maxLat: 31.0, minLng: 47.0, maxLng: 48.5 },
            { name: 'Ninawa', minLat: 36.0, maxLat: 36.6, minLng: 42.5, maxLng: 43.2 },
        ];
        
        for (const city of cities) {
            if (lat >= city.minLat && lat <= city.maxLat && lng >= city.minLng && lng <= city.maxLng) {
                return city.name;
            }
        }
        
        return 'Other';
    }

    parseFilename(filename) {
        const basename = filename.replace('data/', '').replace('.json', '');
        const parts = basename.split('-');
        
        let city = parts.pop();
        
        const cityMapping = {
            'slemani': 'Sulaymaniyah',
            'sulaymaniyah': 'Sulaymaniyah',
            'duhok': 'Duhok',
            'dohuk': 'Duhok',
            'erbil': 'Erbil',
            'baghdad': 'Baghdad',
            'mosul': 'Mosul',
            'kirkuk': 'Kirkuk',
            'basra': 'Basra'
        };
        
        city = cityMapping[city.toLowerCase()] || city.charAt(0).toUpperCase() + city.slice(1);
        
        const bank = parts.map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
        
        const bankNameMapping = {
            'Rt Bank': 'RT Bank'
        };
        
        return { bank: bankNameMapping[bank] || bank, city };
    }

    getSampleData() {
        return [
            {
                "id": "sample-1",
                "title": "Sample ATM - Erbil",
                "type": "ATM",
                "latitude": 36.1911,
                "longitude": 44.0092,
                "description": "Sample ATM location",
                "city": "Erbil",
                "bank": "Sample Bank"
            },
            {
                "id": "sample-2",
                "title": "Sample ATM - Sulaymaniyah",
                "type": "ATM",
                "latitude": 35.5575,
                "longitude": 45.4350,
                "description": "Sample ATM location",
                "city": "Sulaymaniyah",
                "bank": "Sample Bank"
            }
        ];
    }

    extractCitiesAndBanks() {
        this.cities.clear();
        this.banks.clear();
        
        this.atmData.forEach(atm => {
            if (atm.city) this.cities.add(atm.city);
            if (atm.bank) this.banks.add(atm.bank);
        });
    }

    populateFilters() {
        const citySelect = document.getElementById('cityFilter');
        const bankSelect = document.getElementById('bankFilter');

        // Clear existing options except first
        citySelect.innerHTML = '<option value="">All Cities</option>';
        bankSelect.innerHTML = '<option value="">All Banks</option>';

        // Add cities
        Array.from(this.cities).sort().forEach(city => {
            const option = document.createElement('option');
            option.value = city;
            option.textContent = city;
            citySelect.appendChild(option);
        });

        // Add banks
        Array.from(this.banks).sort().forEach(bank => {
            const option = document.createElement('option');
            option.value = bank;
            option.textContent = bank;
            bankSelect.appendChild(option);
        });
    }

    renderMarkers() {
        // Clear existing markers
        this.markers.forEach(marker => this.map.removeLayer(marker));
        this.markers = [];

        // Add markers for filtered data
        this.filteredData.forEach(atm => {
            const color = this.getBankColor(atm.bank);
            const icon = this.createMarkerIcon(color);
            const marker = L.marker([atm.latitude, atm.longitude], { icon })
                .addTo(this.map)
                .bindPopup(this.createPopupContent(atm));
            
            marker.atmData = atm;
            this.markers.push(marker);
        });

        // Fit bounds if we have markers
        if (this.markers.length > 0) {
            const group = new L.featureGroup(this.markers);
            this.map.fitBounds(group.getBounds().pad(0.1));
        }
    }

    getBankColor(bank) {
        return this.bankColors[bank] || '#2ecc71';
    }

    createMarkerIcon(color) {
        return L.divIcon({
            className: 'custom-marker',
            html: `<div style="background-color: ${color}; width: 30px; height: 30px; border-radius: 50%; border: 3px solid white; box-shadow: 0 3px 8px rgba(0,0,0,0.35), 0 0 0 2px rgba(0,0,0,0.1);"></div>`,
            iconSize: [30, 30],
            iconAnchor: [15, 15],
            popupAnchor: [0, -15]
        });
    }

    createPopupContent(atm) {
        const color = this.getBankColor(atm.bank);
        
        let addressHtml = '';
        if (atm.address && atm.address.en) {
            addressHtml = `<div class="popup-address">${atm.address.en}</div>`;
        } else if (atm.address && typeof atm.address === 'string') {
            addressHtml = `<div class="popup-address">${atm.address}</div>`;
        }
        
        return `
            <div class="popup-container">
                <div class="popup-header">
                    <div class="popup-bank-badge" style="background-color: ${color};">${atm.bank}</div>
                    <div class="popup-title">${atm.title}</div>
                </div>
                <div class="popup-body">
                    ${atm.city ? `<div class="popup-row"><svg width="14" height="14" viewBox="0 0 24 24" fill="#666"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>${atm.city}</div>` : ''}
                    ${addressHtml}
                </div>
                <div class="popup-actions">
                    <button class="popup-btn primary" onclick="app.getDirections('${atm.id}')">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M21.71 11.29l-9-9c-.39-.39-1.02-.39-1.41 0l-9 9c-.39.39-.39 1.02 0 1.41l9 9c.39.39 1.02.39 1.41 0l9-9c.39-.38.39-1.01 0-1.41zM14 14.5V12h-4v3H8v-4c0-.55.45-1 1-1h5V7.5l3.5 3.5-3.5 3.5z"/></svg>
                        Get Directions
                    </button>
                </div>
            </div>
        `;
    }

    setupEventListeners() {
        // Search
        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.filterATMs();
        });

        // Clear search
        document.getElementById('clearSearch').addEventListener('click', () => {
            document.getElementById('searchInput').value = '';
            this.filterATMs();
        });

        // Filters
        document.getElementById('cityFilter').addEventListener('change', () => {
            this.filterATMs();
        });

        document.getElementById('bankFilter').addEventListener('change', () => {
            this.filterATMs();
        });

        // Theme toggle
        document.getElementById('themeToggle').addEventListener('click', () => {
            const newTheme = this.currentTileLayer && this.mapStyles.dark.url === this.currentTileLayer._url ? 'light' : 'dark';
            this.setMapStyle(newTheme);
        });

        // Locate button
        document.getElementById('locateBtn').addEventListener('click', () => {
            this.locateUser();
        });

        // List toggle
        document.getElementById('toggleList').addEventListener('click', () => {
            document.getElementById('atmList').classList.remove('hidden');
            document.getElementById('toggleList').classList.add('hidden');
        });

        document.getElementById('closeList').addEventListener('click', () => {
            document.getElementById('atmList').classList.add('hidden');
            document.getElementById('toggleList').classList.remove('hidden');
        });

        // Click outside to close list on desktop
        document.addEventListener('click', (e) => {
            const list = document.getElementById('atmList');
            const toggle = document.getElementById('toggleList');
            const map = document.getElementById('map');
            
            if (window.innerWidth >= 768 && 
                !list.classList.contains('hidden') &&
                !list.contains(e.target) && 
                !toggle.contains(e.target) &&
                map && map.contains(e.target)) {
                list.classList.add('hidden');
                toggle.classList.remove('hidden');
            }
        });
    }

    filterATMs() {
        const searchTerm = document.getElementById('searchInput').value.toLowerCase();
        const selectedCity = document.getElementById('cityFilter').value;
        const selectedBank = document.getElementById('bankFilter').value;

        this.filteredData = this.atmData.filter(atm => {
            const matchesSearch = !searchTerm || 
                atm.title.toLowerCase().includes(searchTerm) ||
                (atm.description && atm.description.toLowerCase().includes(searchTerm));
            
            const matchesCity = !selectedCity || atm.city === selectedCity;
            const matchesBank = !selectedBank || atm.bank === selectedBank;

            return matchesSearch && matchesCity && matchesBank;
        });

        this.renderMarkers();
        this.updateStats();
        this.updateList();
    }

    updateStats() {
        const count = this.filteredData.length;
        document.getElementById('atmCount').textContent = 
            `${count} ATM${count !== 1 ? 's' : ''} found`;
    }

    updateList() {
        const listContent = document.getElementById('listContent');
        listContent.innerHTML = '';

        // Sort by distance if user location is available
        let sortedData = [...this.filteredData];
        if (this.userLocation) {
            sortedData.sort((a, b) => {
                const distA = this.calculateDistance(this.userLocation, a);
                const distB = this.calculateDistance(this.userLocation, b);
                return distA - distB;
            });
        }

        sortedData.forEach(atm => {
            const item = document.createElement('div');
            item.className = 'atm-item';
            
            const color = this.getBankColor(atm.bank);
            
            let distanceHtml = '';
            if (this.userLocation) {
                const distance = this.calculateDistance(this.userLocation, atm);
                distanceHtml = `<div class="atm-item-distance">${this.formatDistance(distance)}</div>`;
            }

            item.innerHTML = `
                <div class="atm-item-color" style="background-color: ${color};"></div>
                <div class="atm-item-content">
                    <div class="atm-item-title">${atm.title}</div>
                    <div class="atm-item-bank" style="color: ${color};">${atm.bank}</div>
                    ${distanceHtml}
                </div>
            `;

            item.addEventListener('click', () => {
                this.focusOnATM(atm);
            });

            listContent.appendChild(item);
        });
    }

    locateUser() {
        if (!navigator.geolocation) {
            this.showLocationError('Geolocation is not supported by your browser');
            return;
        }

        this.isLocating = true;
        this.updateLocateButton(true);

        // Try with high accuracy first
        this.getLocationWithFallback(
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
            { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
        );
    }

    getLocationWithFallback(highAccuracyOptions, fallbackOptions) {
        navigator.geolocation.getCurrentPosition(
            (position) => this.handleLocationSuccess(position),
            (error) => {
                console.warn('High accuracy location failed, trying fallback...', error);
                // Try with lower accuracy
                navigator.geolocation.getCurrentPosition(
                    (position) => this.handleLocationSuccess(position),
                    (error) => this.handleLocationError(error),
                    fallbackOptions
                );
            },
            highAccuracyOptions
        );
    }

    handleLocationSuccess(position) {
        this.userLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy
        };

        // Remove existing user marker
        if (this.userMarker) {
            this.map.removeLayer(this.userMarker);
        }
        if (this.headingMarker) {
            this.map.removeLayer(this.headingMarker);
        }

        // Add user location marker
        const icon = L.divIcon({
            className: 'user-location-marker user-location-pulse',
            iconSize: [16, 16],
            iconAnchor: [8, 8]
        });

        this.userMarker = L.marker([this.userLocation.lat, this.userLocation.lng], { icon })
            .addTo(this.map);

        // Add heading cone marker
        this.updateHeadingMarker();

        // Center map on user
        this.map.setView([this.userLocation.lat, this.userLocation.lng], 14);

        // Request device orientation permission on mobile
        this.requestHeadingPermission();

        // Update list with distances
        this.updateList();

        this.isLocating = false;
        this.updateLocateButton(false);
    }

    updateHeadingMarker() {
        if (!this.userLocation) return;

        if (this.headingMarker) {
            this.map.removeLayer(this.headingMarker);
        }

        const heading = this.heading || 0;
        const coneSvg = `
            <svg width="80" height="80" viewBox="0 0 80 80" style="transform: rotate(${heading}deg);">
                <defs>
                    <linearGradient id="coneGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" style="stop-color:#3498db;stop-opacity:0.8" />
                        <stop offset="100%" style="stop-color:#3498db;stop-opacity:0.1" />
                    </linearGradient>
                </defs>
                <polygon points="40,5 60,75 40,65 20,75" fill="url(#coneGradient)" stroke="white" stroke-width="2"/>
            </svg>
        `;

        const icon = L.divIcon({
            className: 'heading-marker',
            html: coneSvg,
            iconSize: [80, 80],
            iconAnchor: [40, 40]
        });

        this.headingMarker = L.marker([this.userLocation.lat, this.userLocation.lng], { icon })
            .addTo(this.map);
    }

    async requestHeadingPermission() {
        if (typeof DeviceOrientationEvent !== 'undefined' && 
            typeof DeviceOrientationEvent.requestPermission === 'function') {
            try {
                const permission = await DeviceOrientationEvent.requestPermission();
                if (permission === 'granted') {
                    this.enableHeadingTracking();
                }
            } catch (e) {
                console.log('Heading permission denied:', e);
            }
        } else if (window.DeviceOrientationEvent) {
            this.enableHeadingTracking();
        }
    }

    enableHeadingTracking() {
        window.addEventListener('deviceorientation', (event) => {
            if (event.alpha !== null) {
                this.heading = event.alpha;
                this.updateHeadingMarker();
            }
        });
    }

    handleLocationError(error) {
        this.isLocating = false;
        this.updateLocateButton(false);

        let errorMessage = '';
        let errorDetails = '';

        switch(error.code) {
            case error.PERMISSION_DENIED:
                errorMessage = 'Location access denied';
                errorDetails = 'Please enable location permissions in your browser settings. On iOS: Settings → Privacy → Location Services → Safari';
                break;
            case error.POSITION_UNAVAILABLE:
                errorMessage = 'Location unavailable';
                errorDetails = 'Could not get your location. Please check that location services are enabled and try again.';
                break;
            case error.TIMEOUT:
                errorMessage = 'Location request timed out';
                errorDetails = 'The request took too long. Please check your connection and try again.';
                break;
            default:
                errorMessage = 'Could not get your location';
                errorDetails = 'An unexpected error occurred. Please try again.';
        }

        console.error('Geolocation error:', error.code, error.message);
        this.showLocationError(errorMessage, errorDetails);
    }

    showLocationError(title, details = '') {
        // Create custom error modal
        const modal = document.createElement('div');
        modal.className = 'location-error-modal';
        modal.innerHTML = `
            <div class="location-error-content">
                <div class="location-error-icon">📍</div>
                <h3>${title}</h3>
                <p>${details}</p>
                <button onclick="this.closest('.location-error-modal').remove()">OK</button>
            </div>
        `;
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
        document.body.appendChild(modal);
    }

    updateLocateButton(isLocating) {
        const btn = document.getElementById('locateBtn');
        if (isLocating) {
            btn.innerHTML = `
                <svg viewBox="0 0 24 24" width="20" height="20" class="spin">
                    <path fill="currentColor" d="M12 6v3l4-4-4-4v3c-4.42 0-8 3.58-8 8 0 1.57.46 3.03 1.24 4.26L6.7 14.8c-.45-.83-.7-1.79-.7-2.8 0-3.31 2.69-6 6-6zm6.76 1.74L17.3 9.2c.44.84.7 1.79.7 2.8 0 3.31-2.69 6-6 6v-3l-4 4 4 4v-3c4.42 0 8-3.58 8-8 0-1.57-.46-3.03-1.24-4.26z"/>
                </svg>
                Locating...
            `;
        } else {
            btn.innerHTML = `
                <svg viewBox="0 0 24 24" width="20" height="20">
                    <path fill="currentColor" d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3c-.46-4.17-3.77-7.48-7.94-7.94V1h-2v2.06C6.83 3.52 3.52 6.83 3.06 11H1v2h2.06c.46 4.17 3.77 7.48 7.94 7.94V23h2v-2.06c4.17-.46 7.48-3.77 7.94-7.94H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/>
                </svg>
                My Location
            `;
        }
    }

    calculateDistance(loc1, atm) {
        const R = 6371; // Earth's radius in km
        const dLat = (atm.latitude - loc1.lat) * Math.PI / 180;
        const dLon = (atm.longitude - loc1.lng) * Math.PI / 180;
        const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(loc1.lat * Math.PI / 180) * Math.cos(atm.latitude * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    formatDistance(km) {
        if (km < 1) {
            return `${Math.round(km * 1000)} m`;
        }
        return `${km.toFixed(1)} km`;
    }

    focusOnATM(atm) {
        this.map.setView([atm.latitude, atm.longitude], 16);
        
        // Find and open the marker popup
        const marker = this.markers.find(m => m.atmData.id === atm.id);
        if (marker) {
            marker.openPopup();
        }

        // Close list on mobile
        if (window.innerWidth < 768) {
            document.getElementById('atmList').classList.add('hidden');
            document.getElementById('toggleList').classList.remove('hidden');
        }
    }

    getDirections(atmId) {
        const atm = this.atmData.find(a => a.id === atmId);
        if (atm) {
            this.openNavigation(atm);
        }
    }

    openNavigation(atm) {
        const url = `https://www.google.com/maps/dir/?api=1&destination=${atm.latitude},${atm.longitude}`;
        window.open(url, '_blank');
    }
}

// Initialize app
const app = new ATMLocator();