import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

// Access token lives only in memory — never in localStorage or a cookie.
let accessToken = null;
export function setAccessToken(token) { accessToken = token; }
export function clearAccessToken()    { accessToken = null; }

// Queue of requests that arrived while a token refresh was in flight.
let isRefreshing = false;
const failedQueue = [];

function processQueue(error) {
  failedQueue.splice(0).forEach((p) => (error ? p.reject(error) : p.resolve(accessToken)));
}

const client = axios.create({ baseURL: BASE_URL, withCredentials: true });

client.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

client.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;

    if (err.response?.status !== 401 || original._retry) {
      return Promise.reject(err);
    }

    // Enqueue callers that arrive while a refresh is already in flight.
    if (isRefreshing) {
      return new Promise((resolve, reject) => failedQueue.push({ resolve, reject }))
        .then(() => { original.headers.Authorization = `Bearer ${accessToken}`; return client(original); });
    }

    original._retry = true;
    isRefreshing = true;

    try {
      // Use a plain axios call to avoid the interceptor re-triggering on the refresh itself.
      const { data } = await axios.post(`${BASE_URL}/auth/refresh`, {}, { withCredentials: true });
      accessToken = data.access_token;
      processQueue(null);
      original.headers.Authorization = `Bearer ${accessToken}`;
      return client(original);
    } catch (refreshErr) {
      accessToken = null;
      processQueue(refreshErr);
      window.dispatchEvent(new Event('auth:logout'));
      return Promise.reject(refreshErr);
    } finally {
      isRefreshing = false;
    }
  },
);

export default client;
