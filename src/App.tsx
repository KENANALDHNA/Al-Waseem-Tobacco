/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  Plus, 
  Trash2, 
  Save, 
  Search, 
  TrendingUp, 
  Package, 
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Edit2,
  Settings,
  X,
  Eye,
  EyeOff,
  Download,
  Printer,
  Check,
  Layout,
  Type
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { TableVirtuoso } from 'react-virtuoso';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import type { Category, Product } from './types';

const columnHelper = createColumnHelper<Product>();

export default function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [globalRate, setGlobalRate] = useState<number>(() => {
    const saved = localStorage.getItem('globalExchangeRate');
    return saved ? Number(saved) : 11700;
  });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, productId: number } | null>(null);
  const [fontSize, setFontSize] = useState(14);
  const [showHidden, setShowHidden] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const DEFAULT_COLUMNS = ['name', 'syp_final', 'cost_usd', 'profit_syp', 'wholesale_carton_usd', 'lsg', 'case_usd', 'wholesale_case_usd'];
  const DEFAULT_VISIBLE = ['name', 'syp_final', 'cost_usd', 'profit_syp', 'wholesale_carton_usd', 'lsg'];

  const [columnOrder, setColumnOrder] = useState<string[]>(() => {
    const saved = localStorage.getItem('columnOrder');
    if (!saved) return DEFAULT_COLUMNS;
    try {
      const parsed = JSON.parse(saved);
      // Ensure all default columns are present even if they were added later
      const merged = [...parsed];
      DEFAULT_COLUMNS.forEach(col => {
        if (!merged.includes(col)) merged.push(col);
      });
      return merged;
    } catch {
      return DEFAULT_COLUMNS;
    }
  });

  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    const saved = localStorage.getItem('visibleColumns');
    if (!saved) return DEFAULT_VISIBLE;
    try {
      const parsed = JSON.parse(saved);
      // If it's empty or missing essential columns, reset it
      if (parsed.length === 0 || !parsed.includes('name')) return DEFAULT_VISIBLE;
      return parsed;
    } catch {
      return DEFAULT_VISIBLE;
    }
  });

  const resetTableSettings = () => {
    console.log('Resetting table settings...');
    if (window.confirm('هل أنت متأكد من إعادة تعيين ترتيب وظهور الأعمدة؟')) {
      setColumnOrder(DEFAULT_COLUMNS);
      setVisibleColumns(DEFAULT_VISIBLE);
      localStorage.removeItem('columnOrder');
      localStorage.removeItem('visibleColumns');
      alert('تمت إعادة تعيين الأعمدة بنجاح');
    }
  };

  const resetAllSettings = () => {
    console.log('Resetting all settings...');
    if (window.confirm('هل أنت متأكد من مسح جميع الإعدادات المحلية؟ سيتم إعادة تعيين سعر الصرف، حجم الخط، وترتيب الأعمدة.')) {
      localStorage.clear();
      window.location.reload();
    }
  };

  useEffect(() => {
    localStorage.setItem('visibleColumns', JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  useEffect(() => {
    localStorage.setItem('columnOrder', JSON.stringify(columnOrder));
  }, [columnOrder]);

  const [editValues, setEditValues] = useState<{ 
    name: string, 
    cost_usd: string, 
    profit_syp: string,
    wholesale_carton_usd: string
  } | null>(null);

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  // New Product Form State
  const [newProduct, setNewProduct] = useState({
    name: '',
    category_id: 1,
    cost_usd: 0,
    profit_syp: 500,
    wholesale_carton_usd: 0
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [prodRes, catRes, rateRes] = await Promise.all([
        fetch('/api/products'),
        fetch('/api/categories'),
        fetch('/api/settings/global-rate')
      ]);
      const prodData = await prodRes.json();
      const catData = await catRes.json();
      const { rate } = await rateRes.json();
      
      setProducts(prodData);
      setCategories(catData);
      
      // Sync rate: Server is source of truth if localStorage is empty
      if (rate && !localStorage.getItem('globalExchangeRate')) {
        setGlobalRate(rate);
        localStorage.setItem('globalExchangeRate', rate.toString());
      } else if (localStorage.getItem('globalExchangeRate')) {
        setGlobalRate(Number(localStorage.getItem('globalExchangeRate')));
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const parseNumber = (val: any): number => {
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'number') return val;
    // Replace comma with dot and remove non-numeric characters except dot
    const cleaned = val.toString().replace(/,/g, '.').replace(/[^0-9.]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  };

  const handleUpdateProduct = useCallback(async (id: number, updates: Partial<Product>) => {
    try {
      setProducts(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));

      await fetch(`/api/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
    } catch (error) {
      console.error('Error updating product:', error);
      fetchData(); // Rollback on error
    }
  }, []); // Stable dependency

  const handleDeleteProduct = useCallback(async (id: number) => {
    if (!confirm('هل أنت متأكد من حذف هذه المادة؟')) return;
    try {
      await fetch(`/api/products/${id}`, { method: 'DELETE' });
      setProducts(prev => prev.filter(p => p.id !== id));
      setContextMenu(null);
    } catch (error) {
      console.error('Error deleting product:', error);
    }
  }, []);

  const handleAddProduct = async () => {
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProduct)
      });
      await res.json();
      await fetchData(); 
      setShowAddModal(false);
      setNewProduct({ name: '', category_id: 1, cost_usd: 0, profit_syp: 500, wholesale_carton_usd: 0 });
    } catch (error) {
      console.error('Error adding product:', error);
    }
  };

  const handleUpdateGlobalRate = async () => {
    try {
      const rateToSave = Number(globalRate) || 0;
      localStorage.setItem('globalExchangeRate', rateToSave.toString());
      
      await fetch('/api/settings/global-rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rate: rateToSave })
      });
      // Update local products state to reflect the new rate immediately
      setProducts(prev => prev.map(p => ({ ...p, exchange_rate: rateToSave })));
      // Also refresh to be sure
      await fetchData();
    } catch (error) {
      console.error('Error updating global rate:', error);
    }
  };

  const handleExportImage = async () => {
    const tableElement = document.getElementById('export-container');
    if (!tableElement) return;
    setIsExporting(true);
    // Ensure it's visible for capture but still off-screen
    tableElement.style.display = 'block';
    try {
      const canvas = await html2canvas(tableElement, {
        scale: 3,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        windowWidth: 800
      });
      const link = document.createElement('a');
      link.download = `tobacco-prices-${new Date().toISOString().split('T')[0]}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Export error:', error);
      alert('حدث خطأ أثناء تصدير الصورة. يرجى المحاولة مرة أخرى.');
    } finally {
      tableElement.style.display = 'none';
      setIsExporting(false);
    }
  };

  const handleExportPDF = async () => {
    const tableElement = document.getElementById('export-container');
    if (!tableElement) return;
    setIsExporting(true);
    tableElement.style.display = 'block';
    try {
      const canvas = await html2canvas(tableElement, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        windowWidth: 800,
        onclone: (clonedDoc) => {
          const el = clonedDoc.getElementById('export-container');
          if (el) el.style.display = 'block';
        }
      });
      
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      
      const pdfWidth = 78;
      const pdfPageHeight = 311;
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      
      // Calculate how much height on the image corresponds to one page height in PDF
      const imgPageHeightInPixels = (pdfPageHeight * imgWidth) / pdfWidth;
      
      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: [pdfWidth, pdfPageHeight],
        compress: true
      });
      
      const totalPages = Math.ceil(imgHeight / imgPageHeightInPixels);
      const pdfImgHeight = (imgHeight * pdfWidth) / imgWidth;

      for (let i = 0; i < totalPages; i++) {
        if (i > 0) pdf.addPage([pdfWidth, pdfPageHeight], 'p');
        
        const position = -(pdfPageHeight * i);
        pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfImgHeight, undefined, 'FAST');
      }
      
      pdf.save(`مركز-الوسيم-${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('PDF Export error:', error);
      alert('حدث خطأ أثناء تصدير PDF. يرجى المحاولة مرة أخرى.');
    } finally {
      tableElement.style.display = 'none';
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    alert('عذراً، الطباعة المباشرة معطلة في هذا المتصفح لأسباب أمنية. يرجى استخدام خيار "تصدير PDF" ثم طباعة الملف الناتج.');
  };

  const handleReorderCategories = async (newCategories: Category[]) => {
    try {
      const orders = newCategories.map((cat, index) => ({ id: cat.id, sort_order: index }));
      await fetch('/api/categories/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orders })
      });
      setCategories(newCategories);
      await fetchData(); // Refresh products to get new sort orders
    } catch (error) {
      console.error('Error reordering categories:', error);
    }
  };

  const calculateSYP = useCallback((product: Product) => {
    const rate = Number(globalRate) || 0;
    const costUsd = Number(product.cost_usd) || Number(product.carton_usd) || 0;
    const profit = Number(product.profit_syp) || 0;
    const base = (costUsd * rate) + profit;
    const result = Math.round(base / 500) * 500;
    return isNaN(result) ? 0 : result;
  }, [globalRate]);

  // Group and sort products
  const groupedData = useMemo(() => {
    const groups: { [key: string]: Product[] } = {};
    
    // Sort products by category sort order first, then by product name
    const sorted = [...products].sort((a, b) => {
      const catComp = (a.category_sort_order || 0) - (b.category_sort_order || 0);
      if (catComp !== 0) return catComp;
      return (a.name || '').localeCompare(b.name || '');
    });

    const filtered = sorted.filter(p => {
      const nameMatch = p.name?.toLowerCase().includes(searchQuery.toLowerCase());
      const catMatch = p.category_name?.toLowerCase().includes(searchQuery.toLowerCase());
      const categoryFilterMatch = selectedCategory === 'all' || p.category_name === selectedCategory;
      const visibilityMatch = showHidden || !p.is_hidden;
      return (nameMatch || catMatch) && categoryFilterMatch && visibilityMatch;
    });

    filtered.forEach(p => {
      const cat = p.category_name || 'غير مصنف';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(p);
    });

    // Maintain the order of categories based on their sort_order from the database
    const orderedCategories = categories
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(c => c.name)
      .filter(name => groups[name]);

    // Add 'غير مصنف' if it exists in groups but not in categories
    if (groups['غير مصنف'] && !orderedCategories.includes('غير مصنف')) {
      orderedCategories.push('غير مصنف');
    }

    const orderedProducts = orderedCategories.flatMap(cat => groups[cat]);

    return {
      categories: orderedCategories,
      products: orderedProducts,
      counts: orderedCategories.map(cat => groups[cat].length)
    };
  }, [products, categories, searchQuery, selectedCategory, showHidden]);

  const columns = useMemo(() => [
    columnHelper.accessor('name', {
      id: 'name',
      header: 'اسم المادة',
      cell: info => {
        const product = info.row.original;
        const isEditing = editingId === product.id;
        const meta = info.table.options.meta as any;
        return isEditing ? (
          <input 
            type="text" 
            className="w-full p-1 border-2 border-emerald-500 rounded text-right text-sm outline-none bg-white font-bold"
            value={meta?.editValues?.name || ''}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const ev = meta?.editValues;
                if (ev) {
                  handleUpdateProduct(product.id, { 
                    name: ev.name, 
                    cost_usd: parseNumber(ev.cost_usd),
                    profit_syp: parseNumber(ev.profit_syp),
                    wholesale_carton_usd: parseNumber(ev.wholesale_carton_usd)
                  });
                }
                setEditingId(null);
                meta?.setEditValues(null);
              } else if (e.key === 'Escape') {
                setEditingId(null);
                meta?.setEditValues(null);
              }
            }}
            onChange={(e) => meta?.setEditValues((prev: any) => prev ? { ...prev, name: e.target.value } : null)}
          />
        ) : (
          <span className="text-sm font-bold text-zinc-800">{product.name}</span>
        );
      },
      meta: { className: 'text-right min-w-[200px]' }
    }),
    columnHelper.display({
      id: 'syp_final',
      header: 'ل.س.ق (النهائي)',
      cell: info => {
        const product = info.row.original;
        const sypPrice = calculateSYP(product);
        
        return (
          <div className="flex flex-col">
            <span className="text-sm font-black text-emerald-700">{sypPrice.toLocaleString()}</span>
            {product.is_hidden === 1 && <span className="text-[8px] text-red-500 font-black uppercase tracking-tighter">مخفي</span>}
          </div>
        );
      },
      meta: { className: 'text-center min-w-[120px] font-mono font-bold bg-emerald-50/50' }
    }),
    columnHelper.accessor('cost_usd', {
      id: 'cost_usd',
      header: 'التكلفة ($)',
      cell: info => {
        const product = info.row.original;
        const isEditing = editingId === product.id;
        const meta = info.table.options.meta as any;
        return isEditing ? (
          <input 
            type="text" 
            className="w-full p-1 border-2 border-emerald-500 rounded text-center text-sm outline-none bg-white font-mono"
            value={meta?.editValues?.cost_usd ?? ''}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const ev = meta?.editValues;
                if (ev) {
                  handleUpdateProduct(product.id, { 
                    name: ev.name, 
                    cost_usd: parseNumber(ev.cost_usd),
                    profit_syp: parseNumber(ev.profit_syp),
                    wholesale_carton_usd: parseNumber(ev.wholesale_carton_usd)
                  });
                }
                setEditingId(null);
                meta?.setEditValues(null);
              } else if (e.key === 'Escape') {
                setEditingId(null);
                meta?.setEditValues(null);
              }
            }}
            onChange={(e) => meta?.setEditValues((prev: any) => prev ? { ...prev, cost_usd: e.target.value } : null)}
          />
        ) : (
          <span className="text-sm font-mono font-bold text-zinc-600">${(Number(info.getValue()) || Number(product.carton_usd) || 0).toFixed(2)}</span>
        );
      },
      meta: { className: 'text-center min-w-[100px] font-mono text-sm' }
    }),
    columnHelper.accessor('profit_syp', {
      id: 'profit_syp',
      header: 'الربح (ل.س)',
      cell: info => {
        const product = info.row.original;
        const isEditing = editingId === product.id;
        const meta = info.table.options.meta as any;
        return isEditing ? (
          <input 
            type="text" 
            className="w-full p-1 border-2 border-emerald-500 rounded text-center text-sm outline-none bg-white font-mono"
            value={meta?.editValues?.profit_syp || ''}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const ev = meta?.editValues;
                if (ev) {
                  handleUpdateProduct(product.id, { 
                    name: ev.name, 
                    cost_usd: parseNumber(ev.cost_usd),
                    profit_syp: parseNumber(ev.profit_syp),
                    wholesale_carton_usd: parseNumber(ev.wholesale_carton_usd)
                  });
                }
                setEditingId(null);
                meta?.setEditValues(null);
              } else if (e.key === 'Escape') {
                setEditingId(null);
                meta?.setEditValues(null);
              }
            }}
            onChange={(e) => meta?.setEditValues((prev: any) => prev ? { ...prev, profit_syp: e.target.value } : null)}
          />
        ) : (
          <span className="text-sm font-bold text-emerald-600">{(Number(info.getValue()) || 0).toLocaleString()}</span>
        );
      },
      meta: { className: 'text-center min-w-[100px] font-mono' }
    }),
    columnHelper.accessor('wholesale_carton_usd', {
      id: 'wholesale_carton_usd',
      header: 'جملة كروز ($)',
      cell: info => {
        const product = info.row.original;
        const isEditing = editingId === product.id;
        const meta = info.table.options.meta as any;
        return isEditing ? (
          <input 
            type="text" 
            className="w-full p-1 border-2 border-emerald-500 rounded text-center text-sm outline-none bg-white font-mono"
            value={meta?.editValues?.wholesale_carton_usd ?? ''}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const ev = meta?.editValues;
                if (ev) {
                  handleUpdateProduct(product.id, { 
                    name: ev.name, 
                    cost_usd: parseNumber(ev.cost_usd),
                    profit_syp: parseNumber(ev.profit_syp),
                    wholesale_carton_usd: parseNumber(ev.wholesale_carton_usd)
                  });
                }
                setEditingId(null);
                meta?.setEditValues(null);
              } else if (e.key === 'Escape') {
                setEditingId(null);
                meta?.setEditValues(null);
              }
            }}
            onChange={(e) => meta?.setEditValues((prev: any) => prev ? { ...prev, wholesale_carton_usd: e.target.value } : null)}
          />
        ) : (
          <span className="text-sm font-mono font-bold text-emerald-600">${(Number(info.getValue()) || 0).toFixed(2)}</span>
        );
      },
      meta: { className: 'text-center min-w-[110px] font-mono text-sm bg-emerald-50/30' }
    }),
    columnHelper.display({
      id: 'case_usd',
      header: 'الكرتونة ($)',
      cell: info => {
        const product = info.row.original;
        const costUsd = product.cost_usd || 0;
        const caseUsd = costUsd * 50;
        return <span className="text-xs font-mono text-zinc-400">${caseUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>;
      },
      meta: { className: 'text-center min-w-[120px] font-mono' }
    }),
    columnHelper.display({
      id: 'wholesale_case_usd',
      header: 'جملة كرتونة ($)',
      cell: info => {
        const product = info.row.original;
        const isEditing = editingId === product.id;
        const meta = info.table.options.meta as any;
        const wUsd = isEditing ? (Number(meta?.editValues?.wholesale_carton_usd) || 0) : (product.wholesale_carton_usd || 0);
        const wholesaleCaseUsd = wUsd * 50;
        return <span className="text-xs font-mono text-emerald-500/70 font-bold">${wholesaleCaseUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>;
      },
      meta: { className: 'text-center min-w-[130px] font-mono bg-emerald-50/20' }
    }),
    columnHelper.display({
      id: 'lsg',
      header: 'ل.س.ج',
      cell: info => {
        const sypPrice = calculateSYP(info.row.original);
        return <span className="text-sm font-bold text-zinc-500">{(sypPrice / 100).toLocaleString()}</span>;
      },
      meta: { className: 'text-center min-w-[100px] font-mono' }
    }),
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: info => {
        const product = info.row.original;
        const isEditing = editingId === product.id;
        const meta = info.table.options.meta as any;
        
        if (isEditing) {
          return (
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <button 
                onClick={() => {
                  const ev = meta?.editValues;
                  if (ev) {
                    handleUpdateProduct(product.id, { 
                      name: ev.name, 
                      cost_usd: parseNumber(ev.cost_usd),
                      profit_syp: parseNumber(ev.profit_syp),
                      wholesale_carton_usd: parseNumber(ev.wholesale_carton_usd)
                    });
                  }
                  setEditingId(null);
                  meta?.setEditValues(null);
                }}
                className="p-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 transition-all shadow-sm"
                title="حفظ"
              >
                <Check className="w-4 h-4" />
              </button>
              <button 
                onClick={() => {
                  setEditingId(null);
                  meta?.setEditValues(null);
                }}
                className="p-1.5 bg-zinc-200 text-zinc-600 rounded-lg hover:bg-zinc-300 transition-all"
                title="إلغاء"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        }
        
        return null;
      },
      meta: { className: 'w-20' }
    })
  ], [editingId, handleUpdateProduct, calculateSYP]);

  const filteredColumns = useMemo(() => {
    const orderedCols = columnOrder
      .filter(id => visibleColumns.includes(id))
      .map(id => columns.find(col => col.id === id))
      .filter(Boolean) as any[];

    if (editingId !== null) {
      const actionsCol = columns.find(col => col.id === 'actions');
      if (actionsCol) orderedCols.push(actionsCol);
    }

    return orderedCols;
  }, [columns, visibleColumns, columnOrder, editingId]);

  const tableMeta = useMemo(() => ({
    editValues,
    setEditValues
  }), [editValues]);

  const table = useReactTable({
    data: groupedData.products,
    columns: filteredColumns,
    getCoreRowModel: getCoreRowModel(),
    meta: tableMeta
  });

  const tableRows = table.getRowModel().rows;
  const flattenedData = useMemo(() => {
    const result: ({ type: 'category'; name: string } | { type: 'product'; row: any })[] = [];
    
    let lastCategory = '';
    tableRows.forEach(row => {
      const product = row.original;
      const catName = product.category_name || 'غير مصنف';
      if (catName !== lastCategory) {
        result.push({ type: 'category', name: catName });
        lastCategory = catName;
      }
      result.push({ type: 'product', row });
    });
    
    return result;
  }, [tableRows]);

  const flattenedDataRef = useRef(flattenedData);
  useEffect(() => {
    flattenedDataRef.current = flattenedData;
  }, [flattenedData]);

  const handleContextMenu = useCallback((e: React.MouseEvent, productId: number) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, productId });
  }, []);

  const virtuosoComponents = useMemo(() => ({
    Table: (props: any) => <table {...props} className="w-full border-collapse" />,
    TableRow: (props: any) => {
      const index = props['data-index'];
      const item = flattenedDataRef.current[index];
      if (!item) return <tr {...props} />;
      const isCategory = item.type === 'category';
      const isHidden = item.type === 'product' && item.row.original.is_hidden === 1;
      return (
        <tr 
          {...props} 
          className={`data-grid-row border-b border-zinc-100 transition-all duration-200 ${isCategory ? 'bg-zinc-50' : 'cursor-context-menu hover:bg-emerald-50/40 hover:shadow-sm'} ${isHidden ? 'opacity-40 grayscale' : ''}`} 
          onContextMenu={(e) => !isCategory && item.type === 'product' && handleContextMenu(e, item.row.original.id)}
          onDoubleClick={() => {
            if (!isCategory && item.type === 'product') {
              const product = item.row.original;
              setEditValues({
                name: product.name,
                cost_usd: (product.cost_usd || product.carton_usd || 0).toString(),
                profit_syp: product.profit_syp.toString(),
                wholesale_carton_usd: product.wholesale_carton_usd.toString()
              });
              setEditingId(product.id);
            }
          }}
        />
      );
    },
  }), [handleContextMenu]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-50">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-12 h-12 text-emerald-500 animate-spin" />
          <p className="text-zinc-600 font-medium">جاري تحميل البيانات...</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen bg-zinc-50 flex flex-col" 
      dir="rtl" 
      style={{ 
        fontSize: `${fontSize}px`,
        ['--app-font-size' as any]: `${fontSize}px`
      }}
    >
      {/* Header */}
      <header className="bg-zinc-900 text-white py-4 px-8 shadow-lg z-20 sticky top-0 shrink-0 print:hidden">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500 p-1.5 rounded-lg">
              <svg id="Layer_1" data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 122.88 122.88" className="w-8 h-8">
                <defs><style>{`.cls-1{fill:#fff;}.cls-1,.cls-3{fill-rule:evenodd;}.cls-2{fill:#33a867;}`}</style></defs>
                <title>smoking-area</title>
                <path className="cls-1" d="M61.44,12.1A49.34,49.34,0,1,1,12.1,61.44,49.34,49.34,0,0,1,61.44,12.1Z"/>
                <path className="cls-2" d="M61.44,0A61.31,61.31,0,1,1,38,4.66,61.29,61.29,0,0,1,61.44,0ZM92.27,23a49.43,49.43,0,0,0-49.7-7.09A49.32,49.32,0,1,0,107,80.3a49,49,0,0,0,3.73-18.86h0a49.16,49.16,0,0,0-8.48-27.67A51,51,0,0,0,97.65,28,49.39,49.39,0,0,0,92.27,23Z"/>
                <path className="cls-3" d="M25.38,68.87H97.5A2.53,2.53,0,0,1,100,71.39v9.7a2.52,2.52,0,0,1-2.52,2.52H25.38a2.52,2.52,0,0,1-2.52-2.52v-9.7a2.53,2.53,0,0,1,2.52-2.52ZM89.61,65a2,2,0,0,1-1.67,2.14A1.89,1.89,0,0,1,86,65.25c-.15-2.58-.35-4-.77-4.74A4.62,4.62,0,0,0,83.11,59c-1.49-.72-5.47-.81-10.12-.92-11.11-.25-25.63-.59-26.11-10.62-.27-5.74,4.51-8.53,9.46-11.43,3.86-2.26,7.85-4.6,8.41-8.06V27.9a3.71,3.71,0,0,0-1-3.14A11.32,11.32,0,0,0,58.42,22a2,2,0,0,1-1.31-2.43,1.8,1.8,0,0,1,2.17-1.47,14.57,14.57,0,0,1,6.93,3.8,7.81,7.81,0,0,1,2.07,6.72v.09c-.88,5.41-5.66,8.21-10.28,10.91-3.91,2.29-7.68,4.5-7.54,7.66.3,6.3,12.94,6.59,22.61,6.81,5,.11,9.36.21,11.46,1.23,1.8.87,2.94,1.55,3.81,3.13.76,1.41,1.09,3.3,1.28,6.58Zm9.52-1.93a1.49,1.49,0,1,1-2.94,0c0-11.43-3.24-11.91-9.77-12.86-1-.15-2.15-.32-3.41-.54a28.39,28.39,0,0,1-8.25-2.44A8.25,8.25,0,0,1,69.94,40a9.59,9.59,0,0,1,2.85-6.87,26.67,26.67,0,0,1,5.75-4.53,1.37,1.37,0,0,1,2,.75,1.91,1.91,0,0,1-.63,2.35,23.63,23.63,0,0,0-5.11,4,6,6,0,0,0-1.91,4.12c.09,2,1.33,3.31,3.09,4.25a26.67,26.67,0,0,0,7.48,2.16c1.14.2,2.27.37,3.33.53C95,48,99.13,48.55,99.13,63.07Zm-2.58,8.61a1.17,1.17,0,0,1,1.2,1.2c-.41,4.63-4.43-1.2-1.2-1.2Zm-2.5,3.55a.75.75,0,0,1,.77.77c-.26,3-2.85-.77-.77-.77ZM96.43,79a.71.71,0,0,1,.73.72c-.25,2.8-2.68-.72-.73-.72Zm-4.61-7.31a.48.48,0,0,1,.49.48c-.17,1.86-1.79-.48-.49-.48ZM42.71,71.2H87.44L86.31,73l2,.18c-.72,1-2.19,1.58-3.34,2.55,2.51-.26,1.93,1.65,2.89,2.48-1.51,2.15,1.28,2.08,1.92,3.13H42.71V71.2Z"/>
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">مركز الوسيم لتجارة الدخان</h1>
              <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold">برمجة وتصميم KENAN ALDHNA</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-[10px] font-black text-emerald-500 uppercase tracking-wider">سعر الصرف:</span>
              <span className="text-xs font-mono font-bold text-emerald-400">{globalRate.toLocaleString()}</span>
            </div>

            <div className="flex items-center gap-1 bg-zinc-800 rounded-xl p-1 border border-zinc-700">
              <button 
                onClick={handleExportImage}
                disabled={isExporting}
                className="p-2 hover:bg-zinc-700 rounded-lg text-zinc-400 hover:text-white transition-all disabled:opacity-50"
                title="تصدير كصورة"
              >
                <Download className="w-4 h-4" />
              </button>
              <button 
                onClick={handleExportPDF}
                disabled={isExporting}
                className="p-2 hover:bg-zinc-700 rounded-lg text-zinc-400 hover:text-white transition-all disabled:opacity-50"
                title="تصدير PDF"
              >
                <Save className="w-4 h-4" />
              </button>
              <button 
                onClick={handlePrint}
                className="p-2 hover:bg-zinc-700 rounded-lg text-zinc-400 hover:text-white transition-all"
                title="طباعة"
              >
                <Printer className="w-4 h-4" />
              </button>
            </div>

            <div className="relative flex-1 md:flex-none">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input 
                type="text" 
                placeholder="بحث..." 
                className="bg-zinc-800 border-none rounded-xl py-2 pr-10 pl-4 text-sm focus:ring-2 focus:ring-emerald-500 w-full md:w-48 transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="relative flex-1 md:flex-none">
              <select 
                className="bg-zinc-800 border-none rounded-xl py-2 pr-4 pl-10 text-sm focus:ring-2 focus:ring-emerald-500 w-full md:w-40 appearance-none transition-all cursor-pointer"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <option value="all">جميع الفئات</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.name}>{cat.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
            </div>

            <button 
              onClick={() => setShowSettingsModal(true)}
              className="bg-zinc-800 hover:bg-zinc-700 text-white p-2 rounded-xl transition-all"
              title="الإعدادات"
            >
              <Settings className="w-5 h-5" />
            </button>

            <button 
              onClick={() => setShowAddModal(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-emerald-900/20 transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              إضافة
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto mt-6 px-4 pb-32 flex flex-col print:mt-0 print:px-0 print:pb-0 print:max-w-none">
        <div id="main-table" className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden relative print:shadow-none print:border-none print:rounded-none">
          <TableVirtuoso
            data={flattenedData}
            useWindowScroll
            fixedHeaderContent={() => (
              <tr className="bg-zinc-900 text-white font-bold text-[11px] uppercase tracking-wider print:bg-zinc-100 print:text-black">
                {table.getFlatHeaders().map(header => (
                  <th 
                    key={header.id}
                    style={{ fontSize: `${fontSize}px` }}
                    className={`py-4 px-4 border-l border-zinc-800 print:border-zinc-300 ${(header.column.columnDef.meta as any)?.className || ''}`}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            )}
            itemContent={(index, item) => {
              if (item.type === 'category') {
                return (
                  <td colSpan={table.getFlatHeaders().length} className="category-header-row">
                    <div className="flex items-center justify-between">
                      <div className="category-header-text">
                        <div className="category-header-indicator" />
                        <span>{item.name}</span>
                      </div>
                    </div>
                  </td>
                );
              }

              const { row } = item;

              return (
                <>
                  {row.getVisibleCells().map(cell => (
                    <td 
                      key={cell.id}
                      className={`data-grid-cell print:border-b print:border-zinc-300 print:text-black ${(cell.column.columnDef.cell as any)?.className || (cell.column.columnDef.meta as any)?.className || ''}`}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </>
              );
            }}
            components={virtuosoComponents}
          />
          {groupedData.products.length === 0 && (
            <div className="py-20 flex flex-col items-center justify-center pointer-events-none">
              <Package className="w-12 h-12 text-zinc-200 mb-4" />
              <p className="text-zinc-400 text-sm">لا يوجد نتائج للبحث</p>
            </div>
          )}
        </div>
      </main>

      {/* Context Menu */}
      <AnimatePresence>
        {contextMenu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            style={{ top: contextMenu.y, left: contextMenu.x }}
            className="fixed z-[100] bg-white rounded-xl shadow-2xl border border-zinc-200 py-2 w-48 overflow-hidden"
          >
            <button 
              onClick={() => {
                const product = products.find(p => p.id === contextMenu.productId);
                if (product) {
                  setEditValues({
                    name: product.name,
                    cost_usd: (product.cost_usd || product.carton_usd || 0).toString(),
                    profit_syp: product.profit_syp.toString(),
                    wholesale_carton_usd: product.wholesale_carton_usd.toString()
                  });
                }
                setEditingId(contextMenu.productId);
                setContextMenu(null);
              }}
              className="w-full px-4 py-2.5 text-right text-sm hover:bg-zinc-50 flex items-center gap-3 text-zinc-700 transition-colors"
            >
              <Edit2 className="w-4 h-4 text-emerald-500" />
              تعديل المادة
            </button>
            <button 
              onClick={() => {
                const product = products.find(p => p.id === contextMenu.productId);
                if (product) {
                  handleUpdateProduct(contextMenu.productId, { is_hidden: product.is_hidden === 1 ? 0 : 1 });
                }
                setContextMenu(null);
              }}
              className="w-full px-4 py-2.5 text-right text-sm hover:bg-zinc-50 flex items-center gap-3 text-zinc-700 transition-colors"
            >
              {products.find(p => p.id === contextMenu.productId)?.is_hidden === 1 ? (
                <><Eye className="w-4 h-4 text-emerald-500" /> إظهار المادة</>
              ) : (
                <><EyeOff className="w-4 h-4 text-zinc-400" /> إخفاء المادة</>
              )}
            </button>
            <button 
              onClick={() => handleDeleteProduct(contextMenu.productId)}
              className="w-full px-4 py-2.5 text-right text-sm hover:bg-red-50 flex items-center gap-3 text-red-600 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              حذف المادة
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettingsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSettingsModal(false)}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-lg relative z-10 overflow-hidden"
            >
              <div className="bg-zinc-900 p-6 text-white flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <Settings className="w-6 h-6 text-emerald-500" />
                  <h2 className="text-xl font-bold">إعدادات النظام</h2>
                </div>
                <button onClick={() => setShowSettingsModal(false)} className="text-zinc-400 hover:text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="p-6 space-y-8 max-h-[70vh] overflow-y-auto">
                {/* Global Rate */}
                <section className="space-y-4">
                  <h3 className="text-sm font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" /> سعر الصرف العام
                  </h3>
                  <div className="flex items-center gap-3 p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                    <input 
                      type="number" 
                      className="flex-1 bg-white border border-zinc-200 rounded-xl py-3 px-4 text-lg font-mono text-center focus:ring-2 focus:ring-emerald-500 outline-none"
                      value={globalRate}
                      onChange={(e) => setGlobalRate(Number(e.target.value))}
                    />
                    <button 
                      onClick={handleUpdateGlobalRate}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-xl font-bold transition-all active:scale-95 flex items-center gap-2"
                    >
                      <RefreshCw className="w-4 h-4" /> تحديث الكل
                    </button>
                  </div>
                </section>

                {/* Font Size */}
                <section className="space-y-4">
                  <h3 className="text-sm font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                    <Type className="w-4 h-4" /> حجم الخط
                  </h3>
                  <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100 space-y-4">
                    <div className="flex justify-between text-xs font-bold text-zinc-500">
                      <span>صغير (10)</span>
                      <span className="text-emerald-600">الحالي: {fontSize}px</span>
                      <span>كبير (24)</span>
                    </div>
                    <input 
                      type="range" 
                      min="10" 
                      max="24" 
                      value={fontSize} 
                      onChange={(e) => setFontSize(Number(e.target.value))}
                      className="w-full h-2 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                    />
                  </div>
                </section>

                {/* Visibility */}
                <section className="space-y-4">
                  <h3 className="text-sm font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                    <Eye className="w-4 h-4" /> العرض والخصوصية
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <button 
                      onClick={() => setShowHidden(!showHidden)}
                      className={`p-4 rounded-2xl border transition-all flex items-center justify-between ${showHidden ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-zinc-50 border-zinc-100 text-zinc-600'}`}
                    >
                      <div className="flex items-center gap-3">
                        {showHidden ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                        <span className="font-bold">المواد المخفية</span>
                      </div>
                      <div className={`w-10 h-5 rounded-full relative transition-colors ${showHidden ? 'bg-emerald-500' : 'bg-zinc-300'}`}>
                        <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${showHidden ? 'right-6' : 'right-1'}`} />
                      </div>
                    </button>
                  </div>
                </section>

                {/* Column Visibility & Order */}
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                      <Layout className="w-4 h-4" /> ترتيب وظهور الأعمدة
                    </h3>
                    <div className="flex gap-2">
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          resetTableSettings();
                        }}
                        className="px-3 py-1.5 text-[10px] font-bold text-zinc-400 hover:text-emerald-500 border border-zinc-800 hover:border-emerald-500/50 rounded-lg transition-all flex items-center gap-1"
                      >
                        <RefreshCw className="w-3 h-3" /> تعيين الأعمدة
                      </button>
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          resetAllSettings();
                        }}
                        className="px-3 py-1.5 text-[10px] font-bold text-red-500/70 hover:text-red-500 border border-zinc-800 hover:border-red-500/50 rounded-lg transition-all flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" /> مسح الكل
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2 bg-zinc-50 p-4 rounded-2xl border border-zinc-100">
                    {columnOrder.map((colId, index) => {
                      const colInfo = [
                        { id: 'name', label: 'اسم المادة' },
                        { id: 'syp_final', label: 'ل.س.ق' },
                        { id: 'cost_usd', label: 'التكلفة ($)' },
                        { id: 'profit_syp', label: 'الربح' },
                        { id: 'wholesale_carton_usd', label: 'جملة كروز ($)' },
                        { id: 'lsg', label: 'ل.س.ج' },
                        { id: 'case_usd', label: 'الكرتونة ($)' },
                        { id: 'wholesale_case_usd', label: 'جملة كرتونة ($)' }
                      ].find(c => c.id === colId);
                      
                      if (!colInfo) return null;
                      const isVisible = visibleColumns.includes(colId);

                      return (
                        <div key={colId} className="flex items-center justify-between p-3 bg-white rounded-xl border border-zinc-100 shadow-sm">
                          <div className="flex items-center gap-3">
                            <button 
                              onClick={() => {
                                setVisibleColumns(prev => 
                                  prev.includes(colId) ? prev.filter(id => id !== colId) : [...prev, colId]
                                );
                              }}
                              className={`w-5 h-5 rounded flex items-center justify-center border transition-all ${isVisible ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-white border-zinc-200 text-zinc-300'}`}
                            >
                              {isVisible && <Check className="w-3 h-3" />}
                            </button>
                            <span className={`font-bold text-sm ${isVisible ? 'text-zinc-700' : 'text-zinc-400'}`}>{colInfo.label}</span>
                          </div>
                          <div className="flex gap-1">
                            <button 
                              disabled={index === 0}
                              onClick={() => {
                                const newOrder = [...columnOrder];
                                [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
                                setColumnOrder(newOrder);
                              }}
                              className="p-1.5 hover:bg-zinc-100 rounded-lg disabled:opacity-30 transition-colors"
                            >
                              <ChevronUp className="w-4 h-4" />
                            </button>
                            <button 
                              disabled={index === columnOrder.length - 1}
                              onClick={() => {
                                const newOrder = [...columnOrder];
                                [newOrder[index + 1], newOrder[index]] = [newOrder[index], newOrder[index + 1]];
                                setColumnOrder(newOrder);
                              }}
                              className="p-1.5 hover:bg-zinc-100 rounded-lg disabled:opacity-30 transition-colors"
                            >
                              <ChevronDown className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>

                {/* Category Reorder */}
                <section className="space-y-4">
                  <h3 className="text-sm font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                    <Settings className="w-4 h-4" /> ترتيب الفئات
                  </h3>
                  <div className="space-y-2 bg-zinc-50 p-4 rounded-2xl border border-zinc-100">
                    {categories.map((cat, index) => (
                      <div key={cat.id} className="flex items-center justify-between p-3 bg-white rounded-xl border border-zinc-100 shadow-sm">
                        <span className="font-bold text-zinc-700">{cat.name}</span>
                        <div className="flex gap-1">
                          <button 
                            disabled={index === 0}
                            onClick={() => {
                              const newCats = [...categories];
                              [newCats[index - 1], newCats[index]] = [newCats[index], newCats[index - 1]];
                              handleReorderCategories(newCats);
                            }}
                            className="p-1.5 hover:bg-zinc-100 rounded-lg disabled:opacity-30 transition-colors"
                          >
                            <ChevronUp className="w-4 h-4" />
                          </button>
                          <button 
                            disabled={index === categories.length - 1}
                            onClick={() => {
                              const newCats = [...categories];
                              [newCats[index + 1], newCats[index]] = [newCats[index], newCats[index + 1]];
                              handleReorderCategories(newCats);
                            }}
                            className="p-1.5 hover:bg-zinc-100 rounded-lg disabled:opacity-30 transition-colors"
                          >
                            <ChevronDown className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              <div className="p-6 bg-zinc-50 border-t border-zinc-100">
                <button 
                  onClick={() => setShowSettingsModal(false)}
                  className="w-full bg-zinc-900 text-white font-bold py-4 rounded-2xl transition-all active:scale-95 shadow-xl shadow-zinc-900/20"
                >
                  حفظ وإغلاق
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md relative z-10 overflow-hidden"
            >
              <div className="bg-zinc-900 p-6 text-white flex justify-between items-center">
                <h2 className="text-xl font-bold">إضافة مادة جديدة</h2>
                <button onClick={() => setShowAddModal(false)} className="text-zinc-400 hover:text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">اسم المادة</label>
                  <input 
                    type="text" 
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                    placeholder="مثال: مالبورو ابيض"
                    value={newProduct.name}
                    onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">الفئة</label>
                    <div className="relative">
                      <select 
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 appearance-none focus:ring-2 focus:ring-emerald-500 outline-none"
                        value={newProduct.category_id}
                        onChange={(e) => setNewProduct({ ...newProduct, category_id: Number(e.target.value) })}
                      >
                        {categories.map(cat => (
                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">التكلفة ($)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none"
                      value={newProduct.cost_usd}
                      onChange={(e) => setNewProduct({ ...newProduct, cost_usd: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">الربح (ل.س)</label>
                    <input 
                      type="number" 
                      step="500"
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none"
                      value={newProduct.profit_syp}
                      onChange={(e) => setNewProduct({ ...newProduct, profit_syp: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">جملة كروز ($)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none"
                      value={newProduct.wholesale_carton_usd}
                      onChange={(e) => setNewProduct({ ...newProduct, wholesale_carton_usd: Number(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="pt-4">
                  <button 
                    onClick={handleAddProduct}
                    disabled={!newProduct.name}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-200 disabled:text-zinc-400 text-white font-bold py-4 rounded-xl shadow-lg shadow-emerald-900/20 transition-all active:scale-95"
                  >
                    إضافة إلى الجدول
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Hidden Table for Export */}
      <div id="export-container" style={{ display: 'none', position: 'absolute', left: '-9999px', width: '800px', backgroundColor: 'white', padding: '0', fontFamily: 'Arial, sans-serif' }} dir="rtl">
        <div className="text-center py-6 bg-white">
          <h1 className="text-6xl font-black text-black mb-4">مركز الوسيم لتجارة الدخان</h1>
          <div className="text-[22px] text-zinc-800 font-black space-y-1">
            <div>{new Date().toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
            <div>{new Date().toLocaleTimeString('ar-SA')}</div>
          </div>
        </div>

        <table className="w-full border-collapse border-[3px] border-black">
          <thead>
            <tr className="bg-[#00FF00] border-b-[3px] border-black">
              {filteredColumns.filter(c => c.id !== 'actions').map(col => {
                const colId = col.id || (col as any).accessorKey;
                return (
                  <th 
                    key={`export-head-${colId}`} 
                    className="py-4 px-2 text-[40px] font-black text-black border-l-[3px] border-black last:border-l-0 text-center align-middle"
                    style={{ verticalAlign: 'middle' }}
                  >
                    {colId === 'name' ? 'اسم المادة' : (typeof col.header === 'string' ? col.header : colId)}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {categories.sort((a, b) => a.sort_order - b.sort_order).map(cat => {
              const catProducts = products.filter(p => p.category_id === cat.id && (showHidden || !p.is_hidden));
              if (catProducts.length === 0) return null;

              return (
                <React.Fragment key={`export-cat-group-${cat.id}`}>
                  {/* Category Header Row */}
                  <tr className="bg-[#00FF00] border-b-[3px] border-black">
                    <td 
                      colSpan={filteredColumns.filter(c => c.id !== 'actions').length} 
                      className="py-3 text-[48px] font-black text-black text-center align-middle"
                      style={{ verticalAlign: 'middle' }}
                    >
                      {cat.name}
                    </td>
                  </tr>
                  {/* Products */}
                  {catProducts.sort((a, b) => a.name.localeCompare(b.name)).map(p => (
                    <tr key={`export-prod-${p.id}`} className="border-b-[3px] border-black last:border-b-0">
                      {filteredColumns.filter(c => c.id !== 'actions').map(col => {
                        let content: React.ReactNode = '';
                        const id = col.id || (col as any).accessorKey;
                        
                        if (id === 'name') content = p.name;
                        else if (id === 'syp_final') content = calculateSYP(p).toLocaleString();
                        else if (id === 'cost_usd') content = (Number(p.cost_usd) || 0).toFixed(2);
                        else if (id === 'case_usd') content = ((Number(p.cost_usd) || 0) * 50).toLocaleString(undefined, { minimumFractionDigits: 2 });
                        else if (id === 'wholesale_carton_usd') content = (Number(p.wholesale_carton_usd) || 0).toFixed(2);
                        else if (id === 'wholesale_case_usd') content = ((Number(p.wholesale_carton_usd) || 0) * 50).toLocaleString(undefined, { minimumFractionDigits: 2 });
                        else if (id === 'lsg') content = (calculateSYP(p) / 100).toLocaleString();

                        return (
                          <td 
                            key={`export-cell-${p.id}-${id}`} 
                            className={`py-3 px-2 text-[40px] font-black text-black border-l-[3px] border-black last:border-l-0 ${id === 'name' ? 'text-right pr-8' : 'text-center'} align-middle`}
                            style={{ verticalAlign: 'middle' }}
                          >
                            {content}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Stats Footer */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-zinc-200 py-3 px-8 z-10 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] print:hidden">
        <div className="max-w-7xl mx-auto flex justify-between items-center text-sm">
          <div className="flex gap-6">
            <div className="flex items-center gap-2">
              <span className="text-zinc-400">إجمالي المواد:</span>
              <span className="font-bold text-zinc-900">{products.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-zinc-400">الفئات:</span>
              <span className="font-bold text-zinc-900">{categories.length}</span>
            </div>
          </div>
          <div className="text-zinc-400 text-xs">
            تم التحديث: {new Date().toLocaleTimeString('ar-SA')}
          </div>
        </div>
      </footer>
    </div>
  );
}
