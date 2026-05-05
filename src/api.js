import axios from 'axios';

const deployedApiBaseUrl = 'https://inventrack-api-v2l8.onrender.com';
const localApiBaseUrl = 'http://localhost:5000';

export const apiBaseUrl = process.env.REACT_APP_API_BASE_URL || (process.env.NODE_ENV === 'production' ? deployedApiBaseUrl : localApiBaseUrl);

const api = axios.create({
  baseURL: apiBaseUrl,
  timeout: 10000
});

export default api;
