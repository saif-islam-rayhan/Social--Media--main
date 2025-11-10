// contexts/AuthContext.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { AuthState, LoginCredentials, SignupCredentials, User } from '../types/auth';

interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>;
  signup: (credentials: SignupCredentials) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (userData: Partial<User>) => Promise<void>;
  getAuthHeaders: () => Promise<HeadersInit>; // Add this line
  searchUsers: (query: string) => Promise<User[]>; // Add this
  getSuggestedUsers: () => Promise<User[]>; // Add this
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Storage keys
const AUTH_TOKEN_KEY = 'authToken';
const USER_DATA_KEY = 'userData';

// API Base URL
const API_BASE_URL = 'http://localhost:3000';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });

  // Check for existing session on app start
  useEffect(() => {
    checkExistingAuth();
  }, []);

  const checkExistingAuth = async () => {
    try {
      console.log('🔍 Checking existing auth...');
      const [token, userData] = await Promise.all([
        AsyncStorage.getItem(AUTH_TOKEN_KEY),
        AsyncStorage.getItem(USER_DATA_KEY),
      ]);
      
      console.log('📱 Storage check - Token:', !!token, 'UserData:', !!userData);
      
      if (token && userData) {
        const user = JSON.parse(userData);
        console.log('✅ User found:', user.email);
        
        // Verify token is still valid with backend
        try {
          const response = await fetch(`${API_BASE_URL}/profile`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });

          if (response.ok) {
            const profileData = await response.json();
            setAuthState({
              user: profileData.user,
              isAuthenticated: true,
              isLoading: false,
            });
          } else {
            // Token invalid, clear storage
            await clearStorage();
            setAuthState(prev => ({ ...prev, isLoading: false }));
          }
        } catch (error) {
          console.error('❌ Token validation failed:', error);
          await clearStorage();
          setAuthState(prev => ({ ...prev, isLoading: false }));
        }
      } else {
        console.log('❌ No user found in storage');
        setAuthState(prev => ({ ...prev, isLoading: false }));
      }
    } catch (error) {
      console.error('❌ Error checking auth:', error);
      setAuthState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const clearStorage = async () => {
    await Promise.all([
      AsyncStorage.removeItem(AUTH_TOKEN_KEY),
      AsyncStorage.removeItem(USER_DATA_KEY),
    ]);
  };

  // Add this function inside AuthProvider
// In AuthContext.tsx
const getAuthHeaders = async (): Promise<Record<string, string>> => {
  try {
    // Get token from your storage (adjust based on your storage method)
    const token = await AsyncStorage.getItem('authToken'); // or your token storage
    
    console.log("Retrieved token:", token ? `${token.substring(0, 20)}...` : "No token found");
    
    if (!token) {
      throw new Error('No authentication token found');
    }
    
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  } catch (error) {
    console.error('Error getting auth headers:', error);
    throw new Error('Authentication failed - Please login again');
  }
};

// Add these functions inside AuthProvider
const searchUsers = async (query: string): Promise<User[]> => {
  try {
    if (!query.trim()) {
      return [];
    }

    const headers = await getAuthHeaders();
    
    const response = await fetch(`${API_BASE_URL}/users/search?q=${encodeURIComponent(query)}`, {
      method: 'GET',
      headers: headers as HeadersInit,
    });

    const data = await response.json();

    if (response.ok && data.success) {
      return data.users.map((user: any) => ({
        id: user._id || user.id,
        email: user.email,
        username: user.username || `@${user.name?.toLowerCase().replace(/\s+/g, '_')}`,
        fullName: user.name || user.fullName,
        profilePicture: user.profilePicture,
        bio: user.bio,
        createdAt: user.createdAt,
      }));
    } else {
      throw new Error(data.message || 'Failed to search users');
    }
  } catch (error) {
    console.error('Error searching users:', error);
    throw error;
  }
};

const getSuggestedUsers = async (): Promise<User[]> => {
  try {
    const headers = await getAuthHeaders();
    
    const response = await fetch(`${API_BASE_URL}/users/suggested`, {
      method: 'GET',
      headers: headers as HeadersInit,
    });

    const data = await response.json();

    if (response.ok && data.success) {
      return data.users.map((user: any) => ({
        id: user._id || user.id,
        email: user.email,
        username: user.username || `@${user.name?.toLowerCase().replace(/\s+/g, '_')}`,
        fullName: user.name || user.fullName,
        profilePicture: user.profilePicture,
        bio: user.bio,
        createdAt: user.createdAt,
      }));
    } else {
      throw new Error(data.message || 'Failed to get suggested users');
    }
  } catch (error) {
    console.error('Error getting suggested users:', error);
    throw error;
  }
};

 const signup = async (credentials: SignupCredentials) => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true }));

      console.log('📤 Sending signup request...', credentials);

      const response = await fetch(`${API_BASE_URL}/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: credentials.fullName,
          email: credentials.email,
          password: credentials.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Signup failed');
      }

      console.log('✅ Signup successful:', data);

      const user: User = {
        id: data.user.id,
        email: data.user.email,
        username: data.user.name.toLowerCase().replace(/\s+/g, '_'),
        fullName: data.user.name,
        createdAt: data.user.createdAt,
      };

      // Store in AsyncStorage
      await Promise.all([
        AsyncStorage.setItem(AUTH_TOKEN_KEY, data.token),
        AsyncStorage.setItem(USER_DATA_KEY, JSON.stringify(user)),
      ]);

      setAuthState({
        user,
        isAuthenticated: true,
        isLoading: false,
      });

      console.log('✅ User registered and logged in');

    } catch (error) {
      console.error('❌ Signup error:', error);
      setAuthState(prev => ({ ...prev, isLoading: false }));
      throw error;
    }
  };

  const login = async (credentials: LoginCredentials) => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true }));

      console.log('📤 Sending login request...', credentials);

      const response = await fetch(`${API_BASE_URL}/signin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: credentials.email,
          password: credentials.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }

      console.log('✅ Login successful:', data);

      const user: User = {
        id: data.user.id,
        email: data.user.email,
        username: data.user.name.toLowerCase().replace(/\s+/g, '_'),
        fullName: data.user.name,
        profilePicture: data.user.profilePicture,
        bio: data.user.bio,
        createdAt: data.user.createdAt,
      };

      // Store in AsyncStorage
      await Promise.all([
        AsyncStorage.setItem(AUTH_TOKEN_KEY, data.token),
        AsyncStorage.setItem(USER_DATA_KEY, JSON.stringify(user)),
      ]);

      setAuthState({
        user,
        isAuthenticated: true,
        isLoading: false,
      });

      console.log('✅ User logged in and data stored');

    } catch (error) {
      console.error('❌ Login error:', error);
      setAuthState(prev => ({ ...prev, isLoading: false }));
      throw error;
    }
  };

  const logout = async () => {
    try {
      console.log('🚪 Starting logout process...');
      
      const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      
      if (token) {
        // Call backend logout endpoint
        try {
          await fetch(`${API_BASE_URL}/logout`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });
        } catch (error) {
          console.warn('⚠️ Backend logout failed, continuing with client logout:', error);
        }
      }
      
      // Clear storage
      await clearStorage();
      
      console.log('✅ Storage cleared, updating auth state...');
      
      // Update state
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });
      
      console.log('✅ Auth state updated to logged out');
    } catch (error) {
      console.error('❌ Logout error:', error);
      throw error;
    }
  };

  const updateUser = async (userData: Partial<User>) => {
    if (authState.user) {
      const updatedUser = { ...authState.user, ...userData };
      setAuthState(prev => ({ ...prev, user: updatedUser }));
      await AsyncStorage.setItem(USER_DATA_KEY, JSON.stringify(updatedUser));
    }
  };

  console.log('🔄 AuthProvider render - isAuthenticated:', authState.isAuthenticated, 'isLoading:', authState.isLoading);

  return (
    <AuthContext.Provider value={{
      ...authState,
      login,
      signup,
      logout,
      updateUser,
      getAuthHeaders, 
        searchUsers, // Add this
    getSuggestedUsers, 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Optional: Also keep the standalone export if you want both options
// export const authAPI = {
//   getAuthHeaders: async (): Promise<HeadersInit> => {
//     const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
//     return {
//       'Authorization': `Bearer ${token}`,
//       'Content-Type': 'application/json',
//     };
//   },
// };