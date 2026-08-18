import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { 
  UploadCloud, 
  FileSpreadsheet, 
  Image as ImageIcon, 
  CheckCircle2, 
  AlertCircle, 
  Download, 
  X, 
  Layers, 
  HelpCircle, 
  RefreshCw, 
  Check, 
  ArrowRight,
  Sparkles,
  Info
} from 'lucide-react';
import { Button } from './Button';
import { Product } from '../types';
import { productService } from '../services/api';

interface ProductImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  existingProducts?: Product[];
}

interface ParsedProductRow {
  id?: string;
  code: string;
  description: string;
  reference: string;
  line: string;
  category: string;
  subcategory: string;
  colors: string[];
  amperage: string;
  details: string;
  imageUrl: string;
  matchedPhotoName?: string;
  status: 'valid' | 'warning' | 'error';
  statusMessage?: string;
  isExisting?: boolean;
}

export const ProductImportModal: React.FC<ProductImportModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  existingProducts = []
}) => {
  const [activeStep, setActiveStep] = useState<'upload' | 'photos' | 'preview' | 'result'>('upload');
  const [parsedRows, setParsedRows] = useState<ParsedProductRow[]>([]);
  const [uploadedPhotos, setUploadedPhotos] = useState<Map<string, string>>(new Map()); // filename -> base64
  const [fileName, setFileName] = useState<string>('');
  const [updateExisting, setUpdateExisting] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [importStats, setImportStats] = useState<{ total: number; inserted: number; updated: number; errors: string[] } | null>(null);
  const [showHelpGuide, setShowHelpGuide] = useState<boolean>(false);
  const [dragActiveExcel, setDragActiveExcel] = useState<boolean>(false);
  const [dragActivePhotos, setDragActivePhotos] = useState<boolean>(false);

  const excelInputRef = useRef<HTMLInputElement>(null);
  const photosInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Modelo de exemplo pronto para download
  const sampleTemplateData = [
    {
      'Código': 'DIC-1001',
      'Código EAN': '7898523691011',
      'Descrição / Nome': 'Tomada 2P+T 10A 250V Branca',
      'Linha': 'Novara',
      'Categoria': 'Tomadas',
      'Subcategoria': 'Módulos',
      'Cores': 'Branco, Preto, Grafite',
      'Amperagem': '10A',
      'Especificações Técnicas': 'Tomada padrão brasileiro NBR 14136, fabricada em termoplástico anti-chama de alta resistência.',
      'URL da Imagem / Foto': 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=500'
    },
    {
      'Código': 'DIC-1002',
      'Código EAN': '7898523691028',
      'Descrição / Nome': 'Interruptor Simples 10A 250V Preto',
      'Linha': 'Novara',
      'Categoria': 'Interruptores',
      'Subcategoria': 'Módulos',
      'Cores': 'Preto, Ouro, Champanhe',
      'Amperagem': '10A',
      'Especificações Técnicas': 'Interruptor de toque suave com contatos em liga de prata para maior durabilidade.',
      'URL da Imagem / Foto': ''
    },
    {
      'Código': 'DIC-2001',
      'Código EAN': '7898523692018',
      'Descrição / Nome': 'Placa 4x2 com Suporte 3 Postos Grafite',
      'Linha': 'Classic',
      'Categoria': 'Placas',
      'Subcategoria': '4x2',
      'Cores': 'Grafite, Branco, Fendi',
      'Amperagem': 'N/A',
      'Especificações Técnicas': 'Placa com acabamento acetinado de alto padrão e proteção contra raios UV.',
      'URL da Imagem / Foto': ''
    }
  ];

  // Baixar Planilha Modelo em formato Excel (.xlsx)
  const handleDownloadExcelTemplate = () => {
    try {
      const ws = XLSX.utils.json_to_sheet(sampleTemplateData);
      
      // Ajuste de largura das colunas
      ws['!cols'] = [
        { wch: 15 }, // Código
        { wch: 18 }, // Código EAN
        { wch: 35 }, // Descrição
        { wch: 18 }, // Linha
        { wch: 18 }, // Categoria
        { wch: 18 }, // Subcategoria
        { wch: 25 }, // Cores
        { wch: 15 }, // Amperagem
        { wch: 45 }, // Especificações Técnicas
        { wch: 35 }, // URL Imagem
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Produtos Dicompel');
      XLSX.writeFile(wb, 'modelo_importacao_produtos_dicompel.xlsx');
    } catch (err) {
      console.error('Erro ao gerar Excel:', err);
      // Fallback para CSV se houver qualquer problema
      handleDownloadCSVTemplate();
    }
  };

  // Baixar Modelo em formato CSV
  const handleDownloadCSVTemplate = () => {
    const headers = ['Código', 'Código EAN', 'Descrição / Nome', 'Linha', 'Categoria', 'Subcategoria', 'Cores', 'Amperagem', 'Especificações Técnicas', 'URL da Imagem / Foto'];
    const rows = sampleTemplateData.map(item => [
      `"${item['Código']}"`,
      `"${item['Código EAN']}"`,
      `"${item['Descrição / Nome']}"`,
      `"${item['Linha']}"`,
      `"${item['Categoria']}"`,
      `"${item['Subcategoria']}"`,
      `"${item['Cores']}"`,
      `"${item['Amperagem']}"`,
      `"${item['Especificações Técnicas']}"`,
      `"${item['URL da Imagem / Foto']}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'modelo_importacao_produtos_dicompel.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Função para normalizar cabeçalho da planilha
  const normalizeKey = (key: string): string => {
    return key
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');
  };

  // Processar arquivo Excel / CSV
  const processExcelFile = async (file: File) => {
    setFileName(file.name);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const rawJson = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });

      if (rawJson.length === 0) {
        alert('A planilha selecionada está vazia. Por favor, adicione produtos.');
        return;
      }

      // Mapear colunas de forma inteligente
      const mapped: ParsedProductRow[] = rawJson.map((row, idx) => {
        let code = '';
        let reference = '';
        let description = '';
        let line = '';
        let category = '';
        let subcategory = '';
        let colorsStr = '';
        let amperage = '';
        let details = '';
        let imageUrl = '';

        for (const [key, val] of Object.entries(row)) {
          const norm = normalizeKey(key);
          const strVal = String(val !== undefined && val !== null ? val : '').trim();
          if (!strVal) continue;

          // 1. Código EAN / Código de Barras / Referência (checar primeiro para não conflitar com "codigo")
          if (
            norm.includes('ean') ||
            norm.includes('gtin') ||
            norm.includes('barra') ||
            norm.includes('referencia') ||
            norm === 'ref' ||
            norm === 'refabrica'
          ) {
            reference = strVal;
          }
          // 2. Código do Produto / Código Interno
          else if (
            norm === 'codigo' ||
            norm === 'cod' ||
            norm === 'code' ||
            norm === 'id' ||
            norm.includes('codigointerno') ||
            norm.includes('codigoproduto') ||
            norm.includes('codprod') ||
            norm.includes('coditem') ||
            (norm.includes('codigo') && !norm.includes('ean') && !norm.includes('barra'))
          ) {
            code = strVal;
          }
          // 3. Descrição / Nome
          else if (
            norm.includes('descricao') ||
            norm.includes('nome') ||
            norm === 'name' ||
            norm === 'produto' ||
            norm === 'item' ||
            norm.includes('desc')
          ) {
            description = strVal;
          }
          // 4. Linha / Coleção
          else if (
            norm === 'linha' ||
            norm === 'line' ||
            norm.includes('colecao') ||
            norm.includes('familia')
          ) {
            line = strVal;
          }
          // 5. Categoria
          else if (
            norm === 'categoria' ||
            norm === 'category' ||
            norm === 'tipo' ||
            norm.includes('grupo')
          ) {
            category = strVal;
          }
          // 6. Subcategoria
          else if (
            norm.includes('subcategoria') ||
            norm.includes('subcategory') ||
            norm.includes('subgrupo')
          ) {
            subcategory = strVal;
          }
          // 7. Cores / Acabamentos
          else if (
            norm.includes('cor') ||
            norm.includes('color') ||
            norm.includes('acabamento') ||
            norm.includes('tonalidade') ||
            norm.includes('pintura')
          ) {
            colorsStr = strVal;
          }
          // 8. Amperagem / Tensão / Voltagem / Corrente
          else if (
            norm.includes('amper') ||
            norm.includes('amp') ||
            norm.includes('tensao') ||
            norm.includes('voltag') ||
            norm.includes('corrente') ||
            norm.includes('volts') ||
            norm.includes('bivolt')
          ) {
            amperage = strVal;
          }
          // 9. Especificações Técnicas / Detalhes
          else if (
            norm.includes('especificac') ||
            norm.includes('detalhe') ||
            norm.includes('specs') ||
            norm.includes('tecnica') ||
            norm.includes('observac')
          ) {
            details = strVal;
          }
          // 10. Foto / Imagem
          else if (
            norm.includes('foto') ||
            norm.includes('imagem') ||
            norm.includes('image') ||
            norm.includes('url') ||
            norm.includes('link') ||
            norm.includes('img')
          ) {
            imageUrl = strVal;
          }
        }

        // Se não achou código explícito, tenta usar a referência/EAN
        if (!code && reference) code = reference;
        if (!reference && code) reference = code;

        // Tratar array de cores (aceita vírgula, ponto e vírgula, barra, hífen, pipe)
        const colors = colorsStr 
          ? colorsStr.split(/[,;\/\|\n\r\t]+/).map(c => c.trim()).filter(Boolean)
          : [];

        // Auto-detectar amperagem da descrição se o campo veio vazio
        if (!amperage && description) {
          const ampMatch = description.match(/\b(10A|20A|10\/20A|10 A|20 A|16A|25A|32A|Bivolt|127V|220V|250V)\b/i);
          if (ampMatch) {
            amperage = ampMatch[1].toUpperCase().replace(/\s+/g, '');
          }
        }

        // Validar e verificar se já existe
        const isExisting = existingProducts.some(p => 
          (p.code && code && p.code.toLowerCase().trim() === code.toLowerCase().trim()) ||
          (p.reference && reference && p.reference.toLowerCase().trim() === reference.toLowerCase().trim())
        );

        let status: 'valid' | 'warning' | 'error' = 'valid';
        let statusMessage = 'Pronto para cadastrar';

        if (!description && !code) {
          status = 'error';
          statusMessage = 'Linha sem código e sem descrição';
        } else if (!code) {
          status = 'warning';
          statusMessage = 'Código ausente (gerará código automático)';
        } else if (isExisting) {
          status = 'warning';
          statusMessage = 'Produto já cadastrado (atualizará)';
        }

        return {
          code: code || `PROD-${idx + 1}`,
          description: description || `Produto ${idx + 1}`,
          reference: reference || code || '',
          line: line || 'Geral',
          category: category || 'Outros',
          subcategory: subcategory || '',
          colors,
          amperage: amperage || '',
          details: details || '',
          imageUrl: imageUrl || '',
          status,
          statusMessage,
          isExisting
        };
      });

      setParsedRows(mapped);
      setActiveStep('photos');
    } catch (err: any) {
      console.error('Erro ao ler planilha:', err);
      alert(`Erro ao processar o arquivo Excel: ${err.message || 'Formato inválido'}`);
    }
  };

  // Tratar upload de múltiplas fotos
  const handlePhotosUpload = async (files: FileList | File[]) => {
    const newPhotosMap = new Map(uploadedPhotos);
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) continue;

      const baseName = file.name.substring(0, file.name.lastIndexOf('.')).toLowerCase().trim();
      const dataUrl = await readFileAsDataURL(file);
      newPhotosMap.set(baseName, dataUrl);
    }

    setUploadedPhotos(newPhotosMap);

    // Auto-vincular fotos aos produtos importados pelo Código ou Referência
    setParsedRows(prevRows => prevRows.map(row => {
      const rowCode = (row.code || '').toLowerCase().trim();
      const rowRef = (row.reference || '').toLowerCase().trim();
      
      let matchedUrl = row.imageUrl;
      let matchedName = row.matchedPhotoName;

      // Procura foto que coincida com o código ou referência
      for (const [photoKey, photoDataUrl] of newPhotosMap.entries()) {
        if (photoKey === rowCode || photoKey === rowRef || photoKey.includes(rowCode) || (rowCode && photoKey.endsWith(rowCode))) {
          matchedUrl = photoDataUrl;
          matchedName = photoKey;
          break;
        }
      }

      return {
        ...row,
        imageUrl: matchedUrl,
        matchedPhotoName: matchedName
      };
    }));
  };

  const readFileAsDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Executar a importação final
  const handleExecuteImport = async () => {
    if (parsedRows.length === 0) return;
    setIsProcessing(true);

    try {
      const productsToImport = parsedRows.map(r => ({
        code: r.code,
        description: r.description,
        reference: r.reference || r.code,
        category: r.category,
        line: r.line,
        subcategory: r.subcategory,
        colors: r.colors,
        amperage: r.amperage,
        details: r.details,
        imageUrl: r.imageUrl
      }));

      const res = await productService.createBatch(productsToImport, updateExisting);
      setImportStats(res);
      setActiveStep('result');
      onSuccess();
    } catch (err: any) {
      console.error('Erro na importação:', err);
      alert(`Falha durante a importação: ${err.message || 'Erro no servidor'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const resetAll = () => {
    setActiveStep('upload');
    setParsedRows([]);
    setUploadedPhotos(new Map());
    setFileName('');
    setImportStats(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 text-white rounded-3xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in duration-200">
        
        {/* Header Modal */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black uppercase tracking-wider text-white">Importar Produtos e Fotos</h3>
                <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">Excel / CSV</span>
              </div>
              <p className="text-xs text-slate-400">Cadastro e atualização em massa no banco de dados com fotos</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowHelpGuide(!showHelpGuide)}
              className="text-xs border-slate-700 hover:bg-slate-800 text-slate-300 gap-1.5"
            >
              <HelpCircle className="w-4 h-4 text-blue-400" />
              {showHelpGuide ? 'Ocultar Guia' : 'Como Preencher'}
            </Button>
            <button 
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Guia de Ajuda e Exemplo Expansível */}
        {showHelpGuide && (
          <div className="p-6 bg-slate-950/90 border-b border-slate-800 space-y-4 max-h-80 overflow-y-auto">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Info className="w-4 h-4 text-blue-400" />
                  Estrutura e Posição das Colunas na Planilha Excel
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  O importador reconhece automaticamente os nomes das colunas. Você pode baixar nosso modelo pronto abaixo.
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleDownloadExcelTemplate} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-2 font-bold">
                  <Download className="w-3.5 h-3.5" />
                  Baixar Modelo Excel (.xlsx)
                </Button>
                <Button size="sm" variant="outline" onClick={handleDownloadCSVTemplate} className="border-slate-700 text-xs gap-1.5">
                  .CSV
                </Button>
              </div>
            </div>

            {/* Tabela Exemplo com as Colunas */}
            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-slate-800/80 text-slate-300 uppercase font-black">
                  <tr>
                    <th className="p-2.5">Código *</th>
                    <th className="p-2.5">Código EAN</th>
                    <th className="p-2.5">Descrição / Nome *</th>
                    <th className="p-2.5">Linha *</th>
                    <th className="p-2.5">Categoria *</th>
                    <th className="p-2.5">Subcategoria</th>
                    <th className="p-2.5">Cores</th>
                    <th className="p-2.5">Amperagem</th>
                    <th className="p-2.5">Foto (URL)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-400">
                  <tr>
                    <td className="p-2.5 font-mono text-emerald-400 font-bold">DIC-1001</td>
                    <td className="p-2.5 font-mono text-slate-300">7898523691011</td>
                    <td className="p-2.5 text-white font-medium">Tomada 2P+T 10A Branca</td>
                    <td className="p-2.5 text-blue-400 font-bold">Novara</td>
                    <td className="p-2.5 text-purple-400 font-bold">Tomadas</td>
                    <td className="p-2.5">Módulos</td>
                    <td className="p-2.5">Branco, Preto</td>
                    <td className="p-2.5">10A</td>
                    <td className="p-2.5 text-slate-500 truncate max-w-[120px]">https://...</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-mono text-emerald-400 font-bold">DIC-1002</td>
                    <td className="p-2.5 font-mono text-slate-300">7898523691028</td>
                    <td className="p-2.5 text-white font-medium">Interruptor Simples Preto</td>
                    <td className="p-2.5 text-blue-400 font-bold">Novara</td>
                    <td className="p-2.5 text-purple-400 font-bold">Interruptores</td>
                    <td className="p-2.5">Módulos</td>
                    <td className="p-2.5">Preto, Ouro</td>
                    <td className="p-2.5">10A</td>
                    <td className="p-2.5 text-slate-500">(ou envie foto no passo 2)</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Dicas adicionais de fotos */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                <span className="font-bold text-amber-400 block mb-1">📸 Dica para Importação de Fotos:</span>
                <p className="text-slate-400">
                  Basta nomear os arquivos de fotos com o mesmo código do produto (ex: <code className="text-emerald-400 font-mono">DIC-1001.jpg</code>). No Passo 2, você arrasta todas as fotos juntas e o sistema vincula cada foto automaticamente ao produto correspondente!
                </p>
              </div>
              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                <span className="font-bold text-blue-400 block mb-1">🎨 Dica para Cores Múltiplas:</span>
                <p className="text-slate-400">
                  Na coluna <strong>Cores</strong>, separe com vírgula (ex: <code className="text-blue-300">Branco, Preto, Grafite, Ouro</code>). Elas virarão tags clicáveis no catálogo e filtros.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Stepper Navigation */}
        <div className="px-6 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto py-1">
            <button
              onClick={() => parsedRows.length > 0 && setActiveStep('upload')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl font-bold transition-all ${
                activeStep === 'upload' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-slate-800 text-[10px] flex items-center justify-center font-black">1</span>
              Planilha Excel
            </button>

            <ArrowRight className="w-4 h-4 text-slate-700 shrink-0" />

            <button
              onClick={() => parsedRows.length > 0 && setActiveStep('photos')}
              disabled={parsedRows.length === 0}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl font-bold transition-all disabled:opacity-40 ${
                activeStep === 'photos' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-slate-800 text-[10px] flex items-center justify-center font-black">2</span>
              Fotos dos Produtos ({uploadedPhotos.size})
            </button>

            <ArrowRight className="w-4 h-4 text-slate-700 shrink-0" />

            <button
              onClick={() => parsedRows.length > 0 && setActiveStep('preview')}
              disabled={parsedRows.length === 0}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl font-bold transition-all disabled:opacity-40 ${
                activeStep === 'preview' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-slate-800 text-[10px] flex items-center justify-center font-black">3</span>
              Conferir e Salvar ({parsedRows.length})
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleDownloadExcelTemplate}
              className="text-[11px] border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 font-bold gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              Baixar Modelo Excel
            </Button>
          </div>
        </div>

        {/* Modal Body Content by Step */}
        <div className="flex-1 p-6 overflow-y-auto space-y-6 min-h-[350px]">
          
          {/* PASSO 1: UPLOAD DO EXCEL */}
          {activeStep === 'upload' && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 bg-slate-800/40 rounded-2xl border border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400">
                    <FileSpreadsheet className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Precisa do modelo padrão da planilha?</h4>
                    <p className="text-xs text-slate-400">Baixe o modelo com cabeçalhos prontos e exemplos preenchidos para não errar.</p>
                  </div>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                  <Button
                    onClick={handleDownloadExcelTemplate}
                    className="flex-1 md:flex-none bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-2 py-2.5"
                  >
                    <Download className="w-4 h-4" />
                    Baixar Planilha Modelo (.xlsx)
                  </Button>
                </div>
              </div>

              {/* Drag and Drop Box for Excel */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragActiveExcel(true); }}
                onDragLeave={() => setDragActiveExcel(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragActiveExcel(false);
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    processExcelFile(e.dataTransfer.files[0]);
                  }
                }}
                onClick={() => excelInputRef.current?.click()}
                className={`border-2 border-dashed rounded-3xl p-8 md:p-12 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-4 ${
                  dragActiveExcel 
                    ? 'border-emerald-500 bg-emerald-500/10 scale-[1.01]' 
                    : 'border-slate-700 bg-slate-900/50 hover:border-slate-500 hover:bg-slate-800/50'
                }`}
              >
                <input
                  ref={excelInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      processExcelFile(e.target.files[0]);
                    }
                  }}
                />

                <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-inner">
                  <UploadCloud className="w-8 h-8" />
                </div>

                <div className="space-y-1 max-w-md">
                  <h4 className="text-base font-bold text-white">
                    Clique para selecionar ou arraste sua planilha aqui
                  </h4>
                  <p className="text-xs text-slate-400">
                    Formatos aceitos: <strong>.xlsx, .xls, .csv</strong> (Microsoft Excel, Google Planilhas, Calc)
                  </p>
                </div>

                <Button size="sm" className="bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs uppercase tracking-wider px-6">
                  Selecionar Arquivo do Computador
                </Button>
              </div>

              {parsedRows.length > 0 && (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <div>
                      <p className="text-xs font-bold text-emerald-300">
                        {fileName}: <strong>{parsedRows.length} produtos</strong> identificados com sucesso!
                      </p>
                      <p className="text-[11px] text-emerald-400/80">
                        Você pode avançar para adicionar fotos ou revisar os itens.
                      </p>
                    </div>
                  </div>
                  <Button size="sm" onClick={() => setActiveStep('photos')} className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold gap-2">
                    Próximo: Importar Fotos
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* PASSO 2: UPLOAD DE FOTOS MÚLTIPLAS */}
          {activeStep === 'photos' && (
            <div className="space-y-6">
              <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-blue-500/20 rounded-xl text-blue-400">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-blue-300">Vinculação Inteligente de Fotos por Código</h4>
                    <p className="text-xs text-slate-400">
                      Envie as fotos dos produtos (ex: <code className="text-emerald-400 font-mono">DIC-1001.jpg</code>). O sistema detecta o código no nome do arquivo e vincula automaticamente!
                    </p>
                  </div>
                </div>
                <div className="text-xs font-bold text-blue-400 bg-blue-500/20 px-3 py-1.5 rounded-lg shrink-0">
                  {uploadedPhotos.size} fotos carregadas
                </div>
              </div>

              {/* Upload Box for Images */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragActivePhotos(true); }}
                onDragLeave={() => setDragActivePhotos(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragActivePhotos(false);
                  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    handlePhotosUpload(e.dataTransfer.files);
                  }
                }}
                onClick={() => photosInputRef.current?.click()}
                className={`border-2 border-dashed rounded-3xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 ${
                  dragActivePhotos 
                    ? 'border-blue-500 bg-blue-500/10 scale-[1.01]' 
                    : 'border-slate-700 bg-slate-900/50 hover:border-slate-500 hover:bg-slate-800/50'
                }`}
              >
                <input
                  ref={photosInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      handlePhotosUpload(e.target.files);
                    }
                  }}
                />

                <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  <ImageIcon className="w-7 h-7" />
                </div>

                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-white">
                    Clique para selecionar ou arraste várias fotos de uma vez
                  </h4>
                  <p className="text-xs text-slate-400">
                    Aceita PNG, JPG, WEBP. Selecione dezenas ou centenas de imagens de uma vez.
                  </p>
                </div>

                <Button size="sm" className="bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs">
                  Selecionar Fotos (JPG/PNG)
                </Button>
              </div>

              {/* Preview das Fotos vinculadas aos produtos */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">
                    Status das Fotos por Produto ({parsedRows.filter(r => Boolean(r.imageUrl)).length} de {parsedRows.length} com foto)
                  </h4>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 max-h-64 overflow-y-auto p-1">
                  {parsedRows.slice(0, 18).map((row, idx) => (
                    <div key={idx} className="bg-slate-800/60 border border-slate-700 rounded-xl p-2.5 flex flex-col items-center text-center gap-2">
                      <div className="w-14 h-14 rounded-lg bg-slate-900 flex items-center justify-center overflow-hidden border border-slate-700 shrink-0">
                        {row.imageUrl ? (
                          <img src={row.imageUrl} alt={row.description} className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon className="w-6 h-6 text-slate-600" />
                        )}
                      </div>
                      <div className="w-full">
                        <span className="font-mono text-[10px] font-bold text-emerald-400 truncate block">{row.code}</span>
                        <span className="text-[10px] text-slate-300 truncate block">{row.description}</span>
                      </div>
                      {row.imageUrl ? (
                        <span className="text-[9px] bg-emerald-500/20 text-emerald-300 font-bold px-1.5 py-0.5 rounded">
                          ✓ Foto vinculada
                        </span>
                      ) : (
                        <span className="text-[9px] bg-slate-700 text-slate-400 font-bold px-1.5 py-0.5 rounded">
                          Sem foto
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                {parsedRows.length > 18 && (
                  <p className="text-[11px] text-slate-500 text-center">+ {parsedRows.length - 18} outros produtos na lista</p>
                )}
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-slate-800">
                <Button variant="outline" size="sm" onClick={() => setActiveStep('upload')} className="border-slate-700 text-xs">
                  Voltar para Planilha
                </Button>
                <Button size="sm" onClick={() => setActiveStep('preview')} className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs gap-2">
                  Avançar para Conferência
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* PASSO 3: PRÉ-VISUALIZAÇÃO E CONFIRMAÇÃO */}
          {activeStep === 'preview' && (
            <div className="space-y-6">
              {/* Opções de Importação */}
              <div className="p-4 bg-slate-800/40 rounded-2xl border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={updateExisting}
                    onChange={(e) => setUpdateExisting(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 bg-slate-900 border-slate-700 focus:ring-blue-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-white block">Atualizar produtos que já existirem com o mesmo código</span>
                    <span className="text-[11px] text-slate-400 block">Se desmarcado, produtos com código duplicado serão mantidos sem alteração.</span>
                  </div>
                </label>

                <div className="flex items-center gap-2 text-xs font-bold">
                  <span className="text-emerald-400">{parsedRows.filter(r => !r.isExisting).length} Novos</span>
                  <span className="text-slate-600">|</span>
                  <span className="text-amber-400">{parsedRows.filter(r => r.isExisting).length} Existentes</span>
                </div>
              </div>

              {/* Tabela de Revisão */}
              <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/60 max-h-80">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-800 text-[10px] font-black uppercase text-slate-300 sticky top-0">
                    <tr>
                      <th className="p-3 w-12 text-center">Foto</th>
                      <th className="p-3">Código</th>
                      <th className="p-3">Código EAN</th>
                      <th className="p-3">Descrição</th>
                      <th className="p-3">Linha</th>
                      <th className="p-3">Categoria</th>
                      <th className="p-3">Amperagem</th>
                      <th className="p-3">Cores</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {parsedRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                        <td className="p-2 text-center">
                          <div className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center overflow-hidden border border-slate-700 mx-auto">
                            {row.imageUrl ? (
                              <img src={row.imageUrl} alt={row.description} className="w-full h-full object-cover" />
                            ) : (
                              <ImageIcon className="w-4 h-4 text-slate-600" />
                            )}
                          </div>
                        </td>
                        <td className="p-3 font-mono font-bold text-emerald-400">{row.code}</td>
                        <td className="p-3 font-mono text-[11px] text-slate-400">{row.reference || '-'}</td>
                        <td className="p-3 font-medium text-white max-w-[200px] truncate">{row.description}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 font-bold text-[10px]">
                            {row.line}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 font-bold text-[10px]">
                            {row.category}
                          </span>
                        </td>
                        <td className="p-3">
                          {row.amperage ? (
                            <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 font-bold text-[10px]">
                              {row.amperage}
                            </span>
                          ) : (
                            <span className="text-slate-600 text-[11px]">-</span>
                          )}
                        </td>
                        <td className="p-3 max-w-[150px] truncate text-[11px] text-slate-400">
                          {row.colors.length > 0 ? (
                            <span className="text-emerald-300 font-medium">{row.colors.join(', ')}</span>
                          ) : (
                            <span className="text-slate-600">-</span>
                          )}
                        </td>
                        <td className="p-3">
                          {row.isExisting ? (
                            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                              🔄 Atualizará
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                              ✨ Novo Produto
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-slate-800">
                <Button variant="outline" size="sm" onClick={() => setActiveStep('photos')} className="border-slate-700 text-xs">
                  Voltar para Fotos
                </Button>

                <div className="flex items-center gap-3">
                  <Button variant="outline" size="sm" onClick={resetAll} className="border-slate-700 text-xs text-slate-400">
                    Limpar
                  </Button>
                  <Button
                    onClick={handleExecuteImport}
                    disabled={isProcessing}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider px-6 py-3 shadow-lg shadow-emerald-900/30 gap-2"
                  >
                    {isProcessing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Importando no Banco...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        Gravar {parsedRows.length} Produtos no Banco
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* PASSO 4: RELATÓRIO DE SUCESSO */}
          {activeStep === 'result' && importStats && (
            <div className="py-8 text-center space-y-6 max-w-lg mx-auto">
              <div className="w-20 h-20 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mx-auto">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-black text-white">Importação Concluída com Sucesso!</h3>
                <p className="text-xs text-slate-400">
                  Os produtos e suas respectivas fotos foram processados e já estão disponíveis no Catálogo e Estoque.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="p-4 bg-slate-800/80 border border-slate-700 rounded-2xl">
                  <span className="text-2xl font-black text-white block">{importStats.total}</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Processados</span>
                </div>
                <div className="p-4 bg-emerald-950/40 border border-emerald-800/50 rounded-2xl">
                  <span className="text-2xl font-black text-emerald-400 block">{importStats.inserted}</span>
                  <span className="text-[10px] font-bold text-emerald-400 uppercase">Novos Criados</span>
                </div>
                <div className="p-4 bg-blue-950/40 border border-blue-800/50 rounded-2xl">
                  <span className="text-2xl font-black text-blue-400 block">{importStats.updated}</span>
                  <span className="text-[10px] font-bold text-blue-400 uppercase">Atualizados</span>
                </div>
              </div>

              {importStats.errors && importStats.errors.length > 0 && (
                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-left text-xs space-y-1">
                  <span className="font-bold text-amber-400 block">Avisos durante a importação:</span>
                  {importStats.errors.map((e, idx) => (
                    <p key={idx} className="text-slate-400 text-[11px]">• {e}</p>
                  ))}
                </div>
              )}

              <Button
                onClick={() => {
                  onClose();
                  resetAll();
                }}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase tracking-wider py-4 rounded-xl"
              >
                Concluir e Ver Produtos
              </Button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
