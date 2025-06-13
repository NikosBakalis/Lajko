export enum UserRole {
  STUDENT = 'STUDENT',
  FACULTY = 'FACULTY',
  SECRETARY = 'SECRETARY'
}

export enum ThesisStatus {
  OPEN = 'OPEN',
  ASSIGNED = 'ASSIGNED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

export interface User {
  id: number;
  username: string;
  email: string;
  fullName: string;
  role: UserRole;
  studentId?: string;
  postalAddress?: string;
  mobilePhone?: string;
  landlinePhone?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Thesis {
  id: number;
  title: string;
  description: string;
  status: ThesisStatus;
  facultyId: number;
  faculty: User;
  selectedBy: User[];
  assignedToId?: number;
  assignedTo?: User;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: number;
  title: string;
  description: string;
  completed: boolean;
  userId: number;
  user: User;
  createdAt: string;
  updatedAt: string;
} 