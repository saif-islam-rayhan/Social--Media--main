// types/auth.ts
export interface User {
  id: string;
  email: string;
  username: string;
  fullName: string;
  profilePicture?: string;
  isProfileComplete?:false;
  coverPhoto?: string;
  bio?: string;
  createdAt: string;
  postsCount?: number;
  friendsCount?: number;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignupCredentials {
  email: string;
  password: string;
  username: string;
  fullName: string;
  profilePicture?: string;
  bio?: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}


