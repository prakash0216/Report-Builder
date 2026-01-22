// recoil/AuthState.ts
// Simple authentication state for flow purposes (email only)
import { atom } from 'recoil';

const STORAGE_KEY = 'rb_user_email';

// Simple auth state - just email
export interface AuthState {
  isAuthenticated: boolean;
  email: string | null;
}

// Get stored email from localStorage
const getStoredEmail = (): string | null => {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

// Initialize auth state
const storedEmail = getStoredEmail();

// Main auth state atom
export const authState = atom<AuthState>({
  key: 'authState',
  default: {
    isAuthenticated: !!storedEmail,
    email: storedEmail,
  },
});

// Simple auth API
export const authAPI = {
  // Login - just save email
  login(email: string): boolean {
    try {
      localStorage.setItem(STORAGE_KEY, email);
      return true;
    } catch {
      return false;
    }
  },

  // Logout - remove email
  logout(): void {
    localStorage.removeItem(STORAGE_KEY);
  },

  // Check if logged in
  isLoggedIn(): boolean {
    return !!localStorage.getItem(STORAGE_KEY);
  },

  // Get email
  getEmail(): string | null {
    return localStorage.getItem(STORAGE_KEY);
  },
};
