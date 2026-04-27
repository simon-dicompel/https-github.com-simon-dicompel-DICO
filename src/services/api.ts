import { Product, User, Order, OrderStatus } from '../types';

const API_BASE = '/api';

export const productService = {
  getAll: async (): Promise<Product[]> => {
    const res = await fetch(`${API_BASE}/products`);
    if (!res.ok) throw new Error('Falha ao buscar produtos');
    return res.json();
  },
  create: async (product: Omit<Product, 'id'>): Promise<Product> => {
    const res = await fetch(`${API_BASE}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(product),
    });
    if (!res.ok) throw new Error('Falha ao criar produto');
    return res.json();
  },
  update: async (product: Product): Promise<Product> => {
    const res = await fetch(`${API_BASE}/products/${product.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(product),
    });
    if (!res.ok) throw new Error('Falha ao atualizar produto');
    return res.json();
  },
};

export const userService = {
  getAll: async (): Promise<User[]> => {
    const res = await fetch(`${API_BASE}/users`);
    if (!res.ok) throw new Error('Falha ao buscar usuários');
    return res.json();
  },
  getReps: async (): Promise<User[]> => {
    const users = await userService.getAll();
    return users.filter(u => u.role === 'REPRESENTATIVE');
  },
  create: async (user: Omit<User, 'id'>): Promise<User> => {
    const res = await fetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user),
    });
    if (!res.ok) throw new Error('Falha ao criar usuário');
    return res.json();
  },
  update: async (user: User): Promise<User> => {
    const res = await fetch(`${API_BASE}/users/${user.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user),
    });
    if (!res.ok) throw new Error('Falha ao atualizar usuário');
    return res.json();
  },
  delete: async (id: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/users/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Falha ao excluir usuário');
  },
};

export const orderService = {
  getAll: async (): Promise<Order[]> => {
    const res = await fetch(`${API_BASE}/orders`);
    if (!res.ok) throw new Error('Falha ao buscar pedidos');
    return res.json();
  },
  getByRep: async (repId: string): Promise<Order[]> => {
    const res = await fetch(`${API_BASE}/orders/rep/${repId}`);
    if (!res.ok) throw new Error('Falha ao buscar pedidos do representante');
    return res.json();
  },
  create: async (order: Partial<Order>): Promise<Order> => {
    const res = await fetch(`${API_BASE}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order),
    });
    if (!res.ok) throw new Error('Falha ao criar pedido');
    return res.json();
  },
  update: async (order: Order): Promise<Order> => {
    const res = await fetch(`${API_BASE}/orders/${order.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order),
    });
    if (!res.ok) throw new Error('Falha ao atualizar pedido');
    return res.json();
  },
  updateStatus: async (id: string, status: OrderStatus): Promise<void> => {
    const res = await fetch(`${API_BASE}/orders/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) throw new Error('Falha ao atualizar status do pedido');
  },
  delete: async (id: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/orders/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Falha ao excluir pedido');
  },
};

export const authService = {
  login: async (email: string, password: string): Promise<User | null> => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || 'Credenciais inválidas ou erro no servidor');
    }
    const user = await res.json();
    localStorage.setItem('user', JSON.stringify(user));
    return user;
  },
  logout: async () => {
    localStorage.removeItem('user');
  },
  getCurrentUser: (): User | null => {
    const userJson = localStorage.getItem('user');
    if (!userJson) return null;
    try {
      return JSON.parse(userJson);
    } catch (e) {
      return null;
    }
  },
  updatePassword: async (password: string): Promise<{ success: boolean; message: string }> => {
    const userJson = localStorage.getItem('user');
    if (!userJson) return { success: false, message: 'Usuário não logado' };
    const user = JSON.parse(userJson);
    const res = await fetch(`${API_BASE}/users/${user.id}/password`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) return { success: false, message: 'Falha ao atualizar senha' };
    return { success: true, message: 'Senha atualizada com sucesso' };
  },
  getHealth: async () => {
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) return null;
    return res.json();
  }
};
