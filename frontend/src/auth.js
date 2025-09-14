import axios from 'axios';

const API_URL = "http://localhost:3002";
const TOKEN_KEY = "sb_token";
const USER_KEY = "sb_user";

// Auth utility functions
export const getToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

export const setToken = (token) => {
  localStorage.setItem(TOKEN_KEY, token);
};

export const clearToken = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

export const getUser = () => {
  try {
    const userStr = localStorage.getItem(USER_KEY);
    return userStr ? JSON.parse(userStr) : null;
  } catch {
    return null;
  }
};

export const setUser = (user) => {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const isAuthenticated = () => {
  return !!getToken();
};

// API functions
export const login = async (userData) => {
  try {
    const response = await axios.post(`${API_URL}/api/auth/login`, userData);
    
    if (response.data.success) {
      setToken(response.data.token);
      setUser(response.data.user);
      return response.data;
    } else {
      throw new Error(response.data.error || 'Login failed');
    }
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
};

export const logout = async () => {
  try {
    const token = getToken();
    if (token) {
      await axios.post(`${API_URL}/api/auth/logout`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
    }
  } catch (error) {
    console.error('Logout error:', error);
  } finally {
    clearToken();
  }
};

export const verifyToken = async () => {
  try {
    const token = getToken();
    if (!token) return null;

    const response = await axios.post(`${API_URL}/api/auth/verify`, { token });
    
    if (response.data.success && response.data.valid) {
      setUser(response.data.user);
      return response.data.user;
    } else {
      clearToken();
      return null;
    }
  } catch (error) {
    console.error('Token verification error:', error);
    clearToken();
    return null;
  }
};

export const getAuthHeaders = () => {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// Axios interceptor to automatically add auth headers
axios.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Axios interceptor to handle auth errors
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || error.response?.data?.code === 'INVALID_TOKEN') {
      clearToken();
      // Redirect to login if not already there
      if (window.location.hash !== '#login') {
        window.location.hash = 'login';
      }
    }
    return Promise.reject(error);
  }
);

export default {
  getToken,
  setToken,
  clearToken,
  getUser,
  setUser,
  isAuthenticated,
  login,
  logout,
  verifyToken,
  getAuthHeaders
};
