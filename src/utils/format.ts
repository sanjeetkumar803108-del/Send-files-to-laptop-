export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec <= 0) return '0 KB/s';
  return `${formatBytes(bytesPerSec)}/s`;
}

export function formatEta(seconds: number): string {
  if (!isFinite(seconds) || seconds <= 0) return '--';
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.ceil(seconds % 60);
  return `${mins}m ${secs}s`;
}

export function generateRoomId(): string {
  // 6 digit clean numerical code for easy typing
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function generatePeerId(): string {
  return 'peer_' + Math.random().toString(36).substring(2, 9);
}

export function detectDeviceType(): 'mobile' | 'laptop' {
  if (typeof window === 'undefined') return 'laptop';
  const ua = navigator.userAgent.toLowerCase();
  const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua) || window.innerWidth < 768;
  return isMobile ? 'mobile' : 'laptop';
}

export function getDefaultDeviceName(type: 'mobile' | 'laptop'): string {
  if (typeof window === 'undefined') return 'My Device';
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return 'Android Phone';
  if (/iPhone/i.test(ua)) return 'iPhone';
  if (/iPad/i.test(ua)) return 'iPad';
  if (/Mac/i.test(ua)) return 'MacBook / Mac';
  if (/Windows/i.test(ua)) return 'Windows PC';
  if (/Linux/i.test(ua)) return 'Linux Laptop';
  return type === 'mobile' ? 'Mobile' : 'Laptop';
}

export function getPublicAppUrl(): string {
  if (typeof window === 'undefined') return '';
  const customAppUrl = (import.meta.env.VITE_APP_URL as string | undefined)?.trim();
  if (customAppUrl) {
    return customAppUrl.replace(/\/$/, '');
  }
  const protocol = window.location.protocol;
  let host = window.location.host;
  // Convert internal dev URL (ais-dev-) to public shareable URL (ais-pre-)
  if (host.startsWith('ais-dev-')) {
    host = host.replace(/^ais-dev-/, 'ais-pre-');
  }
  return `${protocol}//${host}`;
}

export function isNativePlatform(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  const protocol = window.location.protocol;
  return host === 'localhost' || host === '127.0.0.1' || protocol === 'capacitor:' || protocol === 'ionic:';
}

export function resolveSignalingUrl(overrideUrl?: string): string {
  if (overrideUrl?.trim()) {
    const trimmed = overrideUrl.trim();
    if (trimmed.includes('vercel.app')) {
      return '';
    }
    return trimmed;
  }
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('hotspot_drop_signaling_url')?.trim();
    if (saved) {
      if (saved.includes('vercel.app')) {
        localStorage.removeItem('hotspot_drop_signaling_url');
      } else {
        return saved;
      }
    }

    const params = new URLSearchParams(window.location.search);
    const sigParam = params.get('sig') || params.get('server');
    if (sigParam?.trim()) {
      const trimmedSig = sigParam.trim();
      if (!trimmedSig.includes('vercel.app')) {
        return trimmedSig;
      }
    }
  }

  const envWs = (import.meta.env.VITE_SIGNALING_URL as string | undefined)?.trim();
  if (envWs && !envWs.includes('vercel.app')) return envWs;

  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    // ONLY when running locally on laptop with the Vite dev server (Node setupSignalingServer):
    const isDevServer = (host === 'localhost' || host === '127.0.0.1') && !isNativePlatform();
    if (isDevServer) {
      const port = window.location.port ? `:${window.location.port}` : '';
      return `ws://${host}${port}/ws`;
    }
    // On Vercel, Netlify, Cloudflare, or native Android Capacitor APK:
    // ALWAYS return '' to use zero-config Cloud Relay!
    return '';
  }
  return '';
}
