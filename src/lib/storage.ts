/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Customer, Product, Sale } from '../types';

const STORAGE_KEYS = {
  CUSTOMERS: 'salgadozap_customers',
  PRODUCTS: 'salgadozap_products',
  SALES: 'salgadozap_sales',
};

export const storage = {
  getCustomers: (): Customer[] => {
    const data = localStorage.getItem(STORAGE_KEYS.CUSTOMERS);
    return data ? JSON.parse(data) : [];
  },
  saveCustomers: (customers: Customer[]) => {
    localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customers));
  },
  
  getProducts: (): Product[] => {
    const data = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
    return data ? JSON.parse(data) : [
      { id: '1', name: 'Coxinha', price: 5.00 },
      { id: '2', name: 'Kibe', price: 5.00 },
      { id: '3', name: 'Enroladinho', price: 5.00 },
      { id: '4', name: 'Pastel', price: 6.00 },
      { id: '5', name: 'Suco', price: 4.00 }
    ];
  },
  saveProducts: (products: Product[]) => {
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
  },
  
  getSales: (): Sale[] => {
    const data = localStorage.getItem(STORAGE_KEYS.SALES);
    return data ? JSON.parse(data) : [];
  },
  saveSales: (sales: Sale[]) => {
    localStorage.setItem(STORAGE_KEYS.SALES, JSON.stringify(sales));
  },
};

export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export const formatWhatsAppMessage = (bill: { 
  customerName: string, 
  total: number, 
  sales: Sale[],
  startDate: string,
  endDate: string 
}) => {
  const dateRange = `${new Date(bill.startDate).toLocaleDateString('pt-BR')} até ${new Date(bill.endDate).toLocaleDateString('pt-BR')}`;
  
  let message = `*Olá, ${bill.customerName}!* 👋\n\n`;
  message += `Aqui está o resumo detalhado dos seus consumos (*${dateRange}*):\n\n`;
  
  // Group sales by day
  const salesByDay: Record<string, Sale[]> = {};
  bill.sales
    .filter(sale => !sale.isPaid)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .forEach(sale => {
    const day = new Date(sale.date).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    const capitalizedDay = day.charAt(0).toUpperCase() + day.slice(1);
    if (!salesByDay[capitalizedDay]) {
      salesByDay[capitalizedDay] = [];
    }
    salesByDay[capitalizedDay].push(sale);
  });

  Object.entries(salesByDay).forEach(([day, daySales]) => {
    message += `*${day}*\n`;
    
    // Group by product within the day
    const dayProducts: Record<string, { qty: number, price: number }> = {};
    daySales.forEach(s => {
      if (!dayProducts[s.productName]) {
        dayProducts[s.productName] = { qty: 0, price: s.price };
      }
      dayProducts[s.productName].qty += s.quantity;
    });

    Object.entries(dayProducts).forEach(([name, data]) => {
      message += `• ${data.qty}x ${name}: ${formatCurrency(data.qty * data.price)}\n`;
    });
    message += `\n`;
  });

  message += `*Total da conta: ${formatCurrency(bill.total)}* 💰\n\n`;
  message += `Por favor, me avise quando puder realizar o pagamento. Pix ou dinheiro. Obrigado! 🙏`;
  
  return encodeURIComponent(message);
};

export const formatPaymentConfirmation = (customerName: string, total: number) => {
  let message = `*Confirmação de Pagamento* ✅\n\n`;
  message += `Olá, *${customerName}*!\n`;
  message += `Recebi o pagamento no valor de *${formatCurrency(total)}* referente aos seus consumos.\n\n`;
  message += `Muito obrigado pela preferência! Tudo certo por aqui. 🙏`;
  return encodeURIComponent(message);
};
