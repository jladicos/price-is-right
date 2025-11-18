export interface Product {
  name: string;
  price: number;
  images: string[];
}

export interface ProductConfig {
  products: Record<string, Product>;
  assignments: {
    bidding_set_1: string[];
    bidding_set_2: string[];
    showcase_showdown: string[];
  };
}
