/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Customer {
  id: string;
  name: string;
  phone: string; // WhatsApp number
}

export interface Product {
  id: string;
  name: string;
  price: number;
}

export interface Sale {
  id: string;
  customerId: string;
  productId: string;
  productName: string;
  quantity: number;
  price: number; // Price at the time of sale
  date: string; // ISO string
  isPaid?: boolean;
  paidAt?: string;
}

export interface WeeklyBill {
  customerId: string;
  customerName: string;
  sales: Sale[];
  total: number;
  startDate: string;
  endDate: string;
}
