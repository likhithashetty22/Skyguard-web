// cloud/static/js/map-component.js
// ==========================================================================
// SkyGuard AI — Karnataka Map Component
// Initializes Leaflet map focused tightly on Karnataka, India.
// Plots interactive pins for the 5 synthetic AWS stations from JSON.
// ==========================================================================

export class KarnatakaMapComponent {
  constructor(containerId, onStationSelected) {
    this.containerId = containerId;
    this.onStationSelected = onStationSelected;
    this.map = null;
    this.markers = new Map();
    this.activeStationId = null;
  }

  /**
   * Initializes the map with strict Karnataka bounds.
   */
  init() {
    if (this.map) return;

    const container = document.getElementById(this.containerId);
    if (!container) return;

    // Focus tightly on Karnataka: Center ~14.4° N, 75.8° E, Zoom ~7.2
    this.map = L.map(this.containerId, {
      center: [14.2, 75.8],
      zoom: 7.2,
      minZoom: 6.5,
      maxZoom: 13,
      zoomControl: true,
      attributionControl: false
    });

    // Dark Matter high-contrast map tiles
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 18,
      subdomains: 'abcd'
    }).addTo(this.map);

    // Optional Karnataka boundary outline guideline
    const karnatakaBounds = [
      [11.55, 74.05], // South-West
      [18.45, 77.65]  // North-East
    ];
    this.map.fitBounds(karnatakaBounds, { padding: [20, 20] });
  }

  /**
   * Renders the 5 AWS location pins from JSON objects.
   */
  renderStationPins(stations) {
    if (!this.map || !stations) return;

    // Clear existing markers
    this.markers.forEach(marker => marker.remove());
    this.markers.clear();

    stations.forEach(station => {
      const pinIcon = this.createPinIcon(false);
      const marker = L.marker([station.lat, station.lon], {
        icon: pinIcon,
        title: station.name,
        riseOnHover: true
      }).addTo(this.map);

      // Tooltip on hover
      marker.bindTooltip(
        `<div style="font-weight: 600; font-size: 12px;">📍 ${station.name}</div>
         <div style="font-size: 10px; color: #94a3b8;">${station.district || 'Karnataka'} • ${station.lat.toFixed(2)}°N, ${station.lon.toFixed(2)}°E</div>`,
        { direction: 'top', offset: [0, -18], className: 'leaflet-custom-tooltip' }
      );

      // Marker click handler (Triggers Right-Side Dashboard update without page reload!)
      marker.on('click', () => {
        this.setActiveStation(station.id);
        if (typeof this.onStationSelected === 'function') {
          this.onStationSelected(station);
        }
      });

      this.markers.set(station.id.toLowerCase(), marker);
    });
  }

  /**
   * Creates SVG interactive map pin icon.
   */
  createPinIcon(isActive) {
    const activeClass = isActive ? 'active-pin' : '';
    return L.divIcon({
      html: `<div class="custom-pin-marker ${activeClass}">
               <div class="pin-symbol"></div>
             </div>`,
      className: 'leaflet-pin-wrapper',
      iconSize: [32, 32],
      iconAnchor: [16, 30]
    });
  }

  /**
   * Updates visual state of active pin marker.
   */
  setActiveStation(stationId) {
    const key = stationId.toLowerCase();
    this.activeStationId = key;

    this.markers.forEach((marker, id) => {
      const isSelected = (id === key);
      marker.setIcon(this.createPinIcon(isSelected));
      if (isSelected) {
        marker.setZIndexOffset(1000);
      } else {
        marker.setZIndexOffset(0);
      }
    });
  }

  /**
   * Refreshes map container dimensions after route change.
   */
  invalidateSize() {
    if (this.map) {
      setTimeout(() => {
        this.map.invalidateSize();
      }, 150);
    }
  }
}
