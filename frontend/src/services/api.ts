import axios from 'axios';

const API_BASE_URL = '/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach bearer token if available in localStorage
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('sovereign_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor to handle token expiration
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !window.location.pathname.includes('/login')) {
      // Clear token and prompt login
      localStorage.removeItem('sovereign_token');
      localStorage.removeItem('sovereign_user');
    }
    return Promise.reject(error);
  }
);
