import React, { useState, useEffect } from 'react';
import { CartItem, User } from '../types';
import { userService, orderService } from '../services/api';
import { Trash2, Printer, ArrowLeft, Package, User as UserIcon, FileSpreadsheet, CheckCircle, Plus, Minus, ShoppingCart, ShoppingBag, ArrowRight } from 'lucide-react';
import { Button } from '../components/Button';

interface CartProps {
  items: CartItem[];
  updateQuantity: (id: string, qty: number) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
  navigate: (page: string) => void;
}

export const Cart: React.FC<CartProps> = ({ items, updateQuantity, removeItem, clearCart, navigate }) => {
  const [reps, setReps] = useState<User[]>([]);
  const [selectedRep, setSelectedRep] = useState('');
  
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [resellerName, setResellerName] = useState('');
  const [customerContact, setCustomerContact] = useState('');
  const [notes, setNotes] = useState('');
  
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    loadReps();
  }, []);

  const loadReps = async () => {
    try {
      const data = await userService.getReps();
      setReps(data);
    } catch (err) {
      console.error("Erro ao carregar representantes:", err);
    }
  };

  const handleClearCart = () => {
    if (window.confirm("Deseja realmente esvaziar todo o carrinho?")) {
      clearCart();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRep || items.length === 0) return;
    
    const safeReseller = String(resellerName || '').trim();
    const safeNotes = String(notes || '').trim();
    const finalNotes = safeReseller ? `[Revenda: ${safeReseller}] ${safeNotes}` : safeNotes;
    
    try {
      await orderService.create({
        representativeId: selectedRep,
        items: items,
        customerName: String(customerName || 'Cliente Anônimo').trim(),
        customerEmail: String(customerEmail || '').trim(),
        customerContact: String(customerContact || '').trim(),
        notes: finalNotes
      });
      setSubmitted(true);
      clearCart();
    } catch (err: any) {
      console.error("Erro ao enviar pedido:", err);
      const errorMessage = err.message || "Erro desconhecido";
      alert(`Erro ao enviar pedido: ${errorMessage}`);
    }
  };

  const exportToExcel = () => {
    const headers = ['Produto', 'Codigo', 'Referencia', 'Linha', 'Quantidade'];
    const rows = items.map(item => [
      item.description,
      item.code,
      item.reference,
      item.line,
      item.quantity.toString()
    ]);
    
    const csvContent = [headers, ...rows].map(e => e.join(";")).join("\n");
    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `cotacao_dicompel_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const printCart = () => {
    window.print();
  };

  const totalQuantity = items.reduce((acc, it) => acc + it.quantity, 0);

  const darkInputStyle = "w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all shadow-sm";

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20 px-4 no-print">
        <div className="bg-green-100 rounded-full h-20 w-20 flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="h-10 w-10 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Pedido Enviado com Sucesso!</h2>
        <p className="text-gray-600 mb-8">O representante recebeu sua solicitação e entrará em contato.</p>
        <Button onClick={() => navigate('catalog')} className="gap-2">
          <ShoppingBag className="h-4 w-4" /> Voltar ao Catálogo de Produtos
        </Button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-20 bg-white rounded-2xl border-2 border-dashed border-slate-200 p-10 max-w-2xl mx-auto shadow-sm no-print">
        <div className="h-16 w-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <ShoppingCart className="h-8 w-8" />
        </div>
        <h2 className="text-2xl font-black text-slate-800 mb-2">Seu carrinho está vazio</h2>
        <p className="text-slate-500 mb-8 max-w-md mx-auto">
          Explore o nosso catálogo para adicionar interruptores, tomadas, placas Novara e outros produtos à sua cotação.
        </p>
        <Button onClick={() => navigate('catalog')} size="lg" className="font-black uppercase tracking-wider gap-2">
          <ArrowLeft className="h-4 w-4" /> Ir para o Catálogo
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16">
      {/* Layout de Impressão Oculto */}
      <div className="hidden print-layout">
         <div className="flex justify-between items-start border-b-4 border-slate-900 pb-8 mb-8">
            <div>
               <h1 className="text-4xl font-black text-slate-900">DICOMPEL</h1>
               <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Resumo do Orçamento Digital</p>
            </div>
            <div className="text-right">
               <h2 className="text-2xl font-black text-slate-900">COTAÇÃO</h2>
               <p className="text-sm text-slate-500">{new Date().toLocaleDateString()}</p>
            </div>
         </div>

         <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 mb-10">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Identificação do Cliente</h3>
            <div className="grid grid-cols-2 gap-4">
               <p className="text-sm font-bold text-slate-600">Cliente: <span className="text-slate-900">{customerName || 'Não informado'}</span></p>
               <p className="text-sm font-bold text-slate-600">Revenda: <span className="text-slate-900">{resellerName || 'Venda Direta'}</span></p>
               <p className="text-sm font-bold text-slate-600">Contato: <span className="text-slate-900">{customerContact || 'Não informado'}</span></p>
               <p className="text-sm font-bold text-slate-600">Email: <span className="text-slate-900">{customerEmail || 'Não informado'}</span></p>
            </div>
         </div>

         <table className="w-full text-left border-collapse">
            <thead>
               <tr className="bg-slate-900 text-white">
                  <th className="p-4 text-xs font-black uppercase tracking-widest rounded-tl-xl">Produto</th>
                  <th className="p-4 text-xs font-black uppercase tracking-widest">Cód / Ref</th>
                  <th className="p-4 text-xs font-black uppercase tracking-widest text-center">Linha</th>
                  <th className="p-4 text-xs font-black uppercase tracking-widest text-right rounded-tr-xl">Qtd</th>
               </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
               {items.map((it, idx) => (
                  <tr key={it.id+idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                     <td className="p-4 text-sm font-bold text-slate-900">{it.description}</td>
                     <td className="p-4 text-xs text-slate-500">{it.code} / {it.reference}</td>
                     <td className="p-4 text-xs font-black text-slate-400 text-center uppercase">{it.line}</td>
                     <td className="p-4 text-lg font-black text-slate-900 text-right">{it.quantity}</td>
                  </tr>
               ))}
            </tbody>
         </table>
         <div className="mt-20 text-center text-[10px] text-slate-400 font-bold uppercase tracking-widest border-t pt-8">
            Dicompel Indústria de Componentes Elétricos - www.dicompel.com.br
         </div>
      </div>

      {/* Top Navigation Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200 no-print">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('catalog')} 
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider shadow-md hover:shadow-lg transition-all"
          >
            <ArrowLeft className="h-4 w-4" /> Continuar Comprando
          </button>
          <span className="text-xs text-slate-500 font-bold hidden sm:inline-block">
            {totalQuantity} {totalQuantity === 1 ? 'item' : 'itens'} no carrinho
          </span>
        </div>

        <div className="flex items-center gap-2">
           <button 
             onClick={handleClearCart} 
             className="flex items-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-700 px-3 py-2 rounded-xl text-xs font-bold transition-all border border-red-200"
             title="Esvaziar todos os itens do carrinho"
           >
              <Trash2 className="h-4 w-4"/>
              <span>Limpar</span>
           </button>
           <button onClick={exportToExcel} className="flex items-center gap-1.5 bg-green-50 hover:bg-green-100 text-green-700 px-3 py-2 rounded-xl text-xs font-bold transition-all border border-green-200">
              <FileSpreadsheet className="h-4 w-4"/> Excel
           </button>
           <button onClick={printCart} className="flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-2 rounded-xl text-xs font-bold transition-all border border-blue-200">
              <Printer className="h-4 w-4"/> Imprimir
           </button>
        </div>
      </div>

      {/* Product List */}
      <div className="bg-white shadow-sm rounded-2xl border border-slate-200 overflow-hidden no-print">
        <div className="p-4 sm:p-6 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-black text-slate-800 uppercase text-xs tracking-wider flex items-center gap-2">
            <Package className="h-4 w-4 text-blue-600" />
            Produtos no Carrinho ({items.length} {items.length === 1 ? 'modelo' : 'modelos'})
          </h3>
          <span className="text-xs font-bold bg-blue-100 text-blue-800 px-2.5 py-1 rounded-lg">
            Total: {totalQuantity} un.
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {items.map(item => (
            <div key={item.id} className="p-4 sm:p-6 flex flex-col sm:flex-row items-center gap-4 sm:gap-6 hover:bg-slate-50/50 transition-colors">
              <div className="w-20 h-20 flex-shrink-0 bg-slate-50 border border-slate-200 rounded-xl p-2 flex items-center justify-center">
                <img src={item.imageUrl} alt={item.code} className="max-w-full max-h-full object-contain" />
              </div>

              <div className="flex-grow text-center sm:text-left">
                <h4 className="font-bold text-slate-900 text-sm sm:text-base leading-snug">{item.description}</h4>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-1.5">
                  {item.reference && (
                    <span className="text-[10px] bg-slate-100 text-slate-600 font-mono font-bold px-2 py-0.5 rounded border border-slate-200">
                      EAN: {item.reference}
                    </span>
                  )}
                  <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded border border-slate-200 uppercase">
                    Cód: {item.code}
                  </span>
                  {item.line && (
                    <span className="text-[10px] bg-blue-50 text-blue-700 font-black px-2 py-0.5 rounded border border-blue-100 uppercase">
                      Linha: {item.line}
                    </span>
                  )}
                </div>
              </div>

              {/* Quantity Controls and Actions */}
              <div className="flex items-center gap-4">
                <div className="flex flex-col items-center sm:items-end">
                  <span className="text-[10px] font-bold text-slate-400 uppercase mb-1">Quantidade</span>
                  <div className="flex items-center border border-slate-300 rounded-xl bg-white shadow-sm overflow-hidden">
                    <button 
                      type="button"
                      className="px-3 py-2 text-slate-600 hover:bg-slate-100 active:bg-slate-200 transition-colors" 
                      onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))}
                      title="Diminuir quantidade"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <input 
                      type="number" 
                      min="1" 
                      className="w-14 text-center bg-slate-50 font-black text-sm py-1.5 focus:outline-none focus:bg-blue-50 border-x border-slate-200 text-slate-800" 
                      value={item.quantity} 
                      onChange={(e) => updateQuantity(item.id, Math.max(1, parseInt(e.target.value) || 1))} 
                    />
                    <button 
                      type="button"
                      className="px-3 py-2 text-slate-600 hover:bg-slate-100 active:bg-slate-200 transition-colors" 
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      title="Aumentar quantidade"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <button 
                  type="button"
                  onClick={() => removeItem(item.id)} 
                  className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                  title="Remover produto do carrinho"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Action bar below item list */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <button 
            type="button"
            onClick={() => navigate('catalog')}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-800 font-black text-xs uppercase tracking-wider transition-colors py-2 px-3 rounded-lg hover:bg-blue-50"
          >
            <Plus className="h-4 w-4" /> Adicionar Mais Produtos ao Carrinho
          </button>
          
          <a
            href="#orcamento-form"
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider shadow-md transition-all"
          >
            <span>Preencher Cotação</span>
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </div>

      {/* Quote Form */}
      <form id="orcamento-form" onSubmit={handleSubmit} className="bg-white shadow-sm rounded-2xl p-6 sm:p-8 border border-slate-200 no-print">
        <h3 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-2">
           <UserIcon className="h-5 w-5 text-blue-600"/> Dados do Orçamento / Solicitação
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Seu Nome / Responsável *</label>
            <input required type="text" className={darkInputStyle} placeholder="Ex: João da Silva" value={customerName} onChange={e => setCustomerName(e.target.value)} />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Nome da Revenda / Loja</label>
            <input type="text" className={darkInputStyle} placeholder="Ex: Elétrica Central Ltda" value={resellerName} onChange={e => setResellerName(e.target.value)} />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">E-mail para Retorno *</label>
            <input required type="email" className={darkInputStyle} placeholder="Ex: joao@email.com" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Telefone (WhatsApp) *</label>
            <input required type="text" className={darkInputStyle} placeholder="Ex: (11) 99999-9999" value={customerContact} onChange={e => setCustomerContact(e.target.value)} />
          </div>
        </div>
        <div className="mb-6">
           <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Escolha o Representante Dicompel *</label>
           <select required className={darkInputStyle} value={selectedRep} onChange={e => setSelectedRep(e.target.value)}>
             <option value="" className="bg-slate-800">-- Clique para Selecionar o Representante --</option>
             {reps.map(rep => <option key={rep.id} value={rep.id} className="bg-slate-800">{rep.name}</option>)}
           </select>
        </div>
        <div className="mb-8">
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Observações Adicionais</label>
          <textarea 
            className={darkInputStyle} 
            rows={3} 
            value={notes} 
            onChange={(e) => setNotes(e.target.value)} 
            placeholder="Detalhes sobre frete, cores específicas, urgência na entrega..."
          />
        </div>
        <Button type="submit" size="lg" className="w-full h-14 font-black uppercase tracking-[0.2em] shadow-lg shadow-blue-500/20">
          ENVIAR SOLICITAÇÃO DE COTAÇÃO
        </Button>
      </form>
    </div>
  );
};
