export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          role: "admin" | "manager" | "staff";
          created_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          role?: "admin" | "manager" | "staff";
          created_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          role?: "admin" | "manager" | "staff";
          created_at?: string;
        };
        Relationships: [];
      };
      categories: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      suppliers: {
        Row: {
          id: string;
          name: string;
          business_number: string | null;
          representative_name: string | null;
          contact_name: string | null;
          email: string | null;
          phone: string | null;
          address: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          business_number?: string | null;
          representative_name?: string | null;
          contact_name?: string | null;
          email?: string | null;
          phone?: string | null;
          address?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          business_number?: string | null;
          representative_name?: string | null;
          contact_name?: string | null;
          email?: string | null;
          phone?: string | null;
          address?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      warehouses: {
        Row: {
          id: string;
          name: string;
          location: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          location?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          location?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      products: {
        Row: {
          id: string;
          sku: string;
          name: string;
          description: string | null;
          category_id: string | null;
          supplier_id: string | null;
          unit: string;
          price: number;
          cost: number;
          reorder_point: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          sku: string;
          name: string;
          description?: string | null;
          category_id?: string | null;
          supplier_id?: string | null;
          unit?: string;
          price?: number;
          cost?: number;
          reorder_point?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          sku?: string;
          name?: string;
          description?: string | null;
          category_id?: string | null;
          supplier_id?: string | null;
          unit?: string;
          price?: number;
          cost?: number;
          reorder_point?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "products_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["id"];
          },
        ];
      };
      inventory: {
        Row: {
          id: string;
          product_id: string;
          warehouse_id: string;
          quantity: number;
          updated_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          warehouse_id: string;
          quantity?: number;
          updated_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          warehouse_id?: string;
          quantity?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_warehouse_id_fkey";
            columns: ["warehouse_id"];
            isOneToOne: false;
            referencedRelation: "warehouses";
            referencedColumns: ["id"];
          },
        ];
      };
      inventory_transactions: {
        Row: {
          id: string;
          product_id: string;
          warehouse_id: string;
          type: "in" | "out" | "adjustment";
          quantity: number;
          reference: string | null;
          note: string | null;
          created_by: string | null;
          sales_order_id: string | null;
          purchase_order_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          warehouse_id: string;
          type: "in" | "out" | "adjustment";
          quantity: number;
          reference?: string | null;
          note?: string | null;
          created_by?: string | null;
          sales_order_id?: string | null;
          purchase_order_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          warehouse_id?: string;
          type?: "in" | "out" | "adjustment";
          quantity?: number;
          reference?: string | null;
          note?: string | null;
          created_by?: string | null;
          sales_order_id?: string | null;
          purchase_order_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_transactions_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_transactions_warehouse_id_fkey";
            columns: ["warehouse_id"];
            isOneToOne: false;
            referencedRelation: "warehouses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_transactions_sales_order_id_fkey";
            columns: ["sales_order_id"];
            isOneToOne: false;
            referencedRelation: "sales_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_transactions_purchase_order_id_fkey";
            columns: ["purchase_order_id"];
            isOneToOne: false;
            referencedRelation: "purchase_orders";
            referencedColumns: ["id"];
          },
        ];
      };
      company_profile: {
        Row: {
          id: number;
          name: string;
          business_number: string | null;
          representative_name: string | null;
          address: string | null;
          business_type: string | null;
          business_item: string | null;
          phone: string | null;
          fax_number: string | null;
          manager_name: string | null;
          manager_phone: string | null;
          email: string | null;
          greeting_message: string | null;
          logo_wordmark_url: string | null;
          logo_mark_url: string | null;
          seal_image_url: string | null;
          updated_at: string;
        };
        Insert: {
          id?: number;
          name?: string;
          business_number?: string | null;
          representative_name?: string | null;
          address?: string | null;
          business_type?: string | null;
          business_item?: string | null;
          phone?: string | null;
          fax_number?: string | null;
          manager_name?: string | null;
          manager_phone?: string | null;
          email?: string | null;
          greeting_message?: string | null;
          logo_wordmark_url?: string | null;
          logo_mark_url?: string | null;
          seal_image_url?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: number;
          name?: string;
          business_number?: string | null;
          representative_name?: string | null;
          address?: string | null;
          business_type?: string | null;
          business_item?: string | null;
          phone?: string | null;
          fax_number?: string | null;
          manager_name?: string | null;
          manager_phone?: string | null;
          email?: string | null;
          greeting_message?: string | null;
          logo_wordmark_url?: string | null;
          logo_mark_url?: string | null;
          seal_image_url?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      customers: {
        Row: {
          id: string;
          name: string;
          business_number: string | null;
          representative_name: string | null;
          contact_name: string | null;
          email: string | null;
          phone: string | null;
          address: string | null;
          notes: string | null;
          document_type: "출고증" | "명세표";
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          business_number?: string | null;
          representative_name?: string | null;
          contact_name?: string | null;
          email?: string | null;
          phone?: string | null;
          address?: string | null;
          notes?: string | null;
          document_type?: "출고증" | "명세표";
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          business_number?: string | null;
          representative_name?: string | null;
          contact_name?: string | null;
          email?: string | null;
          phone?: string | null;
          address?: string | null;
          notes?: string | null;
          document_type?: "출고증" | "명세표";
          created_at?: string;
        };
        Relationships: [];
      };
      customer_product_prices: {
        Row: {
          id: string;
          customer_id: string;
          product_id: string;
          unit_price: number;
          updated_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          product_id: string;
          unit_price?: number;
          updated_at?: string;
        };
        Update: {
          id?: string;
          customer_id?: string;
          product_id?: string;
          unit_price?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "customer_product_prices_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_product_prices_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      sales_orders: {
        Row: {
          id: string;
          customer_id: string;
          warehouse_id: string;
          order_date: string;
          memo: string | null;
          status: string;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          warehouse_id: string;
          order_date?: string;
          memo?: string | null;
          status?: string;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          customer_id?: string;
          warehouse_id?: string;
          order_date?: string;
          memo?: string | null;
          status?: string;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sales_orders_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sales_orders_warehouse_id_fkey";
            columns: ["warehouse_id"];
            isOneToOne: false;
            referencedRelation: "warehouses";
            referencedColumns: ["id"];
          },
        ];
      };
      sales_order_items: {
        Row: {
          id: string;
          sales_order_id: string;
          product_id: string;
          quantity: number;
          unit_price: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          sales_order_id: string;
          product_id: string;
          quantity: number;
          unit_price?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          sales_order_id?: string;
          product_id?: string;
          quantity?: number;
          unit_price?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sales_order_items_sales_order_id_fkey";
            columns: ["sales_order_id"];
            isOneToOne: false;
            referencedRelation: "sales_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sales_order_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      purchase_orders: {
        Row: {
          id: string;
          supplier_id: string;
          warehouse_id: string;
          purchase_date: string;
          memo: string | null;
          status: string;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          supplier_id: string;
          warehouse_id: string;
          purchase_date?: string;
          memo?: string | null;
          status?: string;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          supplier_id?: string;
          warehouse_id?: string;
          purchase_date?: string;
          memo?: string | null;
          status?: string;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchase_orders_warehouse_id_fkey";
            columns: ["warehouse_id"];
            isOneToOne: false;
            referencedRelation: "warehouses";
            referencedColumns: ["id"];
          },
        ];
      };
      purchase_order_items: {
        Row: {
          id: string;
          purchase_order_id: string;
          product_id: string;
          quantity: number;
          unit_cost: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          purchase_order_id: string;
          product_id: string;
          quantity: number;
          unit_cost?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          purchase_order_id?: string;
          product_id?: string;
          quantity?: number;
          unit_cost?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey";
            columns: ["purchase_order_id"];
            isOneToOne: false;
            referencedRelation: "purchase_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchase_order_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      calendar_notes: {
        Row: {
          id: string;
          note_date: string;
          content: string;
          created_by: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          note_date: string;
          content?: string;
          created_by?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          note_date?: string;
          content?: string;
          created_by?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
