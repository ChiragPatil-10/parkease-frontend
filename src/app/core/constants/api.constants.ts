export const API_BASE_URL = 'http://localhost:5000';

export const AUTH_API = {
  login: `${API_BASE_URL}/api/v1/auth/login`,
  registerDriver: `${API_BASE_URL}/api/v1/auth/register/driver`,
} as const;
