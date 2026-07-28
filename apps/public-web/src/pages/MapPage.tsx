import { TopBar } from '../components/TopBar';
import { Sidebar } from '../components/Sidebar';
import { MapView } from '../components/map/MapView';
import { IncidentDetail } from '../components/IncidentDetail';
import { WidgetPanel } from '../components/widgets/WidgetPanel';
import { TickerBar } from '../components/TickerBar';
import { Footer } from '../components/Footer';
import { useAppStore } from '../store/app-store';

export function MapPage() {
  const selectedId = useAppStore((s) => s.ui.selectedIncidentId);
  const tickerEnabled = useAppStore((s) => s.ticker.enabled);

  return (
    <div className={`app-shell has-footer${tickerEnabled ? ' has-ticker' : ''}`}>
      <TickerBar />
      <TopBar />
      <Sidebar />
      <div className="map-area">
        <div className="information-strip">
          <span className="info-strip-badge">LIVE</span>
          <span className="info-strip-label">AAIT</span>
          <span className="info-strip-status">Real-time monitoring · South Africa</span>
        </div>
        <div className="map-region">
          <MapView />
          <WidgetPanel />
        </div>
      </div>
      <Footer />
      {selectedId && <IncidentDetail />}
    </div>
  );
}
