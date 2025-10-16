// recoil/persistence.ts
import { AtomEffect } from 'recoil';

// Generic localStorage effect for any atom
export const localStorageEffect = <T>(key: string): AtomEffect<T> => ({ setSelf, onSet }) => {
  // Initialize atom value from localStorage on load
  const savedValue = localStorage.getItem(key);
  if (savedValue != null) {
    try {
      setSelf(JSON.parse(savedValue));
    } catch (error) {
      console.error(`Error parsing stored value for ${key}:`, error);
      localStorage.removeItem(key);
    }
  }

  // Subscribe to changes and persist to localStorage
  onSet((newValue, _, isReset) => {
    if (isReset) {
      localStorage.removeItem(key);
    } else {
      try {
        localStorage.setItem(key, JSON.stringify(newValue));
      } catch (error) {
        console.error(`Error storing value for ${key}:`, error);
        if (error instanceof DOMException && error.code === 22) {
          console.warn('localStorage quota exceeded');
        }
      }
    }
  });
};

// Special effect for Set objects (converts to/from array for storage)
export const localStorageSetEffect = <T>(key: string): AtomEffect<Set<T>> => ({ setSelf, onSet }) => {
  // Load from localStorage
  const savedValue = localStorage.getItem(key);
  if (savedValue != null) {
    try {
      const parsed = JSON.parse(savedValue);
      setSelf(new Set(Array.isArray(parsed) ? parsed : []));
    } catch (error) {
      console.error(`Error parsing stored Set for ${key}:`, error);
      localStorage.removeItem(key);
    }
  }

  // Save to localStorage
  onSet((newValue, _, isReset) => {
    if (isReset) {
      localStorage.removeItem(key);
    } else {
      try {
        localStorage.setItem(key, JSON.stringify(Array.from(newValue)));
      } catch (error) {
        console.error(`Error storing Set for ${key}:`, error);
      }
    }
  });
};