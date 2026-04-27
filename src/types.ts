export enum UserRole {
  ADMIN = 'ADMIN',
  REPRESENTATIVE = 'REPRESENTATIVE',
  SUPERVISOR = 'SUPERVISOR',
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  password?: string;
}

export interface Product {
  id: string;
  code: string;
  description: string;
  reference: string;
  colors: string[];
  imageUrl: string;
  category: string;
  subcategory: string;
  line: string;
  amperage?: string; // Ex: '10A', '20A', 'Bivolt'
  details?: string;  // Especificações técnicas detalhadas
}

export interface CartItem extends Product {
  quantity: number;
}

export enum OrderStatus {
  NEW = 'Novo',
  IN_PROGRESS = 'Em Atendimento',
  CLOSED = 'Finalizado',
  CANCELLED = 'Cancelado'
}

export interface CRMInteraction {
  id: string;
  date: string;
  type: 'note' | 'call' | 'email' | 'meeting';
  content: string;
  authorName: string;
}

export interface Order {
  id: string;
  customerName?: string;
  customerEmail?: string;
  customerContact?: string;
  representativeId: string;
  items: CartItem[];
  status: OrderStatus;
  createdAt: string;
  notes: string;
  interactions: CRMInteraction[];
}

export interface DashboardStats {
  totalOrders: number;
  newOrders: number;
  completedOrders: number;
}
