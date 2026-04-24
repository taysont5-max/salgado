/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  PlusCircle, 
  Users, 
  Receipt, 
  Settings, 
  ChevronRight, 
  Plus, 
  Minus,
  Trash2,
  Share2,
  Store,
  History,
  Download,
  Search,
  Filter
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { format, startOfWeek, endOfWeek, isWithinInterval, parseISO, isAfter, isBefore, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { Customer, Product, Sale, WeeklyBill } from './types';
import { storage, formatCurrency, formatWhatsAppMessage, formatPaymentConfirmation } from './lib/storage';
import { downloadCSV } from './lib/export';

type Tab = 'sales' | 'customers' | 'billing' | 'history' | 'settings';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('sales');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  
  // Sales form state
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [cart, setCart] = useState<{ productId: string, productName: string, price: number, quantity: number }[]>([]);

  // History Filters
  const [histFilterCustomer, setHistFilterCustomer] = useState('');
  const [histFilterStart, setHistFilterStart] = useState('');
  const [histFilterEnd, setHistFilterEnd] = useState('');

  // Load data - Single initialization
  useEffect(() => {
    const loadedCustomers = storage.getCustomers();
    const loadedProducts = storage.getProducts();
    const loadedSales = storage.getSales();
    
    if (loadedCustomers.length > 0) setCustomers(loadedCustomers);
    if (loadedProducts.length > 0) setProducts(loadedProducts);
    setSales(loadedSales);
  }, []);

  // Save data only when it actually changes and after initial load
  const isInitialMount = React.useRef(true);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    storage.saveCustomers(customers);
  }, [customers]);

  useEffect(() => {
    if (isInitialMount.current) return;
    storage.saveProducts(products);
  }, [products]);

  useEffect(() => {
    if (isInitialMount.current) return;
    storage.saveSales(sales);
  }, [sales]);

  const addToCart = (product: Product) => {
    setCart(prevCart => {
      const existingIndex = prevCart.findIndex(item => item.productId === product.id);
      if (existingIndex > -1) {
        const newCart = [...prevCart];
        newCart[existingIndex].quantity += 1;
        return newCart;
      }
      return [...prevCart, { 
        productId: product.id, 
        productName: product.name, 
        price: product.price, 
        quantity: 1 
      }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prevCart => prevCart.filter(item => item.productId !== productId));
  };

  const updateCartQty = (productId: string, delta: number) => {
    setCart(prevCart => prevCart.map(item => {
      if (item.productId === productId) {
        return { ...item, quantity: Math.max(1, item.quantity + delta) };
      }
      return item;
    }));
  };

  const confirmSale = () => {
    if (!selectedCustomerId || cart.length === 0) return;

    const newSalesItems: Sale[] = cart.map(item => ({
      id: uuidv4(),
      customerId: selectedCustomerId,
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      price: item.price,
      date: new Date().toISOString(),
      isPaid: false
    }));

    setSales(prevSales => [...newSalesItems, ...prevSales]);
    setCart([]);
  };

  const deleteSale = (id: string) => {
    setSales(prevSales => prevSales.filter(s => s.id !== id));
  };

  const addCustomer = (name: string, phone: string) => {
    const newCustomer: Customer = {
      id: uuidv4(),
      name,
      phone,
    };
    setCustomers(prev => [...prev, newCustomer]);
  };

  const deleteCustomer = (id: string) => {
    setCustomers(prev => prev.filter(c => c.id !== id));
  };

  const addProduct = (name: string, price: number) => {
    const newProduct: Product = {
      id: uuidv4(),
      name,
      price,
    };
    setProducts(prev => [...prev, newProduct]);
  };

  const deleteProduct = (id: string) => {
    setProducts(prev => prev.filter(p => p.id !== id));
  };

  const markAsPaid = (customerId: string) => {
    setSales(prevSales => {
      const newSales = prevSales.map(s => {
        if (s.customerId === customerId && !s.isPaid) {
          return { ...s, isPaid: true, paidAt: new Date().toISOString() };
        }
        return s;
      });
      storage.saveSales(newSales); // Force immediate save
      return newSales;
    });
  };

  const confirmPaymentOnly = (bill: WeeklyBill) => {
    markAsPaid(bill.customerId);
  };

  const confirmPaymentAndSendReceipt = (bill: WeeklyBill) => {
    const customer = customers.find(c => c.id === bill.customerId);
    if (!customer) return;

    markAsPaid(bill.customerId);

    const message = formatPaymentConfirmation(customer.name, bill.total);
    const phone = customer.phone.replace(/\D/g, '');
    window.open(`https://wa.me/55${phone}?text=${message}`, '_blank');
  };

  const handleExportCSV = () => {
    const filtered = getFilteredHistory();
    const exportData = filtered.map(s => {
      const customer = customers.find(c => c.id === s.customerId);
      return {
        Data: format(parseISO(s.date), 'dd/MM/yyyy HH:mm'),
        Cliente: customer?.name || '?',
        Produto: s.productName,
        Quantidade: s.quantity,
        PrecoUn: s.price,
        Total: s.quantity * s.price,
        Status: s.isPaid ? 'Pago' : 'Pendente',
        PagoEm: s.paidAt ? format(parseISO(s.paidAt), 'dd/MM/yyyy HH:mm') : '-'
      };
    });
    downloadCSV(exportData, `vendas_${format(new Date(), 'yyyy-MM-dd')}.csv`);
  };

  const getFilteredHistory = () => {
    return sales.filter(s => {
      const matchesCustomer = !histFilterCustomer || s.customerId === histFilterCustomer;
      const saleDate = parseISO(s.date);
      
      let matchesStart = true;
      if (histFilterStart) {
        matchesStart = saleDate >= startOfDay(parseISO(histFilterStart));
      }
      
      let matchesEnd = true;
      if (histFilterEnd) {
        matchesEnd = saleDate <= endOfDay(parseISO(histFilterEnd));
      }

      return matchesCustomer && matchesStart && matchesEnd;
    });
  };

  // Billing Logic
  const getWeeklyBills = (): WeeklyBill[] => {
    const now = new Date();
    const start = startOfWeek(now, { weekStartsOn: 1 }); // Monday
    const end = endOfWeek(now, { weekStartsOn: 1 });

    const bills: Record<string, WeeklyBill> = {};

    sales.forEach(sale => {
      if (sale.isPaid) return; // Only uncleared sales appear in billing

      if (!bills[sale.customerId]) {
        const customer = customers.find(c => c.id === sale.customerId);
        bills[sale.customerId] = {
          customerId: sale.customerId,
          customerName: customer?.name || 'Cliente Removido',
          sales: [],
          total: 0,
          startDate: start.toISOString(), // We use current week as labels for message
          endDate: end.toISOString()
        };
      }
      bills[sale.customerId].sales.push(sale);
      bills[sale.customerId].total += (sale.quantity * sale.price);
    });

    return Object.values(bills);
  };

  const sendWhatsApp = (bill: WeeklyBill) => {
    const customer = customers.find(c => c.id === bill.customerId);
    if (!customer) return;
    
    const message = formatWhatsAppMessage(bill);
    const phone = customer.phone.replace(/\D/g, '');
    window.open(`https://wa.me/55${phone}?text=${message}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-amber-50 font-sans text-slate-900 pb-28">
      {/* Header */}
      <header className="p-6 flex justify-between items-center max-w-4xl mx-auto">
        <div>
          <h1 className="text-3xl font-black tracking-tighter text-slate-900">
            SALGADO<span className="text-amber-600">ZAP</span>
          </h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Controle & Cobrança</p>
        </div>
        
        <div className="hidden sm:flex gap-4">
          <div className="bg-white border-2 border-slate-900 px-4 py-2 rounded-xl shadow-brutal-sm">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Semana Atual</p>
            <p className="text-lg font-black leading-none">
              {formatCurrency(getWeeklyBills().reduce((acc, b) => acc + b.total, 0))}
            </p>
          </div>
        </div>
      </header>

      <main className="p-4 max-w-lg mx-auto sm:max-w-4xl sm:grid sm:grid-cols-2 sm:gap-6">
        <AnimatePresence mode="wait">
          {activeTab === 'sales' && (
            <motion.section
              key="sales"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="space-y-6 sm:col-span-2 sm:grid sm:grid-cols-2 sm:gap-6 sm:space-y-0"
            >
              <div className="bg-white border-2 border-slate-900 rounded-3xl p-6 shadow-brutal">
                <h2 className="text-xl font-black mb-6 uppercase tracking-tight flex items-center gap-2">
                  <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                    <PlusCircle size={18} className="text-amber-600" />
                  </div>
                  Anotar Consumo
                </h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1 block">Cliente</label>
                    <select 
                      value={selectedCustomerId}
                      onChange={(e) => setSelectedCustomerId(e.target.value)}
                      className="w-full border-2 border-slate-200 rounded-xl p-3 focus:border-amber-500 outline-none transition-colors font-bold appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2020%2020%22%3E%3Cpath%20stroke%3D%22%236b7280%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%221.5%22%20d%3D%22m6%208%204%204%204-4%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.25rem_1.25rem] bg-[right_0.5rem_center] bg-no-repeat"
                    >
                      <option value="">Selecionar Cliente</option>
                      {customers.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 block">Menu (Clique para Adicionar)</label>
                    <div className="grid grid-cols-2 gap-2">
                      {products.map(p => (
                        <button
                          key={p.id}
                          onClick={() => addToCart(p)}
                          className="p-3 rounded-xl text-center border-2 border-slate-100 bg-slate-50 hover:border-amber-500 hover:bg-amber-50 transition-all group active:scale-95"
                        >
                          <div className="font-black text-sm text-slate-900 group-hover:text-amber-600 uppercase italic">{p.name}</div>
                          <div className="text-xs text-slate-400 font-bold">{formatCurrency(p.price)}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Cart Display */}
                  {cart.length > 0 && (
                    <div className="bg-slate-50 rounded-2xl p-4 border-2 border-slate-100 space-y-3">
                      <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Itens do Pedido</h3>
                      {cart.map(item => (
                        <div key={item.productId} className="flex items-center justify-between">
                          <div className="flex flex-col">
                            <span className="font-bold text-sm uppercase">{item.productName}</span>
                            <span className="text-[10px] text-slate-400">{formatCurrency(item.price)} un.</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 bg-white rounded-lg border border-slate-200 px-1">
                              <button onClick={() => updateCartQty(item.productId, -1)} className="p-1 text-slate-400 hover:text-amber-600"><Minus size={14} /></button>
                              <span className="font-black text-xs w-4 text-center">{item.quantity}</span>
                              <button onClick={() => updateCartQty(item.productId, 1)} className="p-1 text-slate-400 hover:text-amber-600"><Plus size={14} /></button>
                            </div>
                            <button onClick={() => removeFromCart(item.productId)} className="text-slate-300 hover:text-red-500"><Trash2 size={16} /></button>
                          </div>
                        </div>
                      ))}
                      <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
                        <span className="font-black text-xs uppercase text-slate-400">Total Pedido</span>
                        <span className="font-black text-lg text-slate-900">
                          {formatCurrency(cart.reduce((acc, item) => acc + (item.price * item.quantity), 0))}
                        </span>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={confirmSale}
                    disabled={!selectedCustomerId || cart.length === 0}
                    className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl shadow-brutal-sm disabled:opacity-30 disabled:shadow-none hover:-translate-y-0.5 hover:shadow-brutal active:translate-y-0.5 transition-all uppercase tracking-widest text-sm"
                  >
                    Confirmar Pedido
                  </button>
                </div>
              </div>

              <div className="bg-white border-2 border-slate-900 rounded-3xl p-6 shadow-brutal overflow-hidden">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-black uppercase tracking-tight">Últimos Registros</h2>
                  <button onClick={() => setActiveTab('history')} className="text-xs font-black text-amber-600 border-b-2 border-amber-600 pb-0.5">VER TUDO</button>
                </div>
                <div className="space-y-4">
                  {sales.slice(0, 6).map(sale => {
                    const customer = customers.find(c => c.id === sale.customerId);
                    return (
                      <div key={sale.id} className="flex items-center justify-between pb-3 border-b-2 border-slate-50 last:border-0 last:pb-0">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-slate-900 rounded-full flex items-center justify-center text-white text-xs font-black">
                            {customer?.name.charAt(0).toUpperCase() || '?'}
                          </div>
                          <div>
                            <div className="font-black text-sm uppercase tracking-tight">{customer?.name}</div>
                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                              {sale.quantity}X {sale.productName} • {format(parseISO(sale.date), 'HH:mm')}
                            </div>
                          </div>
                        </div>
                        <div className="font-black text-base text-slate-900">
                          {formatCurrency(sale.quantity * sale.price)}
                        </div>
                      </div>
                    );
                  })}
                  {sales.length === 0 && (
                    <div className="text-center py-12">
                      <p className="text-slate-400 text-xs font-bold uppercase tracking-[0.2em]">Nenhum registro hoje</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.section>
          )}

          {activeTab === 'billing' && (
            <motion.section
              key="billing"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6 sm:col-span-2"
            >
              <div className="bg-amber-500 border-2 border-slate-900 rounded-3xl p-6 shadow-brutal flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter italic">Cobranças Pendentes</h2>
                  <p className="text-xs font-bold text-slate-900/60 uppercase tracking-widest">Resumo desta semana</p>
                </div>
                <div className="bg-white/20 px-4 py-2 rounded-xl backdrop-blur-sm self-start sm:self-center border border-white/30">
                  <p className="text-xs font-bold text-slate-900 uppercase leading-none mb-1">A Receber</p>
                  <p className="text-2xl font-black">{formatCurrency(getWeeklyBills().reduce((acc, b) => acc + b.total, 0))}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {getWeeklyBills().map(bill => (
                  <div key={bill.customerId} className="bg-white border-2 border-slate-900 rounded-3xl p-6 shadow-brutal flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="font-black text-lg uppercase tracking-tight">{bill.customerName}</h3>
                        <div className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-lg text-[10px] font-black inline-block mt-1 uppercase tracking-widest border border-amber-200">
                          SEMANAL
                        </div>
                      </div>
                      <div className="text-2xl font-black text-slate-900 underline decoration-amber-500 underline-offset-4">
                        {formatCurrency(bill.total)}
                      </div>
                    </div>
                    
                    <div className="flex-grow space-y-4 mb-6">
                       {/* Aggregated view by day */}
                       {Array.from(new Set(bill.sales.map(s => format(parseISO(s.date), 'EEEE', { locale: ptBR })))).map(day => {
                         const daySales = bill.sales.filter(s => format(parseISO(s.date), 'EEEE', { locale: ptBR }) === day);
                         const dayTotal = daySales.reduce((acc, s) => acc + s.quantity * s.price, 0);
                         return (
                           <div key={day} className="border-l-2 border-amber-200 pl-3">
                             <div className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">{day}</div>
                             <div className="space-y-1">
                               {Array.from(new Set(daySales.map(s => s.productName))).map(prodName => {
                                 const count = daySales.filter(s => s.productName === prodName).reduce((acc, s) => acc + s.quantity, 0);
                                 return (
                                   <div key={prodName} className="flex justify-between text-xs font-bold uppercase tracking-tight">
                                     <span className="text-slate-400">{count}x {prodName}</span>
                                     <span className="text-slate-900">{formatCurrency(daySales.filter(s => s.productName === prodName).reduce((acc, s) => acc + s.quantity * s.price, 0))}</span>
                                   </div>
                                 );
                               })}
                               <div className="flex justify-end pt-1 border-t border-slate-50">
                                 <span className="text-[11px] font-black text-slate-900">Total Dia: {formatCurrency(dayTotal)}</span>
                               </div>
                             </div>
                           </div>
                         );
                       })}
                    </div>

                    <div className="flex flex-col gap-3">
                      <button
                        onClick={() => sendWhatsApp(bill)}
                        className="w-full flex items-center justify-center gap-2 bg-emerald-500 text-white border-2 border-slate-900 font-bold py-4 rounded-2xl shadow-brutal-sm hover:-translate-y-0.5 active:translate-y-0.5 transition-all text-sm uppercase tracking-widest"
                      >
                        <Share2 size={18} />
                        Enviar Cobrança (WhatsApp)
                      </button>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => confirmPaymentOnly(bill)}
                          className="flex items-center justify-center gap-2 bg-white text-slate-900 border-2 border-slate-900 font-bold py-3 rounded-2xl hover:bg-slate-50 transition-all text-[10px] uppercase tracking-tighter shadow-sm active:translate-y-0.5"
                        >
                          Marcar Pago
                        </button>
                        <button
                          onClick={() => confirmPaymentAndSendReceipt(bill)}
                          className="flex items-center justify-center gap-2 bg-slate-900 text-white border-2 border-slate-900 font-bold py-3 rounded-2xl hover:bg-slate-800 transition-all text-[10px] uppercase tracking-tighter shadow-sm active:translate-y-0.5"
                        >
                          Pago + Recibo
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {getWeeklyBills().length === 0 && (
                <div className="bg-white border-2 border-dashed border-slate-300 rounded-3xl p-16 text-center">
                  <p className="text-slate-400 font-bold text-sm uppercase tracking-widest italic">Nenhum consumo para cobrar agora</p>
                </div>
              )}
            </motion.section>
          )}

          {activeTab === 'customers' && (
            <motion.section
              key="customers"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-6 sm:col-span-2 sm:grid sm:grid-cols-2 sm:gap-6 sm:space-y-0"
            >
              <div className="bg-white border-2 border-slate-900 rounded-3xl p-6 shadow-brutal h-fit">
                <h2 className="text-xl font-black mb-6 uppercase tracking-tight italic">Novo Cliente</h2>
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    const form = e.target as HTMLFormElement;
                    const name = (form.elements.namedItem('name') as HTMLInputElement).value;
                    const phone = (form.elements.namedItem('phone') as HTMLInputElement).value;
                    addCustomer(name, phone);
                    form.reset();
                  }}
                  className="space-y-4"
                >
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1 block px-1">Nome Completo</label>
                    <input name="name" required className="w-full border-2 border-slate-200 rounded-xl p-3 focus:border-amber-500 outline-none font-bold" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1 block px-1">WhatsApp (DDD + Número)</label>
                    <input name="phone" required className="w-full border-2 border-slate-200 rounded-xl p-3 focus:border-amber-500 outline-none font-bold" placeholder="11999999999" />
                  </div>
                  <button className="w-full bg-white text-slate-900 border-2 border-slate-900 font-black py-4 rounded-2xl shadow-brutal-sm hover:-translate-y-0.5 active:translate-y-0.5 transition-all text-sm uppercase tracking-widest">
                    Confirmar Cadastro
                  </button>
                </form>
              </div>

              <div className="space-y-3">
                <h3 className="font-black text-slate-400 text-[10px] uppercase tracking-[0.3em] px-2">Clientes Ativos</h3>
                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                  {customers.map(c => (
                    <div key={c.id} className="bg-white border-2 border-slate-900 p-4 rounded-2xl flex items-center justify-between shadow-brutal-sm">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center font-black text-slate-500 text-sm border-2 border-slate-900/10">
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-black uppercase tracking-tight text-sm">{c.name}</div>
                          <div className="text-[10px] text-slate-400 font-bold tracking-widest">{c.phone}</div>
                        </div>
                      </div>
                      <button onClick={() => deleteCustomer(c.id)} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-red-50 hover:text-red-500 transition-colors text-slate-300">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </motion.section>
          )}

          {activeTab === 'history' && (
             <motion.section
              key="history"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4 sm:col-span-2"
            >
              <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-brutal flex justify-between items-center border-2 border-slate-900">
                 <div>
                   <h2 className="text-xl font-black uppercase tracking-tight">Histórico de Vendas</h2>
                   <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Total de {getFilteredHistory().length} registros</p>
                 </div>
                 <button 
                  onClick={handleExportCSV}
                  className="bg-amber-500 p-3 rounded-xl border-2 border-slate-900 shadow-brutal-sm hover:-translate-y-0.5 active:translate-y-0.5 transition-all"
                 >
                   <Download size={20} className="text-slate-900" />
                 </button>
              </div>

              {/* Filters */}
              <div className="bg-white border-2 border-slate-900 rounded-3xl p-4 shadow-brutal-sm space-y-3">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
                  <Filter size={12} /> Filtros de Busca
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <select 
                    value={histFilterCustomer}
                    onChange={(e) => setHistFilterCustomer(e.target.value)}
                    className="border-2 border-slate-100 rounded-xl p-2 text-xs font-bold focus:border-amber-500 outline-none"
                  >
                    <option value="">Todos os Clientes</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-slate-400">DE:</span>
                    <input 
                      type="date" 
                      value={histFilterStart}
                      onChange={(e) => setHistFilterStart(e.target.value)}
                      className="flex-grow border-2 border-slate-100 rounded-xl p-2 text-xs font-bold"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-slate-400">ATÉ:</span>
                    <input 
                      type="date" 
                      value={histFilterEnd}
                      onChange={(e) => setHistFilterEnd(e.target.value)}
                      className="flex-grow border-2 border-slate-100 rounded-xl p-2 text-xs font-bold"
                    />
                  </div>
                </div>
                {(histFilterCustomer || histFilterStart || histFilterEnd) && (
                  <button 
                    onClick={() => { setHistFilterCustomer(''); setHistFilterStart(''); setHistFilterEnd(''); }}
                    className="text-[10px] font-black text-red-500 uppercase tracking-widest hover:underline"
                  >
                    Limpar Filtros
                  </button>
                )}
              </div>

              <div className="space-y-3 pb-8">
                {getFilteredHistory().map(sale => {
                  const customer = customers.find(c => c.id === sale.customerId);
                  return (
                    <div key={sale.id} className="bg-white border-2 border-slate-900 p-4 rounded-2xl shadow-brutal-sm flex items-center justify-between">
                       <div className="flex items-center gap-4">
                          <div className="hidden sm:flex text-[10px] font-black text-slate-300 vertical-text mr-2 border-r border-slate-100 pr-2">
                             {format(parseISO(sale.date), 'dd MMM', { locale: ptBR })}
                          </div>
                          <div>
                            <div className="font-black text-sm uppercase tracking-tight">{customer?.name}</div>
                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                               {sale.quantity}X {sale.productName} • {format(parseISO(sale.date), 'HH:mm')}
                            </div>
                          </div>
                       </div>
                       <div className="flex items-center gap-4">
                          <div className="flex flex-col items-end gap-1">
                            <div className="font-black text-lg text-slate-900">{formatCurrency(sale.quantity * sale.price)}</div>
                            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border ${
                              sale.isPaid 
                                ? 'bg-emerald-50 text-emerald-600 border-emerald-200' 
                                : 'bg-amber-50 text-amber-600 border-amber-200'
                            }`}>
                              {sale.isPaid ? 'PAGO' : 'PENDENTE'}
                            </span>
                          </div>
                          <button onClick={() => deleteSale(sale.id)} className="text-slate-200 hover:text-red-500">
                            <Trash2 size={16} />
                          </button>
                       </div>
                    </div>
                  );
                })}
                {getFilteredHistory().length === 0 && (
                  <div className="text-center py-20 bg-white border-2 border-slate-100 rounded-3xl">
                    <p className="text-slate-300 font-bold uppercase tracking-widest text-xs italic">Nenhum registro encontrado</p>
                  </div>
                )}
              </div>
            </motion.section>
          )}

          {activeTab === 'settings' && (
            <motion.section
              key="settings"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6 sm:col-span-2 sm:grid sm:grid-cols-2 sm:gap-6 sm:space-y-0"
            >
              <div className="bg-white border-2 border-slate-900 rounded-3xl p-6 shadow-brutal h-fit">
                <h2 className="text-xl font-black mb-6 uppercase tracking-tight italic">Gestão de Cardápio</h2>
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    const form = e.target as HTMLFormElement;
                    const name = (form.elements.namedItem('pname') as HTMLInputElement).value;
                    const price = parseFloat((form.elements.namedItem('pprice') as HTMLInputElement).value);
                    addProduct(name, price);
                    form.reset();
                  }}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1 block">Item</label>
                      <input name="pname" required className="w-full border-2 border-slate-200 rounded-xl p-3 font-bold" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1 block">Preço</label>
                      <input name="pprice" type="number" step="0.01" required className="w-full border-2 border-slate-200 rounded-xl p-3 font-bold" />
                    </div>
                  </div>
                  <button className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl shadow-brutal-sm hover:-translate-y-0.5 active:translate-y-0.5 transition-all text-xs uppercase tracking-widest">
                    Adicionar ao Cardápio
                  </button>
                </form>

                <div className="mt-8 space-y-2">
                  {products.map(p => (
                    <div key={p.id} className="flex items-center justify-between p-3 border-2 border-slate-100 rounded-xl">
                      <div className="font-black text-sm uppercase tracking-tight">{p.name}</div>
                      <div className="flex items-center gap-4">
                        <span className="font-black text-amber-600">{formatCurrency(p.price)}</span>
                        <button onClick={() => deleteProduct(p.id)} className="text-slate-200 hover:text-red-500">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-6">
                <div className="p-6 bg-slate-900 text-white rounded-3xl border-2 border-slate-900 shadow-brutal">
                  <h3 className="text-amber-500 font-black text-lg uppercase tracking-tighter mb-2">Dica de Sucesso 🍕</h3>
                  <p className="text-sm font-bold text-slate-300 leading-snug">Cobrar na sexta-feira após o almoço aumenta em 40% a chance de receber via PIX na hora!</p>
                </div>

                <div className="bg-white border-2 border-slate-900 rounded-3xl p-6 shadow-brutal flex flex-col gap-4">
                  <h3 className="font-black uppercase tracking-tight text-sm">Controle de Segurança</h3>
                  <button 
                    onClick={() => {
                      if(confirm('Tem certeza que deseja limpar todos os dados? Isso não pode ser desfeito.')) {
                        localStorage.clear();
                        window.location.reload();
                      }
                    }}
                    className="w-full text-red-500 font-black text-[10px] py-4 border-2 border-red-100 rounded-2xl uppercase tracking-widest hover:bg-red-50 transition-colors"
                  >
                    Apagar Tudo (Reset do App)
                  </button>
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      {/* Navigation Bar */}
      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white border-2 border-slate-900 p-2 rounded-2xl flex gap-1 z-30 shadow-brutal max-w-fit mx-auto">
        <NavButton 
          active={activeTab === 'sales'} 
          onClick={() => setActiveTab('sales')} 
          icon={<PlusCircle size={22} />} 
          label="Venda" 
        />
        <NavButton 
          active={activeTab === 'billing'} 
          onClick={() => setActiveTab('billing')} 
          icon={<Receipt size={22} />} 
          label="Recibos" 
        />
        <NavButton 
          active={activeTab === 'customers'} 
          onClick={() => setActiveTab('customers')} 
          icon={<Users size={22} />} 
          label="Fregues" 
        />
        <NavButton 
          active={activeTab === 'history'} 
          onClick={() => setActiveTab('history')} 
          icon={<History size={22} />} 
          label="Log" 
        />
        <NavButton 
          active={activeTab === 'settings'} 
          onClick={() => setActiveTab('settings')} 
          icon={<Settings size={22} />} 
          label="Menu" 
        />
      </nav>
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center gap-1 transition-all ${active ? 'text-amber-600' : 'text-slate-400'}`}
    >
      <div className={`p-2 rounded-xl transition-all ${active ? 'bg-amber-100 border-2 border-amber-200' : 'border-2 border-transparent'}`}>
        {icon}
      </div>
      <span className="text-[10px] font-black uppercase tracking-tight">{label}</span>
    </button>
  );
}
