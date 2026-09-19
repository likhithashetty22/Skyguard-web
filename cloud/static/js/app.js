// cloud/static/js/app.js
// ==========================================================================
// SkyGuard AI — Core Application & Routing Controller
// Manages Welcome Screen (1.png), Sidebar (2.png), Maps 50/50 View (3.png - 5.png),
// and internal application view transitions without page reloads.
// ==========================================================================

import { AWSDataLoader } from './data-loader.js';
import { KarnatakaMapComponent } from './map-component.js';
import { StationViewManager } from './station-view.js';

class SkyGuardApp {
  constructor() {
    this.currentView = 'welcome'; // 'welcome' or 'maps'
    this.dataLoader = new AWSDataLoader();
    this.mapComponent = null;
    this.stationView = null;
    this.stationsList = [];
    this.selectedStation = null;
  }

  async init() {
    this.bindDOMReferences();
    this.initStationView();
    this.initMap();
    this.bindEvents();
    this.handleInitialRoute();

    // Preload synthetic AWS stations from JSON
    await this.loadStationData();
  }

  bindDOMReferences() {
    // Header & Sidebar elements
    this.btnSidebarToggle = document.getElementById('btn-sidebar-toggle');
    this.sidebarEl = document.getElementById('app-sidebar');
    this.sidebarOverlay = document.getElementById('sidebar-overlay');
    this.logoHomeEl = document.getElementById('logo-home');

    // Sidebar navigation buttons
    this.btnNavMaps = document.getElementById('btn-nav-maps');
    this.btnNavAnomaly = document.getElementById('btn-nav-anomaly');

    // View containers
    this.viewWelcome = document.getElementById('view-welcome');
    this.viewMaps = document.getElementById('view-maps');
    this.btnCtaEnterMaps = document.getElementById('btn-cta-enter-maps');

    // Right-side dashboard elements
    this.rightEmptyState = document.getElementById('right-empty-state');
    this.stationCard = document.getElementById('station-data-card');
    this.diagnosisCard = document.getElementById('anomaly-diagnosis-card');
    this.stationTitle = document.getElementById('station-title');
    this.stationCoords = document.getElementById('station-coords');
    this.tableBody = document.getElementById('telemetry-table-body');
    this.diagnosisTableBody = document.getElementById('diagnosis-table-body');
    this.diagnosisTitle = document.getElementById('diagnosis-title');
    this.btnCloseDiagnosis = document.getElementById('btn-close-diagnosis');
  }

  initStationView() {
    this.stationView = new StationViewManager({
      emptyStateEl: this.rightEmptyState,
      stationCardEl: this.stationCard,
      diagnosisCardEl: this.diagnosisCard,
      stationTitleEl: this.stationTitle,
      stationCoordsEl: this.stationCoords,
      tableBodyEl: this.tableBody,
      diagnosisTableBodyEl: this.diagnosisTableBody,
      diagnosisTitleEl: this.diagnosisTitle,
      btnCloseDiagnosis: this.btnCloseDiagnosis
    });
  }

  initMap() {
    this.mapComponent = new KarnatakaMapComponent('karnataka-map', (station) => {
      this.handleStationSelected(station);
    });
    this.mapComponent.init();
  }

  async loadStationData() {
    try {
      this.stationsList = await this.dataLoader.loadStations();
      if (this.mapComponent) {
        this.mapComponent.renderStationPins(this.stationsList);
      }
    } catch (err) {
      console.error('[SkyGuard App] Failed to load AWS stations JSON:', err);
    }
  }

  bindEvents() {
    // 1. Sidebar Toggle button [□] (1.png & 2.png)
    if (this.btnSidebarToggle) {
      this.btnSidebarToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleSidebar();
      });
    }

    // Close sidebar on overlay click
    if (this.sidebarOverlay) {
      this.sidebarOverlay.addEventListener('click', () => {
        this.closeSidebar();
      });
    }

    // Close sidebar with ESC key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeSidebar();
      }
    });

    // 2. Sidebar -> Maps Navigation (2.png -> 3.png)
    if (this.btnNavMaps) {
      this.btnNavMaps.addEventListener('click', () => {
        this.navigateTo('maps');
        this.closeSidebar();
      });
    }

    // 3. Sidebar -> Anomaly Button (Explicitly Disabled per prompt requirements)
    if (this.btnNavAnomaly) {
      this.btnNavAnomaly.addEventListener('click', (e) => {
        e.preventDefault();
        // Do not perform any action (disabled)
        return false;
      });
    }

    // 4. Logo click returns to Welcome
    if (this.logoHomeEl) {
      this.logoHomeEl.addEventListener('click', () => {
        this.navigateTo('welcome');
      });
    }

    // 5. Welcome Screen Call-to-Action button
    if (this.btnCtaEnterMaps) {
      this.btnCtaEnterMaps.addEventListener('click', () => {
        this.navigateTo('maps');
      });
    }

    // 6. Listen for browser popstate / hash change
    window.addEventListener('popstate', () => {
      this.handleInitialRoute();
    });
  }

  toggleSidebar() {
    if (!this.sidebarEl) return;
    const isOpen = this.sidebarEl.classList.contains('open');
    if (isOpen) {
      this.closeSidebar();
    } else {
      this.openSidebar();
    }
  }

  openSidebar() {
    if (this.sidebarEl) this.sidebarEl.classList.add('open');
    if (this.sidebarOverlay) this.sidebarOverlay.classList.add('active');
  }

  closeSidebar() {
    if (this.sidebarEl) this.sidebarEl.classList.remove('open');
    if (this.sidebarOverlay) this.sidebarOverlay.classList.remove('active');
  }

  /**
   * Internal application navigation (SPA view transition).
   * Does NOT reload page, does NOT open new tab, does NOT leave application!
   */
  navigateTo(viewName) {
    if (this.currentView === viewName) return;

    this.currentView = viewName;

    if (viewName === 'maps') {
      history.pushState({ view: 'maps' }, 'SkyGuard AI — Maps', '#maps');
      this.showMapsView();
    } else {
      history.pushState({ view: 'welcome' }, 'SkyGuard AI — Welcome', '#');
      this.showWelcomeView();
    }
  }

  showWelcomeView() {
    if (this.viewWelcome) this.viewWelcome.classList.add('active-view');
    if (this.viewMaps) this.viewMaps.classList.remove('active-view');
    if (this.btnNavMaps) this.btnNavMaps.classList.remove('active');
  }

  showMapsView() {
    if (this.viewWelcome) this.viewWelcome.classList.remove('active-view');
    if (this.viewMaps) this.viewMaps.classList.add('active-view');
    if (this.btnNavMaps) this.btnNavMaps.classList.add('active');

    // Invalidate Leaflet map size to ensure tiles render immediately
    if (this.mapComponent) {
      this.mapComponent.invalidateSize();
    }
  }

  handleInitialRoute() {
    const hash = window.location.hash.toLowerCase();
    const pathname = window.location.pathname.toLowerCase();

    if (hash === '#maps' || pathname.endsWith('/maps')) {
      this.showMapsView();
      this.currentView = 'maps';
    } else {
      this.showWelcomeView();
      this.currentView = 'welcome';
    }
  }

  /**
   * When an AWS pin is clicked on the Karnataka map (4.png & 5.png):
   */
  async handleStationSelected(station) {
    this.selectedStation = station;

    // Load temporal dataset for this station
    const temporalData = await this.dataLoader.loadStationTemporalData(station.id);

    // Render Section 1 (Temporal Table) and prepare Section 2
    if (this.stationView) {
      this.stationView.renderStationData(station, temporalData);
    }
  }
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
  const app = new SkyGuardApp();
  app.init();
});
