import { useAppStore } from '@/stores/app-store';
import { Sidebar } from '@/components/Sidebar';
import { ManagedContentSlot } from '@/components/widgets/ManagedContentSlot';
import type { ReactNode } from 'react';

interface LeftRailProps {
  glanceContent: ReactNode;
}

export function LeftRail({ glanceContent }: LeftRailProps) {
  const interfaceLevel = useAppStore((s) => s.interfaceLevel);
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const showLayers = sidebarOpen && interfaceLevel === 'glance';

  return (
    <div className="left-rail" data-view={showLayers ? 'layers' : interfaceLevel}>
      <div className="left-rail-content">
        {showLayers ? (
          <Sidebar />
        ) : (
          glanceContent
        )}
      </div>
      <div className="left-rail-ad">
        <ManagedContentSlot slotKey="LEFT_RAIL_HALF_PAGE" />
      </div>
    </div>
  );
}
