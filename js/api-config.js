window.MAGENTA_SUPABASE_URL = 'https://gsmkhrgooanjsfngkgbc.supabase.co';
window.MAGENTA_API_BASE_URL = '';

window.MagentaApi = {
  getSupabaseUrl() {
    return (window.MAGENTA_SUPABASE_URL || '').trim().replace(/\/+$/, '');
  },
  getBaseUrl() {
    const configuredApiUrl = (window.MAGENTA_API_BASE_URL || '').trim().replace(/\/+$/, '');
    if (configuredApiUrl) return configuredApiUrl;
    if (['localhost', '127.0.0.1'].includes(window.location.hostname)) return '';
    return this.getSupabaseUrl();
  },
  endpoint(baseUrl) {
    return baseUrl && baseUrl === this.getSupabaseUrl()
      ? `${baseUrl}/functions/v1/inventory`
      : baseUrl;
  },
  getAdminBaseUrl() {
    try {
      return (localStorage.getItem('magenta_api_url') || this.getBaseUrl()).trim().replace(/\/+$/, '');
    } catch {
      return this.getBaseUrl();
    }
  },
  url(path) {
    return `${this.endpoint(this.getBaseUrl())}${path}`;
  },
  adminUrl(path) {
    return `${this.endpoint(this.getAdminBaseUrl())}${path}`;
  },
  assetUrl(path) {
    return /^https?:\/\//i.test(path) ? path : `${this.endpoint(this.getBaseUrl())}${path}`;
  },
  adminAssetUrl(path) {
    return /^https?:\/\//i.test(path) ? path : `${this.endpoint(this.getAdminBaseUrl())}${path}`;
  },
  setAdminBaseUrl(url) {
    localStorage.setItem('magenta_api_url', url);
  }
};
