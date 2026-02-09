// ATM Locator App
class ATMLocator {
    constructor() {
        this.map = null;
        this.markers = [];
        this.atmData = [];
        this.filteredData = [];
        this.userLocation = null;
        this.userMarker = null;
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
        this.map = L.map('map').setView([36.1911, 44.0092], 12);

        // Add CartoDB Dark Matter tile layer (free, dark mode)
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 20
        }).addTo(this.map);
    }

    async loadData() {
        try {
            // Scan for all JSON files in data directory
            // In production, you'd have a manifest or scan the directory
            // For now, we'll try to load files based on expected patterns
            const dataFiles = await this.scanDataFiles();

            const loadedData = [];
            
            for (const file of dataFiles) {
                try {
                    const response = await fetch(file);
                    if (response.ok) {
                        const data = await response.json();
                        if (data.result && Array.isArray(data.result)) {
                            // Extract bank and city from filename
                            const { bank, city } = this.parseFilename(file);
                            
                            // Inject bank and city into each ATM record
                            const atmsWithMetadata = data.result.map(atm => ({
                                ...atm,
                                bank: bank,
                                city: city
                            }));
                            
                            loadedData.push(...atmsWithMetadata);
                        }
                    }
                } catch (e) {
                    console.warn(`Could not load ${file}:`, e);
                }
            }

            // If no data loaded, use sample data
            if (loadedData.length === 0) {
                console.log('Using sample data');
                loadedData.push(...this.getSampleData());
            }

            this.atmData = loadedData;
            this.filteredData = [...this.atmData];
            
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
        // Try to load files based on expected patterns
        // You can add more patterns here for new banks/cities
        const patterns = [
            'data/rt-bank-erbil.json',
            'data/rt-bank-sulaymaniyah.json',
            // Add more files here as you get them:
            // 'data/kurdistan-bank-erbil.json',
            // 'data/kurdistan-bank-dohuk.json',
            // 'data/other-bank-city.json',
        ];

        // Check which files actually exist by trying to fetch them
        const existingFiles = [];
        for (const file of patterns) {
            try {
                const response = await fetch(file, { method: 'HEAD' });
                if (response.ok) {
                    existingFiles.push(file);
                }
            } catch (e) {
                // File doesn't exist, skip it
            }
        }

        return existingFiles;
    }

    parseFilename(filename) {
        // Parse filename like: 'data/rt-bank-erbil.json'
        // Format: data/{bank-name}-{city}.json
        const basename = filename.replace('data/', '').replace('.json', '');
        const parts = basename.split('-');
        
        // Last part is the city
        const city = parts.pop();
        // Everything before is the bank name
        const bank = parts.map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
        
        return { bank, city };
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
            const marker = L.marker([atm.latitude, atm.longitude])
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

    createPopupContent(atm) {
        return `
            <div class="popup-title">${atm.title}</div>
            <span class="popup-type">${atm.type || 'ATM'}</span>
            ${atm.description ? `<div class="popup-description">${atm.description}</div>` : ''}
            <div class="popup-actions">
                <button class="popup-btn primary" onclick="app.navigateToATM('${atm.id}')">
                    Navigate
                </button>
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

        // Modal close
        document.querySelector('.modal-close').addEventListener('click', () => {
            this.closeModal();
        });

        document.getElementById('atmModal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('atmModal')) {
                this.closeModal();
            }
        });

        // Navigate button in modal
        document.getElementById('navigateBtn').addEventListener('click', () => {
            if (this.selectedATM) {
                this.openNavigation(this.selectedATM);
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
            
            let distanceHtml = '';
            if (this.userLocation) {
                const distance = this.calculateDistance(this.userLocation, atm);
                distanceHtml = `<div class="atm-item-distance">${this.formatDistance(distance)}</div>`;
            }

            item.innerHTML = `
                <div class="atm-item-title">${atm.title}</div>
                ${distanceHtml}
                ${atm.description ? `<div class="atm-item-description">${atm.description}</div>` : ''}
            `;

            item.addEventListener('click', () => {
                this.focusOnATM(atm);
            });

            listContent.appendChild(item);
        });
    }

    locateUser() {
        if (!navigator.geolocation) {
            alert('Geolocation is not supported by your browser');
            return;
        }

        document.getElementById('locateBtn').innerHTML = `
            <svg viewBox="0 0 24 24" width="20" height="20" class="spin">
                <path fill="currentColor" d="M12 6v3l4-4-4-4v3c-4.42 0-8 3.58-8 8 0 1.57.46 3.03 1.24 4.26L6.7 14.8c-.45-.83-.7-1.79-.7-2.8 0-3.31 2.69-6 6-6zm6.76 1.74L17.3 9.2c.44.84.7 1.79.7 2.8 0 3.31-2.69 6-6 6v-3l-4 4 4 4v-3c4.42 0 8-3.58 8-8 0-1.57-.46-3.03-1.24-4.26z"/>
            </svg>
            Locating...
        `;

        navigator.geolocation.getCurrentPosition(
            (position) => {
                this.userLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };

                // Remove existing user marker
                if (this.userMarker) {
                    this.map.removeLayer(this.userMarker);
                }

                // Add user location marker
                const icon = L.divIcon({
                    className: 'user-location-marker user-location-pulse',
                    iconSize: [16, 16]
                });

                this.userMarker = L.marker([this.userLocation.lat, this.userLocation.lng], { icon })
                    .addTo(this.map)
                    .bindPopup('Your Location');

                // Center map on user
                this.map.setView([this.userLocation.lat, this.userLocation.lng], 14);

                // Update list with distances
                this.updateList();

                document.getElementById('locateBtn').innerHTML = `
                    <svg viewBox="0 0 24 24" width="20" height="20">
                        <path fill="currentColor" d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3c-.46-4.17-3.77-7.48-7.94-7.94V1h-2v2.06C6.83 3.52 3.52 6.83 3.06 11H1v2h2.06c.46 4.17 3.77 7.48 7.94 7.94V23h2v-2.06c4.17-.46 7.48-3.77 7.94-7.94H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/>
                    </svg>
                    My Location
                `;
            },
            (error) => {
                console.error('Geolocation error:', error);
                alert('Could not get your location. Please check your location permissions.');
                document.getElementById('locateBtn').innerHTML = `
                    <svg viewBox="0 0 24 24" width="20" height="20">
                        <path fill="currentColor" d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3c-.46-4.17-3.77-7.48-7.94-7.94V1h-2v2.06C6.83 3.52 3.52 6.83 3.06 11H1v2h2.06c.46 4.17 3.77 7.48 7.94 7.94V23h2v-2.06c4.17-.46 7.48-3.77 7.94-7.94H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/>
                    </svg>
                    My Location
                `;
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
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

    navigateToATM(atmId) {
        const atm = this.atmData.find(a => a.id === atmId);
        if (atm) {
            this.selectedATM = atm;
            this.showModal(atm);
        }
    }

    showModal(atm) {
        const modal = document.getElementById('atmModal');
        const title = document.getElementById('modalTitle');
        const content = document.getElementById('modalContent');

        title.textContent = atm.title;
        
        let html = '';
        if (atm.type) {
            html += `<div class="modal-info"><strong>Type:</strong> ${atm.type}</div>`;
        }
        if (atm.description) {
            html += `<div class="modal-info"><strong>Location:</strong> ${atm.description}</div>`;
        }
        if (atm.city) {
            html += `<div class="modal-info"><strong>City:</strong> ${atm.city}</div>`;
        }
        if (atm.bank) {
            html += `<div class="modal-info"><strong>Bank:</strong> ${atm.bank}</div>`;
        }
        if (this.userLocation) {
            const distance = this.calculateDistance(this.userLocation, atm);
            html += `<div class="modal-info"><strong>Distance:</strong> ${this.formatDistance(distance)}</div>`;
        }

        content.innerHTML = html;
        modal.classList.add('active');
    }

    closeModal() {
        document.getElementById('atmModal').classList.remove('active');
        this.selectedATM = null;
    }

    openNavigation(atm) {
        const url = `https://www.google.com/maps/dir/?api=1&destination=${atm.latitude},${atm.longitude}`;
        window.open(url, '_blank');
    }
}

// Initialize app
const app = new ATMLocator();