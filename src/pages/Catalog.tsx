import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Product } from '../types';
import { productService } from '../services/api';
import { Search, Info, Check, Plus, Camera, Sparkles, AlertCircle, AlertTriangle, X, Filter, ChevronDown, Layers, Image as ImageIcon, Box, ArrowLeft, Settings2, HelpCircle, ShoppingBag, MessageCircle, UserCheck, ShoppingCart, ArrowRight, RefreshCw, Database } from 'lucide-react';
import { Button } from '../components/Button';
import { GoogleGenAI, Type } from "@google/genai";

interface CatalogProps {
  addToCart: (product: Product) => void;
  cartCount?: number;
  navigate?: (page: string) => void;
}

interface AIResult {
  type: string;
  color: string;
  amperage: string;
  line: string;
  description: string;
}

interface AISearchResult {
  capturedImage: string;
  product: Product | null;
  aiData: AIResult;
}

export const Catalog: React.FC<CatalogProps> = ({ addToCart, cartCount = 0, navigate }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [addedIds, setAddedIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'general' | 'novara'>('general');
  const [visibleCount, setVisibleCount] = useState(24);
  const [dbErrorMsg, setDbErrorMsg] = useState<string | null>(null);
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  // Filtros Geral
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedLine, setSelectedLine] = useState('all');
  const [selectedColor, setSelectedColor] = useState('all');

  // Controle Monte sua Novara
  const [selectedPlatesForKit, setSelectedPlatesForKit] = useState<Product[]>([]);
  const [isPickingModules, setIsPickingModules] = useState(false);
  const [novaraSearch, setNovaraSearch] = useState('');
  const [novaraColor, setNovaraColor] = useState('all');

  // Busca Visual
  const [showVisualSearch, setShowVisualSearch] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [aiSearchResult, setAiSearchResult] = useState<AISearchResult | null>(null);
  
  const [showHowToBuy, setShowHowToBuy] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const [selectedProductForInfo, setSelectedProductForInfo] = useState<Product | null>(null);

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    if (showVisualSearch) startCamera();
    else stopCamera();
    return () => stopCamera();
  }, [showVisualSearch]);

  useEffect(() => {
    if (cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.play().catch(console.error);
    }
  }, [cameraStream]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      setDbErrorMsg(null);
      setIsOfflineMode(false);
      const data = await productService.getAll();
      setProducts(data || []);
    } catch (e: any) {
      console.error("Erro ao carregar catálogo:", e);
      const cached = productService.getCached();
      if (cached && cached.length > 0) {
        setProducts(cached);
        setIsOfflineMode(true);
        setDbErrorMsg(`Aviso: Exibindo catálogo em cache local (${cached.length} produtos). Não foi possível sincronizar com o banco: ${e.message}`);
      } else {
        setDbErrorMsg(e.message || "Falha ao buscar produtos no banco de dados.");
      }
    } finally {
      setLoading(false);
    }
  };

  const getFilteredGeneral = () => {
    let result = products.filter(p => p.line.toLowerCase() !== 'novara' || activeTab === 'general');
    if (searchTerm) {
      const low = searchTerm.toLowerCase().trim();
      result = result.filter(p => p.code.toLowerCase().includes(low) || p.description.toLowerCase().includes(low));
    }
    if (selectedCategory !== 'all') {
      result = result.filter(p => (p.category || '').toLowerCase().trim() === selectedCategory.toLowerCase().trim());
    }
    if (selectedLine !== 'all' && selectedLine !== 'Novara') {
      result = result.filter(p => (p.line || '').toLowerCase().trim() === selectedLine.toLowerCase().trim());
    }
    if (selectedColor !== 'all') {
      result = result.filter(p => p.colors && p.colors.some(c => c.toLowerCase().trim() === selectedColor.toLowerCase().trim()));
    }
    return result;
  };

  const getFilteredNovara = () => {
    let result = products.filter(p => p.line.toLowerCase() === 'novara');
    if (!isPickingModules) {
      result = result.filter(p => (p.category || '').toLowerCase().includes('placa'));
    } else {
      result = result.filter(p => (p.category || '').toLowerCase().includes('módulo') || (p.category || '').toLowerCase().includes('modulo'));
    }
    if (novaraSearch) {
      const low = novaraSearch.toLowerCase().trim();
      result = result.filter(p => p.code.toLowerCase().includes(low) || p.description.toLowerCase().includes(low));
    }
    if (novaraColor !== 'all') {
      result = result.filter(p => p.colors && p.colors.some(c => c.toLowerCase() === novaraColor.toLowerCase()));
    }
    return result;
  };

  const currentDisplayProducts = activeTab === 'general' ? getFilteredGeneral() : getFilteredNovara();

  const lastElementRef = useCallback((node: HTMLDivElement | null) => {
    if (loading) return;
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && visibleCount < currentDisplayProducts.length) {
        setVisibleCount(prev => prev + 12);
      }
    });

    if (node) observerRef.current.observe(node);
  }, [loading, visibleCount, currentDisplayProducts.length]);

  const novaraColors = Array.from(new Set(
    products
      .filter(p => p.line.toLowerCase() === 'novara')
      .flatMap(p => p.colors || [])
  )).sort();

  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      setCameraStream(stream);
    } catch (err) {
      setCameraError("Câmera não disponível.");
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
  };

  const analyzeImage = async (base64Data: string) => {
    setIsAnalyzing(true);
    try {
      // @ts-ignore
      const apiKey = (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) || (import.meta as any).env?.VITE_GEMINI_API_KEY || '';
      
      if (!apiKey || apiKey === 'undefined') {
        throw new Error("GEMINI_API_KEY ausente ou inválida. Configure nas configurações do projeto.");
      }

      const ai = new GoogleGenAI({ apiKey: apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{
          parts: [
            { text: "Identifique este componente elétrico Dicompel. Analise a imagem e retorne apenas o JSON com: type, color, amperage, line, description. Seja preciso na linha (Novara, Classic, etc). Se for um interruptor, diga se é simples, paralelo ou intermediário." },
            { inlineData: { mimeType: 'image/jpeg', data: base64Data.split(',')[1] } }
          ]
        }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              type: { type: Type.STRING },
              color: { type: Type.STRING },
              amperage: { type: Type.STRING },
              line: { type: Type.STRING },
              description: { type: Type.STRING }
            },
            required: ["type", "color", "amperage", "line", "description"]
          }
        }
      });

      const parsed: AIResult = JSON.parse(response.text || "{}");
      
      const keywords = `${parsed.description} ${parsed.type} ${parsed.line} ${parsed.color}`.toLowerCase().split(' ').filter(k => k.length > 2);
      const matches = products.map(p => {
        const pStr = `${p.description} ${p.code} ${p.line} ${p.category} ${p.amperage}`.toLowerCase();
        let score = 0;
        keywords.forEach(k => { if (pStr.includes(k)) score++; });
        if (p.line.toLowerCase() === parsed.line.toLowerCase()) score += 4;
        if (p.colors?.some(c => c.toLowerCase().includes(parsed.color.toLowerCase()))) score += 2;
        return { product: p, score };
      }).filter(i => i.score > 2).sort((a,b) => b.score - a.score);

      setAiSearchResult({ 
        capturedImage: base64Data, 
        product: matches[0]?.product || null, 
        aiData: parsed 
      });
      setShowVisualSearch(false);
      stopCamera();
    } catch (err: any) {
      console.error("IA Error:", err);
      alert(err.message || "Erro ao processar imagem.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        ctx.drawImage(videoRef.current, 0, 0);
        analyzeImage(canvasRef.current.toDataURL('image/jpeg', 0.9));
      }
    }
  };

  const handleAddToCart = (product: Product) => {
    addToCart(product);
    setAddedIds(prev => [...prev, product.id]);
    setTimeout(() => setAddedIds(prev => prev.filter(id => id !== product.id)), 1500);
  };

  const getAmperageBadgeClass = (amperage: string) => {
    const val = (amperage || '').toUpperCase();
    if (val.includes('10A')) return 'bg-blue-600';
    if (val.includes('20A')) return 'bg-red-600';
    if (val.includes('BIVOLT')) return 'bg-green-600';
    return 'bg-blue-600';
  };

  // Listas únicas de categorias e linhas sem duplicatas case-insensitive
  const categories = useMemo(() => {
    const unique = new Map<string, string>();
    products.forEach(p => {
      const original = (p.category || '').trim();
      const key = original.toLowerCase();
      if (key && !unique.has(key)) unique.set(key, original);
    });
    return Array.from(unique.values()).sort();
  }, [products]);

  const lines = useMemo(() => {
    const unique = new Map<string, string>();
    products.forEach(p => {
      const original = (p.line || '').trim();
      const key = original.toLowerCase();
      if (key && !unique.has(key)) unique.set(key, original);
    });
    return Array.from(unique.values()).sort();
  }, [products]);

  const allColors = useMemo(() => {
    const unique = new Map<string, string>();
    products.forEach(p => {
      (p.colors || []).forEach(c => {
        const original = c.trim();
        const key = original.toLowerCase();
        if (key && !unique.has(key)) unique.set(key, original);
      });
    });
    return Array.from(unique.values()).sort();
  }, [products]);

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 uppercase tracking-tight">Dicompel Digital</h2>
            <p className="text-slate-600 text-sm">Catálogo e Configurador de Kits.</p>
          </div>
          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            <Button variant="outline" size="sm" className="flex-1 md:flex-none bg-white font-black uppercase tracking-widest text-[10px] h-11 px-6 border-slate-200" onClick={() => setShowHowToBuy(true)}>
              <HelpCircle className="h-4 w-4 mr-2" /> Como Comprar
            </Button>
            <Button variant="primary" size="sm" className="flex-1 md:flex-none bg-blue-600 shadow-lg shadow-blue-100 font-black uppercase tracking-widest text-[10px] h-11 px-6" onClick={() => setShowVisualSearch(true)}>
              <Camera className="h-4 w-4 mr-2" /> Pesquisa Visual IA
            </Button>
          </div>
        </div>

        {dbErrorMsg && (
          <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
            isOfflineMode 
              ? 'bg-amber-50 border-amber-200 text-amber-900' 
              : 'bg-red-50 border-red-200 text-red-900'
          }`}>
            <div className="flex items-center gap-3">
              {isOfflineMode ? (
                <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              )}
              <div>
                <p className="text-xs font-bold">{dbErrorMsg}</p>
                {dbErrorMsg.toLowerCase().includes('login failed') && (
                  <p className="text-[10px] text-slate-600 mt-0.5">
                    Credencial rejeitada: verifique a variável <strong>DB_PASS</strong> no Azure App Service para o usuário <strong>adminsql</strong>.
                  </p>
                )}
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={loadProducts}
              className="flex-shrink-0 text-xs font-bold py-1.5 px-3 h-auto border-slate-300 hover:bg-slate-100"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Tentar Reconectar
            </Button>
          </div>
        )}

        <div className="flex space-x-1 bg-slate-100 p-1 rounded-lg w-full md:w-auto self-start border border-slate-200">
          <button onClick={() => { setActiveTab('general'); setVisibleCount(24); }} className={`px-6 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'general' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
            Catálogo Geral
          </button>
          <button onClick={() => { setActiveTab('novara'); setSelectedPlatesForKit([]); setIsPickingModules(false); setVisibleCount(24); }} className={`px-6 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'novara' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
            Monte sua Novara
          </button>
        </div>
      </div>

      {activeTab === 'general' ? (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute inset-y-0 left-3 h-4 w-4 text-slate-400 my-auto" />
            <input type="text" className="w-full pl-10 pr-3 py-3 border rounded-xl text-xs bg-slate-50 border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Código ou nome do produto..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setVisibleCount(24); }} />
          </div>
          <div className="relative">
             <Filter className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
             <select value={selectedCategory} onChange={(e) => { setSelectedCategory(e.target.value); setVisibleCount(24); }} className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold appearance-none focus:outline-none">
                <option value="all">Todas as Categorias ({products.length})</option>
                {categories.map(c => {
                  const count = products.filter(p => (p.category || '').toLowerCase().trim() === c.toLowerCase().trim()).length;
                  return <option key={c} value={c}>{c} ({count})</option>;
                })}
             </select>
             <ChevronDown className="absolute right-3 top-3.5 h-4 w-4 text-slate-400 pointer-events-none" />
          </div>
          <div className="relative">
             <Layers className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
             <select value={selectedLine} onChange={(e) => { setSelectedLine(e.target.value); setVisibleCount(24); }} className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold appearance-none focus:outline-none">
                <option value="all">Todas as Linhas ({products.length})</option>
                {lines.map(l => {
                  const count = products.filter(p => (p.line || '').toLowerCase().trim() === l.toLowerCase().trim()).length;
                  return <option key={l} value={l}>{l} ({count})</option>;
                })}
             </select>
             <ChevronDown className="absolute right-3 top-3.5 h-4 w-4 text-slate-400 pointer-events-none" />
          </div>
          <div className="relative">
             <ImageIcon className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
             <select value={selectedColor} onChange={(e) => { setSelectedColor(e.target.value); setVisibleCount(24); }} className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold appearance-none focus:outline-none">
                <option value="all">Todas as Cores ({allColors.length})</option>
                {allColors.map(c => {
                  const count = products.filter(p => (p.colors || []).some(col => col.toLowerCase().trim() === c.toLowerCase().trim())).length;
                  return <option key={c} value={c}>{c} ({count})</option>;
                })}
             </select>
             <ChevronDown className="absolute right-3 top-3.5 h-4 w-4 text-slate-400 pointer-events-none" />
          </div>
        </div>
      ) : (
        <div className="bg-slate-900 p-6 rounded-2xl shadow-xl border border-slate-800 space-y-4">
          {selectedPlatesForKit.length > 0 && (
            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 space-y-3">
               <div className="flex justify-between items-center">
                  <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Placas Selecionadas ({selectedPlatesForKit.length})</p>
                  <button onClick={() => { setIsPickingModules(false); setVisibleCount(24); }} className="flex items-center gap-2 text-[10px] font-black uppercase text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-all shadow-lg">
                     <Plus className="h-4 w-4"/> Escolher outra Placa
                  </button>
               </div>
               <div className="flex flex-wrap gap-2">
                  {selectedPlatesForKit.map((plate, idx) => (
                    <div key={plate.id + idx} className="flex items-center gap-3 bg-slate-700 p-2 rounded-lg border border-slate-600 group">
                       <div className="w-8 h-8 bg-white rounded p-1">
                          <img src={plate.imageUrl} className="w-full h-full object-contain" alt=""/>
                       </div>
                       <div className="max-w-[120px]">
                          <p className="text-white text-[10px] font-bold truncate">{plate.description}</p>
                       </div>
                       <button onClick={() => setSelectedPlatesForKit(prev => prev.filter((_, i) => i !== idx))} className="text-slate-400 hover:text-red-400 transition-colors">
                          <X className="h-4 w-4" />
                       </button>
                    </div>
                  ))}
               </div>
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <Search className="absolute inset-y-0 left-3 h-4 w-4 text-slate-500 my-auto" />
              <input type="text" className="w-full pl-10 pr-3 py-3 border border-slate-700 rounded-xl text-xs bg-slate-800 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder={isPickingModules ? "Buscar Módulos..." : "Buscar Placas Novara..."} value={novaraSearch} onChange={(e) => { setNovaraSearch(e.target.value); setVisibleCount(24); }} />
            </div>
            <div className="relative">
               <Box className="absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
               <select value={novaraColor} onChange={(e) => { setNovaraColor(e.target.value); setVisibleCount(24); }} className="w-full pl-10 pr-10 py-3 bg-slate-800 border border-slate-700 text-white rounded-xl text-xs font-bold appearance-none focus:outline-none">
                  <option value="all">Todas as Cores</option>
                  {novaraColors.map(c => <option key={c} value={c}>{c}</option>)}
               </select>
               <ChevronDown className="absolute right-3 top-3.5 h-4 w-4 text-slate-500 pointer-events-none" />
            </div>
          </div>
          <div className="text-center py-2">
             <h3 className="text-white text-[10px] font-black uppercase tracking-[0.3em]">
                {isPickingModules ? "Escolha os Módulos para os itens do Kit" : "Primeiro: Escolha sua Placa Novara"}
             </h3>
          </div>
        </div>
      )}

      {currentDisplayProducts.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {currentDisplayProducts.slice(0, visibleCount).map((product, index) => (
            <div 
              key={product.id + index} 
              ref={index === Math.min(visibleCount, currentDisplayProducts.length) - 1 ? lastElementRef : null}
              className="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col h-full overflow-hidden group hover:shadow-xl transition-all duration-300"
            >
              <div className="relative pt-[100%] bg-slate-50">
                <img src={product.imageUrl} alt={product.description} className="absolute inset-0 w-full h-full object-contain p-4 group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute top-3 left-3 flex flex-col gap-1">
                   <span className="bg-slate-900/90 text-white text-[8px] px-2 py-0.5 rounded font-black uppercase tracking-widest shadow-sm">{product.code}</span>
                   {product.amperage && (
                      <span className={`${getAmperageBadgeClass(product.amperage)} text-white text-[8px] px-2 py-0.5 rounded font-black uppercase tracking-widest shadow-sm`}>{product.amperage}</span>
                   )}
                </div>
                <button onClick={() => setSelectedProductForInfo(product)} className="absolute top-3 right-3 bg-white/95 p-2 rounded-full shadow-lg hover:bg-blue-600 hover:text-white transition-all transform active:scale-90"><Info className="h-4 w-4"/></button>
              </div>
              <div className="p-5 flex-grow flex flex-col">
                <span className="text-[10px] font-black text-blue-600 uppercase mb-1 tracking-widest">{product.line}</span>
                <h3 className="text-xs font-bold text-slate-800 mb-4 line-clamp-2 h-9 leading-relaxed">{product.description}</h3>
                <div className="mt-auto flex flex-col gap-2">
                   {activeTab === 'novara' && !isPickingModules ? (
                     <Button variant="secondary" size="sm" className="w-full text-[9px] h-10 font-black uppercase tracking-widest bg-slate-800 hover:bg-slate-900" onClick={() => { setSelectedPlatesForKit(prev => [...prev, product]); handleAddToCart(product); setIsPickingModules(true); setVisibleCount(24); }}>
                        <Settings2 className="h-3.5 w-3.5 mr-2"/> Escolher Módulos
                     </Button>
                   ) : (
                     <>
                       <Button variant="outline" size="sm" className="w-full text-[9px] font-black uppercase tracking-widest border-slate-200 h-9" onClick={() => setSelectedProductForInfo(product)}>
                          <Info className="h-3.5 w-3.5 mr-2"/> Detalhes
                       </Button>
                       <Button variant={addedIds.includes(product.id) ? "secondary" : "primary"} className="w-full text-[9px] h-10 font-black uppercase tracking-widest" onClick={() => handleAddToCart(product)} disabled={addedIds.includes(product.id)}>
                          {addedIds.includes(product.id) ? <Check className="h-4 w-4 mr-2"/> : <Plus className="h-4 w-4 mr-2"/>}
                          {addedIds.includes(product.id) ? "No Carrinho" : (activeTab === 'novara' ? "Add Módulo" : "Adicionar")}
                       </Button>
                     </>
                   )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : !loading ? (
        <div className="bg-white rounded-3xl p-10 border border-slate-200 text-center shadow-sm max-w-xl mx-auto my-8">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Database className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-black text-slate-900 mb-2">
            {dbErrorMsg ? "Comunicação com o Banco de Dados" : "Nenhum Produto Encontrado"}
          </h3>
          <p className="text-xs text-slate-600 mb-6 leading-relaxed max-w-md mx-auto">
            {dbErrorMsg 
              ? `${dbErrorMsg}`
              : "Nenhum produto corresponde aos filtros e termos de busca aplicados."}
          </p>

          {dbErrorMsg && dbErrorMsg.toLowerCase().includes('login failed') && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left text-xs text-slate-700 mb-6">
              <p className="font-bold text-slate-900 mb-2 flex items-center gap-1.5">
                <Info className="w-4 h-4 text-blue-600 flex-shrink-0" /> Como resolver no Azure Portal:
              </p>
              <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-slate-600">
                <li>Acesse <strong>portal.azure.com</strong> e abra o <strong>App Service (dicompel-configurador)</strong>.</li>
                <li>No menu lateral, vá em <strong>Configuração</strong> &gt; <strong>Variáveis de ambiente</strong>.</li>
                <li>Adicione ou edite a variável <strong>DB_PASS</strong> com a senha configurada no servidor SQL <strong>configurador-produto-sql</strong>.</li>
                <li>Salve as alterações e reinicie o App Service.</li>
              </ol>
            </div>
          )}

          <div className="flex flex-wrap justify-center gap-3">
            <Button onClick={loadProducts} className="font-bold text-xs uppercase px-6">
              <RefreshCw className="w-4 h-4 mr-2" /> Tentar Reconectar
            </Button>
            {searchTerm || selectedCategory !== 'all' || selectedLine !== 'all' || selectedColor !== 'all' ? (
              <Button variant="outline" onClick={() => { setSearchTerm(''); setSelectedCategory('all'); setSelectedLine('all'); setSelectedColor('all'); }} className="text-xs font-bold">
                Limpar Filtros
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* MODAL INFO PRODUTO (Corrigido) */}
      {selectedProductForInfo && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 z-[9999]">
           <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-lg w-full overflow-hidden transition-all">
              <div className="relative h-64 bg-slate-50 flex items-center justify-center p-12 border-b">
                 <button onClick={() => setSelectedProductForInfo(null)} className="absolute top-6 right-6 text-slate-300 hover:text-slate-900 bg-white p-2 rounded-full shadow-sm z-10">
                    <X className="h-6 w-6"/>
                 </button>
                 <img src={selectedProductForInfo.imageUrl} className="h-full object-contain" alt={selectedProductForInfo.description}/>
              </div>
              <div className="p-10">
                 <div className="flex justify-between items-start mb-6">
                    <div>
                       <span className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mb-2 block">{selectedProductForInfo.line}</span>
                       <h3 className="text-xl font-black text-slate-900 leading-tight">{selectedProductForInfo.description}</h3>
                    </div>
                 </div>
                 <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                       <span className="text-[9px] font-black text-slate-400 block mb-1 uppercase tracking-widest">CÓDIGO:</span>
                       <span className="text-xs font-bold text-slate-900">{selectedProductForInfo.code}</span>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                       <span className="text-[9px] font-black text-slate-400 block mb-1 uppercase tracking-widest">CÓDIGO EAN:</span>
                       <span className="text-xs font-bold text-slate-900">{selectedProductForInfo.reference || '-'}</span>
                    </div>
                 </div>
                 {selectedProductForInfo.colors && selectedProductForInfo.colors.length > 0 && (
                   <div className="mb-6">
                      <p className="text-[9px] font-black text-slate-400 uppercase mb-2 tracking-widest">Cores Disponíveis:</p>
                      <div className="flex flex-wrap gap-2">
                         {selectedProductForInfo.colors.map(c => (
                           <span key={c} className="bg-slate-100 text-slate-700 px-3 py-1 rounded-lg text-[10px] font-black border border-slate-200 uppercase">{c}</span>
                         ))}
                      </div>
                   </div>
                 )}
                 {selectedProductForInfo.details && (
                    <div className="mb-8 p-5 bg-slate-50 rounded-2xl border border-slate-100">
                       <p className="text-[9px] font-black text-slate-400 uppercase mb-2 tracking-widest">Ficha Técnica:</p>
                       <p className="text-xs text-slate-600 leading-relaxed font-medium">{selectedProductForInfo.details}</p>
                    </div>
                 )}
                 <Button className="w-full h-14 font-black uppercase tracking-[0.2em] shadow-xl shadow-blue-100" onClick={() => { handleAddToCart(selectedProductForInfo!); setSelectedProductForInfo(null); }}>
                    ADICIONAR AO CARRINHO
                 </Button>
              </div>
           </div>
        </div>
      )}

      {/* OUTROS MODAIS */}
      {aiSearchResult && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-xl flex items-center justify-center p-4 z-[9999]">
           <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-3xl w-full overflow-hidden">
              <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                 <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-blue-600" />
                    <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">IA Vision Dicompel</h3>
                 </div>
                 <button onClick={() => setAiSearchResult(null)} className="text-slate-400 hover:text-slate-900 transition-all"><X className="h-8 w-8"/></button>
              </div>
              <div className="p-8">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                    <div className="space-y-4">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sua Captura:</p>
                       <div className="aspect-square rounded-2xl overflow-hidden border-2 border-slate-100 shadow-inner bg-slate-50">
                          <img src={aiSearchResult.capturedImage} className="w-full h-full object-cover" alt="Captura"/>
                       </div>
                    </div>
                    <div className="space-y-4">
                       <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Produto Sugerido:</p>
                       {aiSearchResult.product ? (
                          <div className="aspect-square rounded-2xl overflow-hidden border-2 border-blue-100 bg-white flex items-center justify-center p-6 relative group shadow-sm">
                             <img src={aiSearchResult.product.imageUrl} className="max-w-full max-h-full object-contain" alt="Sugestão"/>
                             <div className="absolute top-3 right-3">
                                <span className="bg-blue-600 text-white text-[9px] font-black px-3 py-1.5 rounded-xl shadow-lg border border-blue-400">98% MATCH</span>
                             </div>
                          </div>
                       ) : (
                          <div className="aspect-square rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-center p-8 text-slate-400 bg-slate-50">
                             <AlertCircle className="h-10 w-10 mb-3" />
                             <p className="text-[11px] font-black uppercase leading-relaxed tracking-wider">Não encontrado no banco local.</p>
                          </div>
                       )}
                    </div>
                 </div>
                 <div className="flex gap-4">
                    <Button variant="outline" className="flex-1 h-16 font-black uppercase text-[10px] tracking-widest border-2" onClick={() => { setAiSearchResult(null); setShowVisualSearch(true); }}>REPETIR BUSCA</Button>
                    {aiSearchResult.product && (
                       <Button className="flex-[2] h-16 font-black uppercase tracking-[0.2em] shadow-2xl shadow-blue-200 text-xs" onClick={() => { handleAddToCart(aiSearchResult.product!); setAiSearchResult(null); }}>
                          <ShoppingBag className="h-5 w-5 mr-3" /> ADICIONAR AO CARRINHO
                       </Button>
                    )}
                 </div>
              </div>
           </div>
        </div>
      )}

      {showHowToBuy && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 z-[9999]">
           <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-lg w-full p-10 overflow-y-auto max-h-[90vh]">
              <div className="flex justify-between items-center mb-8 border-b pb-4">
                 <h3 className="text-xl font-black text-slate-900 uppercase">Guia de Compra</h3>
                 <button onClick={() => setShowHowToBuy(false)} className="text-slate-300 hover:text-slate-900 transition-colors"><X className="h-8 w-8"/></button>
              </div>
              <div className="space-y-8">
                 <div className="flex gap-4">
                    <div className="h-10 w-10 bg-blue-600 text-white rounded-2xl flex items-center justify-center font-black flex-shrink-0 shadow-lg shadow-blue-100"><ShoppingBag className="h-5 w-5"/></div>
                    <div>
                       <h4 className="text-sm font-black text-slate-900 uppercase mb-1">1. Selecione os Produtos</h4>
                       <p className="text-xs text-slate-600 leading-relaxed">Adicione itens ao carrinho.</p>
                    </div>
                 </div>
                 <div className="flex gap-4">
                    <div className="h-10 w-10 bg-slate-900 text-white rounded-2xl flex items-center justify-center font-black flex-shrink-0 shadow-lg"><UserCheck className="h-5 w-5"/></div>
                    <div>
                       <h4 className="text-sm font-black text-slate-900 uppercase mb-1">2. Escolha um Representante</h4>
                       <p className="text-xs text-slate-600 leading-relaxed">Selecione quem irá atendê-lo.</p>
                    </div>
                 </div>
              </div>
              <Button className="w-full mt-10 h-14 font-black uppercase tracking-widest" onClick={() => setShowHowToBuy(false)}>CONTINUAR</Button>
           </div>
        </div>
      )}

      {showVisualSearch && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-xl flex items-center justify-center p-4 z-[9999]">
          <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-xl w-full overflow-hidden">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50">
               <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">IA Vision Dicompel</h3>
               <button onClick={() => setShowVisualSearch(false)} className="text-slate-400 hover:text-slate-900 transition-colors"><X className="h-8 w-8"/></button>
            </div>
            <div className="p-8 flex flex-col items-center gap-6">
              {isAnalyzing ? (
                <div className="text-center py-20 flex flex-col items-center">
                   <div className="loader mb-6 border-blue-500"></div>
                   <p className="font-black text-slate-600 animate-pulse uppercase tracking-[0.2em] text-[10px]">Identificando...</p>
                </div>
              ) : (
                <>
                  <div className="relative w-full aspect-square bg-slate-900 rounded-[2rem] overflow-hidden shadow-2xl border-4 border-slate-800">
                    {cameraError ? (
                      <div className="w-full h-full flex flex-col items-center justify-center text-red-400 p-10 text-center">
                         <AlertCircle className="h-12 w-12 mb-4" />
                         <p className="text-[10px] font-black uppercase tracking-widest">{cameraError}</p>
                         <Button size="sm" variant="outline" className="mt-6 border-red-500/50" onClick={startCamera}>Tentar Novamente</Button>
                      </div>
                    ) : (
                      <>
                        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                        <canvas ref={canvasRef} className="hidden" />
                        {cameraStream && (
                          <button onClick={capturePhoto} className="absolute bottom-8 left-1/2 -translate-x-1/2 h-16 w-16 bg-white rounded-full flex items-center justify-center shadow-2xl border-4 border-blue-500 active:scale-90 transition-all">
                            <Sparkles className="h-6 w-6 text-blue-600" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                  <div className="w-full grid grid-cols-2 gap-4">
                    <button onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center justify-center gap-2 p-4 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl hover:bg-blue-50 group transition-all">
                       <ImageIcon className="h-6 w-6 text-slate-400 group-hover:text-blue-500 mb-1" />
                       <span className="text-[10px] font-black uppercase text-slate-500 group-hover:text-blue-600">Abrir Galeria</span>
                       <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                             const r = new FileReader();
                             r.onloadend = () => analyzeImage(r.result as string);
                             r.readAsDataURL(file);
                          }
                       }} />
                    </button>
                    <button onClick={startCamera} className="flex flex-col items-center justify-center gap-2 p-4 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 shadow-lg active:scale-95 transition-all">
                       <Camera className="h-6 w-6 mb-1" />
                       <span className="text-[10px] font-black uppercase">Usar Câmera</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Floating Bottom Cart Bar */}
      {cartCount > 0 && navigate && (
        <div className="fixed bottom-4 left-0 right-0 z-40 px-4 pointer-events-none">
          <div className="max-w-xl mx-auto bg-slate-900/95 backdrop-blur-md text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-slate-700/80 flex items-center justify-between pointer-events-auto transition-all animate-bounce-short">
            <div className="flex items-center gap-3">
              <div className="relative p-2.5 bg-blue-600 rounded-xl text-white shadow-lg">
                <ShoppingCart className="h-5 w-5" />
                <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-black h-5 w-5 rounded-full flex items-center justify-center border-2 border-slate-900">
                  {cartCount}
                </span>
              </div>
              <div>
                <p className="text-xs font-bold text-white leading-tight">
                  {cartCount} {cartCount === 1 ? 'produto selecionado' : 'produtos no carrinho'}
                </p>
                <p className="text-[11px] text-slate-400">Continue adicionando ou finalize a cotação</p>
              </div>
            </div>
            <button
              onClick={() => navigate('cart')}
              className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
            >
              <span>Ver Carrinho</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
