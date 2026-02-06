export const isR2Endpoint = (endpoint: string) => {
  const r2Pattern = /^https:\/\/([a-f0-9]+)\.r2\.cloudflarestorage\.com$/;
  return r2Pattern.test(endpoint);
};

export const extractAccountIdFromEndpoint = (endpoint: string) => {
  const r2Pattern = /^https:\/\/([a-f0-9]+)\.r2\.cloudflarestorage\.com$/;
  const match = endpoint.match(r2Pattern);
  return match ? match[1] : '';
};

export const isCosEndpoint = (endpoint: string) =>
  /cos\.([a-z0-9-]+)\.myqcloud\.com/i.test(endpoint);

export const extractCosRegionFromEndpoint = (endpoint: string) => {
  const match = endpoint.match(/cos\.([a-z0-9-]+)\.myqcloud\.com/i);
  return match ? match[1] : '';
};

export const getCosEndpoint = (region: string) =>
  region ? `https://cos.${region}.myqcloud.com` : '';

export const getStorageTypeFromEndpoint = (endpoint?: string) => {
  if (!endpoint) return 'r2';
  if (isR2Endpoint(endpoint)) return 'r2';
  if (isCosEndpoint(endpoint)) return 'cos';
  return 'custom';
};
