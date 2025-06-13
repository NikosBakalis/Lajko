export type UserRole = 'STUDENT' | 'PROFESSOR' | 'SECRETARY';

export interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}

export interface Task {
  id: number;
  title: string;
  description: string;
  completed: boolean;
  userId: number;
  createdAt: string;
  updatedAt: string;
}

export interface Thesis {
  id: number;
  title: string;
  description: string;
  status: 'OPEN' | 'SELECTED' | 'ASSIGNED' | 'COMPLETED';
  assignedToId?: number;
  selectedBy: User[];
  createdAt: string;
  updatedAt: string;
} 