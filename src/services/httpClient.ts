export const GAME_VERSION = '1.0.0';

export interface AppSettings {
  provider: string;
  baseUrl: string;
  apiKey: string;
  bgProvider: string;
  bgBaseUrl: string;
  bgApiKey: string;
}

export const getSettings = (): AppSettings => {
  try {
    const saved = localStorage.getItem('app_settings');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to load settings', e);
  }
  return {
    provider: 'gemini',
    baseUrl: '',
    apiKey: '',
    bgProvider: 'gemini',
    bgBaseUrl: '',
    bgApiKey: ''
  };
};

export const saveSettings = (settings: AppSettings) => {
  localStorage.setItem('app_settings', JSON.stringify(settings));
};

export const fetchWithRetry = async (url: string, options: RequestInit, retries = 3): Promise<Response> => {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;
    } catch (error) {
      if (i === retries - 1) throw error;
    }
    await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
  }
  throw new Error('Fetch failed after retries');
};

export const customApiFetch = async (endpoint: string, body: any, options?: any) => {
  const settings = getSettings();
  const isBackground = options?.isBackground;
  const baseUrl = isBackground ? settings.bgBaseUrl : settings.baseUrl;
  const apiKey = isBackground ? settings.bgApiKey : settings.apiKey;
  const url = `${baseUrl || 'https://api.openai.com/v1'}${endpoint}`;
  const response = await fetchWithRetry(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(body),
    signal: options?.signal
  });
  return response.json();
};

export const customApiFetchStream = async (endpoint: string, body: any, options?: any) => {
  const settings = getSettings();
  const isBackground = options?.isBackground;
  const baseUrl = isBackground ? settings.bgBaseUrl : settings.baseUrl;
  const apiKey = isBackground ? settings.bgApiKey : settings.apiKey;
  const url = `${baseUrl || 'https://api.openai.com/v1'}${endpoint}`;
  const response = await fetchWithRetry(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({ ...body, stream: true }),
    signal: options?.signal
  });
  return response;
};
