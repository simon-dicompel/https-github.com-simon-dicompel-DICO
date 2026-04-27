import React, { useState, useEffect } from 'react';
import { CartItem, User } from '../types';
import { userService, orderService } from '../services/api';
import { Trash2, Printer, ArrowLeft, Package, User as UserIcon, FileSpreadsheet, CheckCircle } from 'lucide-react';
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
    } catch (err) {
      console.error("Erro ao enviar pedido:", err);
      alert("Erro ao enviar pedido.");
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

  const darkInputStyle = "w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all shadow-sm";

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20 px-4 no-print">
        <div className="bg-green-100 rounded-full h-20 w-20 flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="h-10 w-10 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Pedido Enviado!</h2>
        <p className="text-gray-600 mb-8">O representante recebeu sua solicitação e entrará em contato.</p>
        <Button onClick={() => navigate('catalog')}>Voltar ao Catálogo</Button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-20 bg-white rounded-xl border border-dashed p-10 no-print">
        <Package className="h-12 w-12 text-slate-300 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-slate-400">Seu carrinho está vazio</h2>
        <p className="text-slate-400 mb-8">Adicione produtos para gerar sua cotação.</p>
        <Button onClick={() => navigate('catalog')}>Ir para o Catálogo</Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
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

      <div className="flex items-center justify-between no-print">
        <button onClick={() => navigate('catalog')} className="flex items-center text-slate-500 hover:text-blue-600 font-bold transition-colors">
          <ArrowLeft className="h-5 w-5 mr-2" /> Voltar ao Catálogo
        </button>
        <div className="flex gap-2">
           <button onClick={exportToExcel} className="flex items-center gap-2 bg-green-50 hover:bg-green-100 text-green-700 px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all border border-green-100">
              <FileSpreadsheet className="h-4 w-4"/> Excel
           </button>
           <button onClick={printCart} className="flex items-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-700 px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all border border-blue-100">
              <Printer className="h-4 w-4"/> Imprimir
           </button>
        </div>
      </div>

      <div className="bg-white shadow-sm rounded-xl border border-slate-200 overflow-hidden no-print">
        <div className="divide-y divide-slate-100">
          {items.map(item => (
            <div key={item.id} className="p-6 flex flex-col sm:flex-row items-center gap-6">
              <img src={item.imageUrl} alt={item.code} className="w-20 h-20 object-contain rounded border bg-slate-50 p-2" />
              <div className="flex-grow text-center sm:text-left">
                <h4 className="font-bold text-slate-900">{item.description}</h4>
                <div className="text-[10px] text-slate-400 font-bold uppercase mt-1">Ref: {item.reference} | {item.code}</div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center border border-slate-200 rounded-lg bg-slate-50">
                  <button className="px-3 py-1 hover:bg-slate-200" onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))}>-</button>
                  <input type="number" min="1" className="w-12 text-center bg-white font-bold text-sm" value={item.quantity} onChange={(e) => updateQuantity(item.id, parseInt(e.target.value) || 1)} />
                  <button className="px-3 py-1 hover:bg-slate-200" onClick={() => updateQuantity(item.id, item.quantity + 1)}>+</button>
                </div>
                <button onClick={() => removeItem(item.id)} className="text-slate-400 hover:text-red-500"><Trash2 className="h-5 w-5" /></button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white shadow-sm rounded-xl p-8 border border-slate-200 no-print">
        <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
           <UserIcon className="h-5 w-5 text-blue-600"/> Dados do Orçamento
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Seu Nome / Responsável</label>
            <input required type="text" className={darkInputStyle} value={customerName} onChange={e => setCustomerName(e.target.value)} />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Nome da Revenda / Loja</label>
            <input type="text" className={darkInputStyle} value={resellerName} onChange={e => setResellerName(e.target.value)} />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">E-mail para Retorno</label>
            <input required type="email" className={darkInputStyle} value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Telefone (WhatsApp)</label>
            <input required type="text" className={darkInputStyle} value={customerContact} onChange={e => setCustomerContact(e.target.value)} />
          </div>
        </div>
        <div className="mb-6">
           <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Escolha o Representante Dicompel</label>
           <select required className={darkInputStyle} value={selectedRep} onChange={e => setSelectedRep(e.target.value)}>
             <option value="" className="bg-slate-800">-- Clique para Selecionar --</option>
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
            placeholder="Detalhes sobre frete, cores específicas ou urgência..."
          />
        </div>
        <Button type="submit" size="lg" className="w-full h-14 font-black uppercase tracking-[0.2em]">ENVIAR SOLICITAÇÃO</Button>
      </form>
    </div>
  );
};
