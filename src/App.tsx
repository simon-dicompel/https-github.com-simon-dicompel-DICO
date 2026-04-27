import React, { useState, useEffect, useCallback } from 'react';
import { Layout } from './components/Layout';
import { Catalog } from './pages/Catalog';
import { Cart } from './pages/Cart';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Product, CartItem, User, UserRole, OrderStatus } from './types';
import { authService, orderService } from './services/api';

const App: React.FC = () => {
  const [page, setPage] = useState('catalog');
  const [user, setUser] = useState<User | null>(null);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [newOrdersCount, setNewOrdersCount] = useState(0);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isInitializing, setIsInitializing] = useState(true);

  const refreshData = useCallback(async () => {
    if (!user) return;
    try {
      const allOrders = (user.role === UserRole.ADMIN || user.role === UserRole.SUPERVISOR)
        ? await orderService.getAll()
        : await orderService.getByRep(user.id);
        
      const count = allOrders.filter(o => o.status === OrderStatus.NEW).length;
      setNewOrdersCount(count);
      setRefreshTrigger(Date.now()); // Incrementa o trigger silencioso
    } catch (e) {
      console.error("Erro ao sincronizar pedidos:", e);
    }
  }, [user]);

  useEffect(() => {
    const initApp = async () => {
      const currentUser = authService.getCurrentUser();
      if (currentUser) {
        setUser(currentUser);
      }
      
      try {
        const savedCart = localStorage.getItem('dicompel_cart');
        if (savedCart) setCartItems(JSON.parse(savedCart));
      } catch (e) {
        localStorage.removeItem('dicompel_cart');
      }
      setIsInitializing(false);
    };
    initApp();
  }, []);

  useEffect(() => {
    if (user) {
      refreshData();
      const interval = setInterval(refreshData, 30000); // Checa a cada 30 segundos (reduz carga)
      return () => clearInterval(interval);
    }
  }, [user, refreshData]);

  useEffect(() => {
    if (!isInitializing) {
      localStorage.setItem('dicompel_cart', JSON.stringify(cartItems));
    }
  }, [cartItems, isInitializing]);

  const addToCart = (product: Product) => {
    setCartItems(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const updateCartQuantity = (id: string, qty: number) => {
    setCartItems(prev => prev.map(item => item.id === id ? { ...item, quantity: qty } : item));
  };

  const removeCartItem = (id: string) => {
    setCartItems(prev => prev.filter(item => item.id !== id));
  };

  const clearCart = () => setCartItems([]);

  const renderPage = () => {
    switch(page) {
      case 'catalog': return <Catalog addToCart={addToCart} />;
      case 'cart': return <Cart items={cartItems} updateQuantity={updateCartQuantity} removeItem={removeCartItem} navigate={setPage} clearCart={clearCart} />;
      case 'login': return <Login onLogin={(u) => { setUser(u); }} navigate={setPage} />;
      case 'dashboard': return user ? <Dashboard user={user} refreshTrigger={refreshTrigger} /> : <Login onLogin={(u) => { setUser(u); }} navigate={setPage} />;
      default: return <Catalog addToCart={addToCart} />;
    }
  };

  if (isInitializing) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="loader"></div>
      </div>
    );
  }

  return (
    <Layout 
      user={user} 
      setUser={setUser} 
      cartCount={cartItems.reduce((acc, i) => acc + i.quantity, 0)}
      newOrdersCount={newOrdersCount}
      navigate={setPage}
      currentPage={page}
    >
      {renderPage()}
    </Layout>
  );
};

export default App;
