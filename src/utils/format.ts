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
  const protocol = window.location.protocol;
  let host = window.location.host;
  // Convert internal dev URL (ais-dev-) to public shareable URL (ais-pre-)
  if (host.startsWith('ais-dev-')) {
    host = host.replace(/^ais-dev-/, 'ais-pre-');
  }
  return `${protocol}//${host}`;
}

