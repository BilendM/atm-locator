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
    this.markerClusterGroup = null;

    this.init();
  }

  async init() {
    this.registerServiceWorker();
    this.initMap();
    await this.loadData();
    this.setupEventListeners();
    this.setupMobileInteractions();
  }

  registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('service-worker.js')
        .then((registration) => {
          console.log('Service Worker registered:', registration);
        })
        .catch((error) => {
          console.log('Service Worker registration failed:', error);
        });
    }
  }

  initMap() {
    // Initialize map centered on Erbil
    const isMobile =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent,
      );

    this.map = L.map('map', {
      center: [36.1911, 44.0092],
      zoom: 12,
      zoomControl: true,
      attributionControl: true,
      bounceZoom: true,
      // Enable rotation on mobile (two-finger rotate)
      rotate: true,
      rotateControl: true,
    }).setView([33.3128, 44.3615], 6); // Default center (Baghdad)

    // Add zoom control manually
    L.control
      .zoom({
        position: 'bottomright',
      })
      .addTo(this.map);

    // Bank colors for markers
    this.bankColors = {
      'Cihan Bank': '#3498db',
      NBI: '#27ae60',
      'RT Bank': '#e67e22',
      BBAC: '#e74c3c',
      'Islamic Bank': '#9b59b6',
      'Baghdad Bank': '#f39c12',
      'Development Bank': '#1abc9c',
      'Commerce Bank': '#34495e',
    };

    // Map tile providers
    this.mapStyles = {
      dark: {
        url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20,
      },
      light: {
        url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20,
      },
    };

    this.currentTileLayer = null;
    this.setMapStyle('light');

    // Initialize marker cluster group
    this.markerClusterGroup = L.markerClusterGroup({
      chunkedLoading: true,
      maxClusterRadius: 50,
      disableClusteringAtZoom: 16,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
    });
    this.map.addLayer(this.markerClusterGroup);
  }

  setMapStyle(styleKey) {
    if (this.currentTileLayer) {
      this.map.removeLayer(this.currentTileLayer);
    }

    const style = this.mapStyles[styleKey];
    this.currentTileLayer = L.tileLayer(style.url, {
      attribution: style.attribution,
      subdomains: style.subdomains || undefined,
      maxZoom: style.maxZoom,
    }).addTo(this.map);

    this.map.invalidateSize();
  }

  setTheme(isDark) {
    this.isDarkTheme = isDark;

    const themeBtn = document.getElementById('themeToggle');
    const sunIcon = themeBtn.querySelector('.icon-sun');
    const moonIcon = themeBtn.querySelector('.icon-moon');

    if (isDark) {
      document.documentElement.setAttribute('data-theme', 'dark');
      sunIcon.classList.add('hidden');
      moonIcon.classList.remove('hidden');
      this.setMapStyle('dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
      sunIcon.classList.remove('hidden');
      moonIcon.classList.add('hidden');
      this.setMapStyle('light');
    }

    // Save preference
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
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
          console.warn(`Error loading ${file}:`, e);
        }
      }

      this.atmData = loadedData;
      this.filteredData = [...this.atmData];

      console.log('Loaded ATMs:', this.atmData.length);
      console.log('Banks:', [...this.banks]);
      console.log('Cities:', [...this.cities]);

      this.extractCitiesAndBanks();
      this.populateFilters(); // Renamed to populateDropDowns in instruction, but keeping original for now
      this.renderMarkers();
      this.updateStats();
      this.updateList();
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      // Hide loading overlay
      const overlay = document.getElementById('loadingOverlay');
      if (overlay) {
        overlay.classList.add('fade-out');
        setTimeout(() => overlay.remove(), 500);
      }
    }
  }

  async scanDataFiles() {
    // GitHub Pages doesn't support directory listing, list all per-city files
    const patterns = [
      // RT Bank files
      'data/rtb-erbil.json',
      'data/rtb-slemani.json',
      'data/rtb-duhok.json',
      'data/rtb-halabja.json',
      // Cihan Bank files
      'data/cihan-erbil.json',
      'data/cihan-slemani.json',
      'data/cihan-duhok.json',
      'data/cihan-kirkuk.json',
      // 'data/cihan-najaf.json',
      // 'data/cihan-basrah.json',
      // 'data/cihan-baghdad.json',
      // 'data/cihan-mosul.json',
      // NBI files
      'data/nbi-erbil.json',
      'data/nbi-slemani.json',
      'data/nbi-duhok.json',
      // 'data/nbi-mosul.json',
      'data/nbi-kirkuk.json',
      // 'data/nbi-baghdad.json',
      // 'data/nbi-basra.json',
      // 'data/nbi-other.json',
      // BBAC files
      // 'data/bbac-baghdad.json',
      'data/bbac-erbil.json',
      'data/bbac-sulaymaniyah.json',
      // Islamic Bank files
      'data/islamic-erbil.json',
      'data/islamic-slemani.json',
      'data/islamic-duhok.json',
      // Baghdad Bank files
      'data/baghdad-erbil.json',
      'data/baghdad-slemani.json',
      'data/baghdad-duhok.json',
      // Development Bank files
      'data/development-erbil.json',
      'data/development-slemani.json',
      'data/development-duhok.json',
      // Commerce Bank files
      'data/commerce-slemani.json',
      'data/commerce-duhok.json',
    ];

    const existingFiles = [];

    for (const file of patterns) {
      try {
        const response = await fetch(file, { method: 'HEAD' });
        if (response.ok) {
          existingFiles.push(file);
        }
      } catch (err) {}
    }

    return existingFiles;
  }

  parseATMData(data, filename) {
    // Parse filename to get bank and city
    const { bank, city } = this.parseFilename(filename);
    const atms = [];

    if (Array.isArray(data)) {
      data.forEach((item, index) => {
        if (item.latitude && item.longitude) {
          atms.push({
            id: index + 1,
            title: item.title,
            address: item.address?.en || item.title || null,
            latitude: item.latitude,
            longitude: item.longitude,
            city: city,
            bank: bank,
          });
        }
      });
    }

    return atms;
  }

  parseFilename(filename) {
    const basename = filename.replace('data/', '').replace('.json', '');
    const parts = basename.split('-');

    let city = parts.pop();

    const cityMapping = {
      slemani: 'Sulaymaniyah',
      sulaymaniyah: 'Sulaymaniyah',
      duhok: 'Duhok',
      dohuk: 'Duhok',
      erbil: 'Erbil',
      baghdad: 'Baghdad',
      mosul: 'Mosul',
      kirkuk: 'Kirkuk',
      basra: 'Basra',
    };

    city =
      cityMapping[city.toLowerCase()] ||
      city.charAt(0).toUpperCase() + city.slice(1);

    const bank = parts
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    const bankNameMapping = {
      Rtb: 'RT Bank',
      Nbi: 'NBI',
      Bbac: 'BBAC',
      Cihan: 'Cihan Bank',
      Islamic: 'Islamic Bank',
      Baghdad: 'Baghdad Bank',
      Development: 'Development Bank',
      Commerce: 'Commerce Bank',
    };

    return { bank: bankNameMapping[bank] || bank, city };
  }

  extractCitiesAndBanks() {
    this.cities.clear();
    this.banks.clear();

    this.atmData.forEach((atm) => {
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
    Array.from(this.cities)
      .sort()
      .forEach((city) => {
        const option = document.createElement('option');
        option.value = city;
        option.textContent = city;
        citySelect.appendChild(option);
      });

    // Add banks
    Array.from(this.banks)
      .sort()
      .forEach((bank) => {
        const option = document.createElement('option');
        option.value = bank;
        option.textContent = bank;
        bankSelect.appendChild(option);
      });
  }

  renderMarkers() {
    // Clear existing markers from cluster group
    this.markerClusterGroup.clearLayers();
    this.markers = [];

    // Add markers for filtered data
    this.filteredData.forEach((atm) => {
      const color = this.getBankColor(atm.bank);
      const icon = this.createMarkerIcon(color, atm.bank);
      const marker = L.marker([atm.latitude, atm.longitude], {
        icon,
      }).bindPopup(this.createPopupContent(atm));

      marker.atmData = atm;
      this.markers.push(marker);
    });

    // Add to cluster group in bulk
    this.markerClusterGroup.addLayers(this.markers);

    // Fit bounds if we have markers
    if (this.markers.length > 0) {
      const group = new L.featureGroup(this.markers);
      // Ensure we don't zoom in extremely far if there's only 1 marker
      this.map.fitBounds(group.getBounds().pad(0.1), { maxZoom: 15 });
    }
  }

  getBankColor(bank) {
    return this.bankColors[bank] || '#2ecc71';
  }

  createMarkerIcon(color, bankName) {
    // Determine initials
    let initials = 'A'; // Fallback
    if (bankName) {
      const words = bankName.split(' ');
      if (words.length > 1 && bankName !== 'RT Bank') {
        // E.g. CB for Cihan Bank, BB for Baghdad Bank
        initials = words[0][0].toUpperCase() + words[1][0].toUpperCase();
      } else if (bankName === 'RT Bank') {
        initials = 'RT';
      } else {
        initials = bankName.substring(0, 2).toUpperCase();
      }
    }

    return L.divIcon({
      className: 'custom-marker',
      html: `<div style="background-color: ${color};">${initials}</div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
      popupAnchor: [0, -16],
    });
  }

  createPopupContent(atm) {
    const bankInitial = atm.bank ? atm.bank.substring(0, 1).toUpperCase() : 'B';
    const color = this.getBankColor(atm.bank);
    let distanceHtml = '';

    if (this.userLocation) {
      const distance = this.calculateDistance(
        this.userLocation.lat,
        this.userLocation.lng,
        atm.latitude,
        atm.longitude,
      );
      distanceHtml = `<div class="popup-subtitle">${distance.toFixed(1)} km away</div>`;
    }

    return `
      <div class="popup-container">
        <div class="popup-header">
          <div class="popup-icon" style="background-color: ${color};">${bankInitial}</div>
          <div class="popup-title-group">
            <div class="popup-title">${atm.title || atm.bank || 'Location'}</div>
            ${distanceHtml}
            <div class="popup-subtitle">${atm.bank || ''} • ATM</div>
          </div>
        </div>
        <div class="popup-body">
          ${atm.description ? `<p>${atm.description}</p>` : ''}
          <div class="popup-address">
            <strong>City:</strong> ${atm.city || 'Unknown'}<br>
            <strong>Coordinates:</strong> ${atm.latitude.toFixed(4)}, ${atm.longitude.toFixed(4)}
          </div>
        </div>
        <div class="popup-actions">
          <button class="glass-btn primary" onclick="app.getDirections(${atm.latitude}, ${atm.longitude})">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="1 6 1 22 8 18 16 22 21 18 21 2 16 6 8 2 1 6"></polygon><line x1="8" y1="2" x2="8" y2="18"></line><line x1="16" y1="6" x2="16" y2="22"></line></svg>
            Directions
          </button>
        </div>
      </div>
    `;
  }

  setupEventListeners() {
    // Filters
    document.getElementById('cityFilter').addEventListener('change', () => {
      this.filterATMs();
    });

    document.getElementById('bankFilter').addEventListener('change', () => {
      this.filterATMs();
    });

    // Theme toggle
    document.getElementById('themeToggle').addEventListener('click', () => {
      this.setTheme(!this.isDarkTheme);
    });

    // Locate button
    document.getElementById('locateBtn').addEventListener('click', () => {
      this.locateUser();
    });
  }

  setupMobileInteractions() {
    const listPanel = document.getElementById('atmListPanel');
    const toggleFab = document.getElementById('toggleListFab');
    const closeBtn = document.getElementById('closeListBtn');
    const dragHandle = listPanel.querySelector('.drag-handle-container');

    // Initial state for desktop: hide FAB since list is open
    if (window.innerWidth >= 768) {
      toggleFab.classList.add('hidden');
    }

    // Desktop and Mobile common close logic
    closeBtn.addEventListener('click', () => {
      listPanel.classList.remove('open');
      listPanel.classList.add('desktop-closed'); // For desktop hiding
      toggleFab.classList.remove('hidden');
    });

    // Toggle list with FAB
    toggleFab.addEventListener('click', (e) => {
      e.stopPropagation();
      listPanel.classList.add('open');
      listPanel.classList.remove('desktop-closed');
      toggleFab.classList.add('hidden');
    });

    // Simple swipe down to close
    let startY = 0;

    dragHandle.addEventListener('touchstart', (e) => {
      startY = e.touches[0].clientY;
    });

    dragHandle.addEventListener('touchmove', (e) => {
      const currentY = e.touches[0].clientY;
      if (currentY - startY > 40) {
        listPanel.classList.remove('open');
        toggleFab.classList.remove('hidden');
      }
    });
  }

  filterATMs() {
    const selectedCity = document.getElementById('cityFilter').value;
    const selectedBank = document.getElementById('bankFilter').value;

    this.filteredData = this.atmData.filter((atm) => {
      const matchesCity = !selectedCity || atm.city === selectedCity;
      const matchesBank = !selectedBank || atm.bank === selectedBank;

      return matchesCity && matchesBank;
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
    const atmCountEl = document.getElementById('atmCount');

    if (!listContent || !atmCountEl) return;

    atmCountEl.textContent = this.filteredData.length;

    listContent.innerHTML = '';

    // Sort by distance if user location is available
    let sortedData = [...this.filteredData];
    if (this.userLocation) {
      sortedData.sort((a, b) => {
        const distA = this.calculateDistance(
          this.userLocation.lat,
          this.userLocation.lng,
          a.latitude,
          a.longitude,
        );
        const distB = this.calculateDistance(
          this.userLocation.lat,
          this.userLocation.lng,
          b.latitude,
          b.longitude,
        );
        return distA - distB;
      });
    }

    sortedData.forEach((atm) => {
      const item = document.createElement('div');
      item.className = 'atm-item';

      const distance = this.userLocation
        ? this.calculateDistance(
            this.userLocation.lat,
            this.userLocation.lng,
            atm.latitude,
            atm.longitude,
          )
        : Infinity;
      const distanceHtml =
        distance !== Infinity
          ? `<span class="atm-item-dist">${distance.toFixed(1)} km</span>`
          : '';

      const bankInitial = atm.bank
        ? atm.bank.substring(0, 1).toUpperCase()
        : 'B';
      const color = this.getBankColor(atm.bank);

      item.innerHTML = `
            <div class="atm-item-icon" style="background-color: ${color};">${bankInitial}</div>
            <div class="atm-item-info">
                <div class="atm-item-title">${atm.title || atm.bank || 'Location'}</div>
                <div class="atm-item-subtitle">
                    <span class="atm-item-bank">${atm.bank || ''}</span>
                    ${distanceHtml}
                </div>
            </div>
        `;

      item.addEventListener('click', () => {
        // Find corresponding marker
        const marker = this.markers.find((m) => m.atmData.id === atm.id);
        if (marker) {
          this.map.setView([atm.latitude, atm.longitude], 16, {
            animate: true,
          });
          marker.openPopup();

          // Optionally close the list on mobile after selection
          if (window.innerWidth < 768) {
            document.getElementById('atmListPanel').classList.remove('open');
            document.getElementById('toggleListFab').classList.remove('hidden');
          }
        }
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
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  }

  getLocationWithFallback(highAccuracyOptions, fallbackOptions) {
    navigator.geolocation.getCurrentPosition(
      (position) => this.handleLocationSuccess(position),
      (error) => {
        console.warn(
          'High accuracy location failed, trying fallback...',
          error,
        );
        // Try with lower accuracy
        navigator.geolocation.getCurrentPosition(
          (position) => this.handleLocationSuccess(position),
          (error) => this.handleLocationError(error),
          fallbackOptions,
        );
      },
      highAccuracyOptions,
    );
  }

  handleLocationSuccess(position) {
    this.userLocation = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy,
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
      iconAnchor: [8, 8],
    });

    this.userMarker = L.marker([this.userLocation.lat, this.userLocation.lng], {
      icon,
    }).addTo(this.map);

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
            <svg width="45" height="45" viewBox="0 0 45 45" style="transform: rotate(${heading}deg);">
                <defs>
                    <linearGradient id="coneGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" style="stop-color:#3498db;stop-opacity:0.9" />
                        <stop offset="100%" style="stop-color:#3498db;stop-opacity:0.2" />
                    </linearGradient>
                </defs>
                <polygon points="22.5,2 38,43 22.5,35 7,43" fill="url(#coneGradient)" stroke="white" stroke-width="1.5"/>
            </svg>
        `;

    const icon = L.divIcon({
      className: 'heading-marker',
      html: coneSvg,
      iconSize: [45, 45],
      iconAnchor: [22.5, 22.5],
    });

    this.headingMarker = L.marker(
      [this.userLocation.lat, this.userLocation.lng],
      { icon },
    ).addTo(this.map);
  }

  async requestHeadingPermission() {
    if (
      typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission === 'function'
    ) {
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

    switch (error.code) {
      case error.PERMISSION_DENIED:
        errorMessage = 'Location access denied';
        errorDetails =
          'Please enable location permissions in your browser settings. On iOS: Settings → Privacy → Location Services → Safari';
        break;
      case error.POSITION_UNAVAILABLE:
        errorMessage = 'Location unavailable';
        errorDetails =
          'Could not get your location. Please check that location services are enabled and try again.';
        break;
      case error.TIMEOUT:
        errorMessage = 'Location request timed out';
        errorDetails =
          'The request took too long. Please check your connection and try again.';
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
            `;
    } else {
      btn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
            `;
    }
  }

  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  getDirections(lat, lng) {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    window.open(url, '_blank');
  }
}

// Initialize app
const app = new ATMLocator();
