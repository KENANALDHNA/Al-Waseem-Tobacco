export interface Category {
  id: number;
  name: string;
  sort_order: number;
}

export interface Product {
  id: number;
  category_id: number;
  category_name: string;
  category_sort_order: number;
  name: string;
  cost_usd: number;
  profit_syp: number;
  wholesale_profit_syp: number;
  carton_usd: number;
  wholesale_carton_usd: number;
  is_hidden: number;
}
