import axios from 'axios';

const API_URL = 'http://localhost:3001';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface User {
  id: number;
  email: string;
  name: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: number;
  title: string;
  description: string | null;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
  userId: number;
}

export const userApi = {
  getAll: () => api.get<User[]>('/users'),
  getById: (id: number) => api.get<User>(`/users/${id}`),
  create: (data: Omit<User, 'id' | 'createdAt' | 'updatedAt'>) => 
    api.post<User>('/users', data),
  update: (id: number, data: Partial<User>) => 
    api.put<User>(`/users/${id}`, data),
  delete: (id: number) => api.delete(`/users/${id}`),
};

export const taskApi = {
  getAll: () => api.get<Task[]>('/tasks'),
  getById: (id: number) => api.get<Task>(`/tasks/${id}`),
  create: (data: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => 
    api.post<Task>('/tasks', data),
  update: (id: number, data: Partial<Task>) => 
    api.put<Task>(`/tasks/${id}`, data),
  delete: (id: number) => api.delete(`/tasks/${id}`),
};

export default api; 