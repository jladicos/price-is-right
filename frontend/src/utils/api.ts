// API client for communicating with the backend

// Base API URL - defaults to localhost:3001 in development
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Type definitions for API requests/responses
export interface Player {
  id: number;
  firstName: string;
  lastName: string;
  accessCode: string;
  role: 'host' | 'player' | 'audience';
  email: string | null;
  photoFilename: string;
  active: boolean;
  sessionToken: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LoginRequest {
  accessCode: string;
}

export interface LoginResponse {
  sessionToken: string;
  player: Player;
}

export interface SessionResponse {
  player: Player;
}

export interface ErrorResponse {
  error: string;
  message?: string;
}

// Callback for handling session expiration
let onSessionExpired: (() => void) | null = null;

export function setSessionExpiredHandler(handler: () => void) {
  onSessionExpired = handler;
}

// Get the current session token from a callback
let getSessionToken: (() => string | null) | null = null;

export function setSessionTokenGetter(getter: () => string | null) {
  getSessionToken = getter;
}

// Base fetch wrapper with auth header injection and error handling
async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  // Add authorization header if session token is available
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (getSessionToken) {
    const token = getSessionToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  // Handle 401 Unauthorized - session expired or invalid
  if (response.status === 401) {
    if (onSessionExpired) {
      onSessionExpired();
    }
    const errorData = (await response.json()) as ErrorResponse;
    throw new Error(errorData.message || errorData.error || 'Unauthorized');
  }

  // Handle other error responses
  if (!response.ok) {
    const errorData = (await response.json()) as ErrorResponse;
    throw new Error(errorData.message || errorData.error || 'Request failed');
  }

  return response.json() as Promise<T>;
}

// Export apiRequest as an alias to apiFetch for compatibility with components
export const apiRequest = apiFetch;

// Auth API endpoints

export async function login(accessCode: string): Promise<LoginResponse> {
  return apiFetch<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ accessCode }),
  });
}

export async function logout(): Promise<void> {
  await apiFetch<void>('/api/auth/logout', {
    method: 'POST',
  });
}

export async function validateSession(): Promise<SessionResponse> {
  return apiFetch<SessionResponse>('/api/auth/session', {
    method: 'GET',
  });
}

// Players API endpoints

export interface GetPlayersResponse {
  players: Player[];
}

export async function getPlayers(): Promise<GetPlayersResponse> {
  return apiFetch<GetPlayersResponse>('/api/players', {
    method: 'GET',
  });
}

export interface GetPlayerResponse {
  player: Player;
}

export async function getPlayer(id: number): Promise<GetPlayerResponse> {
  return apiFetch<GetPlayerResponse>(`/api/players/${id}`, {
    method: 'GET',
  });
}
