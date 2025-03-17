const isClient = typeof window !== 'undefined';

export const storage = {
  get: (key) => {
    if (!isClient) return null;
    try {
      return localStorage.getItem(key);
    } catch (error) {
      console.error('Error reading from localStorage:', error);
      return null;
    }
  },

  set: (key, value) => {
    if (!isClient) return;
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      console.error('Error writing to localStorage:', error);
    }
  },

  remove: (key) => {
    if (!isClient) return;
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Error removing from localStorage:', error);
    }
  },

  clear: () => {
    if (!isClient) return;
    try {
      localStorage.clear();
    } catch (error) {
      console.error('Error clearing localStorage:', error);
    }
  },

  getJSON: (key) => {
    const value = storage.get(key);
    if (!value) return null;
    try {
      return JSON.parse(value);
    } catch (error) {
      console.error('Error parsing JSON from localStorage:', error);
      return null;
    }
  },

  setJSON: (key, value) => {
    try {
      storage.set(key, JSON.stringify(value));
    } catch (error) {
      console.error('Error stringifying JSON for localStorage:', error);
    }
  }
};

export default storage; 