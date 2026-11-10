window.MAGENTA_SUPABASE_URL = 'https://gsmkhrgooanjsfngkgbc.supabase.co';
window.MAGENTA_API_BASE_URL = '';

window.MagentaApi = {
  getSupabaseUrl() {
    return (window.MAGENTA_SUPABASE_URL || '').trim().replace(/\/+$/, '');
  },
  getBaseUrl() {
    return this.getSupabaseUrl() || (window.MAGENTA_API_BASE_URL || '').trim().replace(/\/+$/, '');
  },
  getAdminBaseUrl() {
    try {
      return (localStorage.getItem('magenta_api_url') || this.getBaseUrl()).trim().replace(/\/+$/, '');
    } catch {
      return this.getBaseUrl();
    }
  },
  url(path) {
    const endpoint = this.getSupabaseUrl()
      ? `${this.getBaseUrl()}/functions/v1/inventory`
      : this.getBaseUrl();
    return `${endpoint}${path}`;
  },
  adminUrl(path) {
    const endpoint = this.getSupabaseUrl()
      ? `${this.getAdminBaseUrl()}/functions/v1/inventory`
      : this.getAdminBaseUrl();
    return `${endpoint}${path}`;
  },
  assetUrl(path) {
    return /^https?:\/\//i.test(path) ? path : this.url(path);
  },
  adminAssetUrl(path) {
    return /^https?:\/\//i.test(path) ? path : this.adminUrl(path);
  },
  setAdminBaseUrl(url) {
    localStorage.setItem('magenta_api_url', url);
  }
};
