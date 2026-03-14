import { ApiSettings } from '../types';

export const GAME_VERSION = '1.0.0';

export const getSettings = (): ApiSettings => {
  try {
    const saved = localStorage.getItem('api_settings');
    if (saved) return JSON.parse(saved);
  } catch (e) {}
  return { provider: 'default' };
};

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export const fetchWithRetry = async (
  url: string,
  options: RequestInit,
  retries: number = 2,
  backoff: number = 1000
): Promise<Response> => {
  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      throw new ApiError(response.status, `HTTP Error ${response.status}: ${response.statusText}`);
    }
    return response;
  } catch (error) {
    if (retries > 0) {
      console.warn(`Fetch failed, retrying in ${backoff}ms... (${retries} retries left)`, error);
      await new Promise(resolve => setTimeout(resolve, backoff));
      return fetchWithRetry(url, options, retries - 1, backoff * 2);
    }
    throw error;
  }
};

export const customApiFetch = async (
  endpoint: string,
  body: any,
  options: { isBackground?: boolean } = {}
): Promise<any> => {
  const settings = getSettings();
  const provider = options.isBackground ? (settings.bgProvider || settings.provider) : settings.provider;
  const baseUrl = options.isBackground ? (settings.bgBaseUrl || settings.baseUrl) : settings.baseUrl;
  const apiKey = options.isBackground ? (settings.bgApiKey || settings.apiKey) : settings.apiKey;
  const model = options.isBackground ? (settings.bgModel || settings.model) : settings.model;

  if (provider !== 'custom' || !baseUrl || !apiKey) {
    throw new Error('Custom API provider is not configured properly.');
  }

  const url = `${baseUrl.replace(/\/$/, '')}${endpoint}`;
  
  const payload = {
    model: model || 'gpt-3.5-turbo',
    ...body
  };

  const response = await fetchWithRetry(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload)
  });

  return response.json();
};

export const customApiFetchStream = async (
  endpoint: string,
  body: any,
  options: { isBackground?: boolean } = {}
): Promise<Response> => {
  const settings = getSettings();
  const provider = options.isBackground ? (settings.bgProvider || settings.provider) : settings.provider;
  const baseUrl = options.isBackground ? (settings.bgBaseUrl || settings.baseUrl) : settings.baseUrl;
  const apiKey = options.isBackground ? (settings.bgApiKey || settings.apiKey) : settings.apiKey;
  const model = options.isBackground ? (settings.bgModel || settings.model) : settings.model;

  if (provider !== 'custom' || !baseUrl || !apiKey) {
    throw new Error('Custom API provider is not configured properly.');
  }

  const url = `${baseUrl.replace(/\/$/, '')}${endpoint}`;
  
  const payload = {
    model: model || 'gpt-3.5-turbo',
    ...body
  };

  // Do not retry streams automatically to avoid confusing the user with delayed responses
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new ApiError(response.status, `HTTP Error ${response.status}: ${response.statusText}`);
  }

  return response;
};
