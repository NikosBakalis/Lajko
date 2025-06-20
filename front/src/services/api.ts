import axios from 'axios';

const API_URL = 'http://localhost:3001';

// Create axios instance with default config
export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    console.error('Request error:', error);
    return Promise.reject(error);
  }
);

// Add a response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === 'ERR_NETWORK') {
      console.error('Network error - Is the backend server running?');
      console.error('Attempted to connect to:', API_URL);
      console.error('Full error:', error);
      return Promise.reject(new Error(
        'Unable to connect to the server. Please check if the backend is running on port 3001.'
      ));
    }
    
    // Don't redirect on 401 errors, let the components handle it
    if (error.response?.status === 401 && !error.config.url?.includes('/auth/login')) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    
    return Promise.reject(error);
  }
);

export interface User {
  id: number;
  username: string;
  email: string;
  fullName: string;
  role: UserRole;
}

export type UserRole = 'STUDENT' | 'FACULTY' | 'SECRETARY';

export interface CreateUserData {
  username: string;
  password: string;
  email: string;
  fullName: string;
  role: UserRole;
}

export const userApi = {
  getAll: () => api.get<User[]>('/users'),
  getById: (id: number) => api.get<User>(`/users/${id}`),
  create: (data: CreateUserData) => api.post<User>('/users', data),
  bulkCreate: (users: CreateUserData[]) => api.post<{ message: string; data: User[] }>('/users/bulk', users),
  update: (id: number, data: Partial<User>) => api.put<User>(`/users/${id}`, data),
  delete: (id: number) => api.delete(`/users/${id}`),
};

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  token: string;
}

export interface Thesis {
  id: number;
  title: string;
  description: string;
  status: 'OPEN' | 'ASSIGNED' | 'COMPLETED';
  faculty: {
    id: number;
    fullName: string;
    email: string;
  };
  selectedBy: {
    id: number;
    fullName: string;
  }[];
  assignedTo?: {
    id: number;
    fullName: string;
  };
}

export const thesisApi = {
  getAll: () => api.get<Thesis[]>('/theses'),
  create: (thesis: { title: string; description: string }) =>
    api.post<Thesis>('/theses', thesis),
  select: (thesisId: number) =>
    api.post<{ message: string }>(`/theses/${thesisId}/select`),
  assign: (thesisId: number, studentId: number) =>
    api.post<{ message: string }>(`/theses/${thesisId}/assign`, { studentId }),
};

export default api; 