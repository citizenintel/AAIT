import type { RenderingTier } from '@/types/ontology';

const OVERRIDE_KEY = 'rendering-tier-override';

export interface DeviceCapabilities {
  tier: RenderingTier;
  webgpuAvailable: boolean;
  gpuName: string;
  memory: number;
  isMobile: boolean;
}

export function detectRenderingTier(): RenderingTier {
  const override = localStorage.getItem(OVERRIDE_KEY);
  if (override === 'essential' || override === 'enhanced' || override === 'cinematic') {
    return override;
  }

  let score = 0;

  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2');
  if (!gl) return 'essential';

  let gpuName = 'unknown';
  const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
  if (debugInfo) {
    gpuName = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || 'unknown';
  }

  const memory = (navigator as { deviceMemory?: number }).deviceMemory ?? 4;

  const connection = (navigator as { connection?: { effectiveType?: string } }).connection;
  const effectiveType = connection?.effectiveType ?? '4g';
  const isSlow = effectiveType === 'slow-2g' || effectiveType === '2g' || effectiveType === '3g';

  const ua = navigator.userAgent;
  const isMobile = /Android|iPhone|iPad|iPod/i.test(ua);

  const isIntegrated = /Intel|Mali|Adreno|PowerVR|Apple GPU/i.test(gpuName);

  if (memory >= 8) score += 2;
  if (!isMobile) score += 1;
  if (!isSlow) score += 1;
  if (!isIntegrated) score += 2;

  canvas.remove();

  if (score >= 5) return 'cinematic';
  if (score >= 2) return 'enhanced';
  return 'essential';
}

export async function detectWebGPU(): Promise<boolean> {
  if (!('gpu' in navigator)) return false;
  try {
    const adapter = await (navigator as { gpu: { requestAdapter(): Promise<unknown> } }).gpu.requestAdapter();
    return adapter !== null;
  } catch {
    return false;
  }
}

export function getDeviceCapabilities(): DeviceCapabilities {
  const tier = detectRenderingTier();

  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2');
  let gpuName = 'unknown';
  if (gl) {
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (debugInfo) {
      gpuName = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || 'unknown';
    }
  }
  canvas.remove();

  const memory = (navigator as { deviceMemory?: number }).deviceMemory ?? 4;
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  return {
    tier,
    webgpuAvailable: 'gpu' in navigator,
    gpuName,
    memory,
    isMobile,
  };
}

export function setTierOverride(tier: RenderingTier | null): void {
  if (tier) {
    localStorage.setItem(OVERRIDE_KEY, tier);
  } else {
    localStorage.removeItem(OVERRIDE_KEY);
  }
}
