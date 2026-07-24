import { useEffect } from 'react';
import { useAppStore } from '@/stores/app-store';
import type { Alert } from '@/types/ontology';

const PATTERNS: Record<string, number[]> = {
  critical: [200, 100, 200, 100, 200],
  high: [150, 100, 150],
  medium: [100],
  low: [50],
  escalation: [50, 50, 100, 50, 150, 50, 200],
  first_occurrence: [80, 80, 80],
};

function supportsVibration(): boolean {
  return 'vibrate' in navigator;
}

function isHapticsDisabled(): boolean {
  return localStorage.getItem('haptics-disabled') === 'true';
}

export function setHapticsEnabled(enabled: boolean): void {
  localStorage.setItem('haptics-disabled', enabled ? 'false' : 'true');
}

export function triggerHaptic(severity: string): void {
  if (!supportsVibration() || isHapticsDisabled()) return;
  const pattern = PATTERNS[severity] ?? PATTERNS.medium!;
  navigator.vibrate(pattern!);
}

function shouldVibrate(alert: Alert): boolean {
  if (!supportsVibration() || isHapticsDisabled()) return false;
  if (alert.severity === 'critical') return true;
  return document.hidden;
}

export function useHapticAlerts(): void {
  const alerts = useAppStore((s) => s.alerts);

  useEffect(() => {
    if (alerts.length === 0) return;

    const latest = alerts[0];
    if (!latest || latest.acknowledged) return;

    if (shouldVibrate(latest)) {
      const pattern = latest.hapticPattern ?? PATTERNS[latest.severity] ?? [100];
      navigator.vibrate(pattern);
    }
  }, [alerts]);
}
