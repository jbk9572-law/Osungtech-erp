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
          username: string | null;
          email: string | null;
          role: "admin" | "manager" | "staff";
          is_demo: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          username?: string | null;
          email?: string | null;
          role?: "admin" | "manager" | "staff";
          is_demo?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          username?: string | null;
          email?: string | null;
          role?: "admin" | "manager" | "staff";
          is_demo?: boolean;
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
          purchase_export_template: "generic" | "standard_ledger" | "leaders_special" | "wote_ledger";
          purchase_price_basis: "box" | "quantity";
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
          purchase_export_template?: "generic" | "standard_ledger" | "leaders_special" | "wote_ledger";
          purchase_price_basis?: "box" | "quantity";
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
          purchase_export_template?: "generic" | "standard_ledger" | "leaders_special" | "wote_ledger";
          purchase_price_basis?: "box" | "quantity";
          created_at?: string;
        };
        Relationships: [];
      };
      supplier_payments: {
        Row: {
          id: string;
          supplier_id: string;
          paid_at: string;
          amount: number;
          method: string | null;
          memo: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          supplier_id: string;
          paid_at: string;
          amount: number;
          method?: string | null;
          memo?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          supplier_id?: string;
          paid_at?: string;
          amount?: number;
          method?: string | null;
          memo?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "supplier_payments_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["id"];
          },
        ];
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
          spec: string | null;
          unit: string;
          base_package_qty: number | null;
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
          spec?: string | null;
          unit?: string;
          base_package_qty?: number | null;
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
          spec?: string | null;
          unit?: string;
          base_package_qty?: number | null;
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
      product_package_qty_history: {
        Row: {
          id: string;
          product_id: string;
          base_package_qty: number;
          changed_by: string | null;
          changed_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          base_package_qty: number;
          changed_by?: string | null;
          changed_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          base_package_qty?: number;
          changed_by?: string | null;
          changed_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_package_qty_history_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
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
          {
            foreignKeyName: "inventory_transactions_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
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
          delivery_note_variant: "sns_filtech" | "zenith_tech" | "ket_solution" | null;
          sales_export_template: "generic" | "filter_box" | "filter_no_box" | "paper_roll" | "wote_ledger";
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
          delivery_note_variant?: "sns_filtech" | "zenith_tech" | "ket_solution" | null;
          sales_export_template?: "generic" | "filter_box" | "filter_no_box" | "paper_roll" | "wote_ledger";
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
          delivery_note_variant?: "sns_filtech" | "zenith_tech" | "ket_solution" | null;
          sales_export_template?: "generic" | "filter_box" | "filter_no_box" | "paper_roll" | "wote_ledger";
          created_at?: string;
        };
        Relationships: [];
      };
      customer_payments: {
        Row: {
          id: string;
          customer_id: string;
          paid_at: string;
          amount: number;
          method: string | null;
          memo: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          paid_at: string;
          amount: number;
          method?: string | null;
          memo?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          customer_id?: string;
          paid_at?: string;
          amount?: number;
          method?: string | null;
          memo?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "customer_payments_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
        ];
      };
      customer_product_prices: {
        Row: {
          id: string;
          customer_id: string;
          product_id: string;
          unit_price: number;
          notes: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          product_id: string;
          unit_price?: number;
          notes?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          customer_id?: string;
          product_id?: string;
          unit_price?: number;
          notes?: string | null;
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
      price_change_schedules: {
        Row: {
          id: string;
          customer_id: string;
          product_id: string;
          new_unit_price: number;
          effective_date: string;
          applied_at: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          product_id: string;
          new_unit_price: number;
          effective_date: string;
          applied_at?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          customer_id?: string;
          product_id?: string;
          new_unit_price?: number;
          effective_date?: string;
          applied_at?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "price_change_schedules_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "price_change_schedules_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "price_change_schedules_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      supplier_product_prices: {
        Row: {
          id: string;
          supplier_id: string;
          product_id: string;
          unit_cost: number;
          notes: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          supplier_id: string;
          product_id: string;
          unit_cost?: number;
          notes?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          supplier_id?: string;
          product_id?: string;
          unit_cost?: number;
          notes?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "supplier_product_prices_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "supplier_product_prices_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      purchase_price_change_schedules: {
        Row: {
          id: string;
          supplier_id: string;
          product_id: string;
          new_unit_cost: number;
          effective_date: string;
          applied_at: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          supplier_id: string;
          product_id: string;
          new_unit_cost: number;
          effective_date: string;
          applied_at?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          supplier_id?: string;
          product_id?: string;
          new_unit_cost?: number;
          effective_date?: string;
          applied_at?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "purchase_price_change_schedules_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchase_price_change_schedules_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchase_price_change_schedules_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
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
          payment_method: string | null;
          delivery_method: string | null;
          created_by: string | null;
          created_at: string;
          doc_no: number;
          is_return: boolean;
          return_reason: string | null;
          is_carryover: boolean;
        };
        Insert: {
          id?: string;
          customer_id: string;
          warehouse_id: string;
          order_date?: string;
          memo?: string | null;
          payment_method?: string | null;
          delivery_method?: string | null;
          created_by?: string | null;
          created_at?: string;
          doc_no?: number;
          is_return?: boolean;
          return_reason?: string | null;
          is_carryover?: boolean;
        };
        Update: {
          id?: string;
          customer_id?: string;
          warehouse_id?: string;
          order_date?: string;
          memo?: string | null;
          payment_method?: string | null;
          delivery_method?: string | null;
          created_by?: string | null;
          created_at?: string;
          doc_no?: number;
          is_return?: boolean;
          return_reason?: string | null;
          is_carryover?: boolean;
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
          {
            foreignKeyName: "sales_orders_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      sales_order_items: {
        Row: {
          id: string;
          sales_order_id: string;
          product_id: string;
          spec: string | null;
          quantity: number;
          unit_price: number;
          remark: string | null;
          lot_number: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          sales_order_id: string;
          product_id: string;
          spec?: string | null;
          quantity: number;
          unit_price?: number;
          remark?: string | null;
          lot_number?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          sales_order_id?: string;
          product_id?: string;
          spec?: string | null;
          quantity?: number;
          unit_price?: number;
          remark?: string | null;
          lot_number?: string | null;
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
          payment_method: string | null;
          delivery_method: string | null;
          created_by: string | null;
          created_at: string;
          doc_no: number;
          is_carryover: boolean;
        };
        Insert: {
          id?: string;
          supplier_id: string;
          warehouse_id: string;
          purchase_date?: string;
          memo?: string | null;
          payment_method?: string | null;
          delivery_method?: string | null;
          created_by?: string | null;
          created_at?: string;
          doc_no?: number;
          is_carryover?: boolean;
        };
        Update: {
          id?: string;
          supplier_id?: string;
          warehouse_id?: string;
          purchase_date?: string;
          memo?: string | null;
          payment_method?: string | null;
          delivery_method?: string | null;
          created_by?: string | null;
          created_at?: string;
          doc_no?: number;
          is_carryover?: boolean;
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
          {
            foreignKeyName: "purchase_orders_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      purchase_order_items: {
        Row: {
          id: string;
          purchase_order_id: string;
          product_id: string;
          spec: string | null;
          quantity: number;
          unit_cost: number;
          remark: string | null;
          lot_number: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          purchase_order_id: string;
          product_id: string;
          spec?: string | null;
          quantity: number;
          unit_cost?: number;
          remark?: string | null;
          lot_number?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          purchase_order_id?: string;
          product_id?: string;
          spec?: string | null;
          quantity?: number;
          unit_cost?: number;
          remark?: string | null;
          lot_number?: string | null;
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
          created_at: string;
        };
        Insert: {
          id?: string;
          note_date: string;
          content?: string;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          note_date?: string;
          content?: string;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "calendar_notes_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      paper_calculations: {
        Row: {
          id: string;
          sales_order_id: string | null;
          purchase_order_id: string | null;
          todo_id: string | null;
          paper_w: number;
          paper_h: number;
          input_items: Json;
          layouts: Json;
          total_paper: number;
          total_sheet: number;
          total_prod: number;
          over_prod: number;
          fulfilled: boolean;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          sales_order_id?: string | null;
          purchase_order_id?: string | null;
          todo_id?: string | null;
          paper_w: number;
          paper_h: number;
          input_items: Json;
          layouts?: Json;
          total_paper: number;
          total_sheet: number;
          total_prod: number;
          over_prod: number;
          fulfilled?: boolean;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          sales_order_id?: string | null;
          purchase_order_id?: string | null;
          todo_id?: string | null;
          paper_w?: number;
          paper_h?: number;
          input_items?: Json;
          layouts?: Json;
          total_paper?: number;
          total_sheet?: number;
          total_prod?: number;
          over_prod?: number;
          fulfilled?: boolean;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "paper_calculations_sales_order_id_fkey";
            columns: ["sales_order_id"];
            isOneToOne: false;
            referencedRelation: "sales_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "paper_calculations_purchase_order_id_fkey";
            columns: ["purchase_order_id"];
            isOneToOne: false;
            referencedRelation: "purchase_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "paper_calculations_todo_id_fkey";
            columns: ["todo_id"];
            isOneToOne: false;
            referencedRelation: "todos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "paper_calculations_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      paper_stock_overrides: {
        Row: {
          id: string;
          sales_order_id: string | null;
          purchase_order_id: string | null;
          auto_quantity: number;
          override_quantity: number;
          note: string | null;
          reverted_at: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          sales_order_id?: string | null;
          purchase_order_id?: string | null;
          auto_quantity: number;
          override_quantity: number;
          note?: string | null;
          reverted_at?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          sales_order_id?: string | null;
          purchase_order_id?: string | null;
          auto_quantity?: number;
          override_quantity?: number;
          note?: string | null;
          reverted_at?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "paper_stock_overrides_sales_order_id_fkey";
            columns: ["sales_order_id"];
            isOneToOne: false;
            referencedRelation: "sales_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "paper_stock_overrides_purchase_order_id_fkey";
            columns: ["purchase_order_id"];
            isOneToOne: false;
            referencedRelation: "purchase_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "paper_stock_overrides_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      payment_requests: {
        Row: {
          id: string;
          title: string | null;
          content: string;
          amount: number | null;
          department: string | null;
          period_from: string | null;
          period_to: string | null;
          card_type: "개인카드" | "하나법인카드" | "신한법인카드";
          requested_by: string | null;
          created_at: string;
          month_key: string | null;
        };
        Insert: {
          id?: string;
          title?: string | null;
          content?: string;
          amount?: number | null;
          department?: string | null;
          period_from?: string | null;
          period_to?: string | null;
          card_type?: "개인카드" | "하나법인카드" | "신한법인카드";
          requested_by?: string | null;
          created_at?: string;
          month_key?: string | null;
        };
        Update: {
          id?: string;
          title?: string | null;
          content?: string;
          amount?: number | null;
          department?: string | null;
          period_from?: string | null;
          period_to?: string | null;
          card_type?: "개인카드" | "하나법인카드" | "신한법인카드";
          requested_by?: string | null;
          created_at?: string;
          month_key?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "payment_requests_requested_by_fkey";
            columns: ["requested_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      payment_request_line_items: {
        Row: {
          id: string;
          payment_request_id: string;
          used_at: string;
          vendor: string;
          purpose: string | null;
          amount: number;
          remark: string | null;
          sort_order: number;
          is_highlighted: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          payment_request_id: string;
          used_at: string;
          vendor: string;
          purpose?: string | null;
          amount?: number;
          remark?: string | null;
          sort_order?: number;
          is_highlighted?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          payment_request_id?: string;
          used_at?: string;
          vendor?: string;
          purpose?: string | null;
          amount?: number;
          remark?: string | null;
          sort_order?: number;
          is_highlighted?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payment_request_line_items_payment_request_id_fkey";
            columns: ["payment_request_id"];
            isOneToOne: false;
            referencedRelation: "payment_requests";
            referencedColumns: ["id"];
          },
        ];
      };
      payment_request_receipts: {
        Row: {
          id: string;
          payment_request_id: string;
          file_path: string;
          file_url: string;
          sort_order: number;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          payment_request_id: string;
          file_path: string;
          file_url: string;
          sort_order?: number;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          payment_request_id?: string;
          file_path?: string;
          file_url?: string;
          sort_order?: number;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payment_request_receipts_payment_request_id_fkey";
            columns: ["payment_request_id"];
            isOneToOne: false;
            referencedRelation: "payment_requests";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payment_request_receipts_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      todos: {
        Row: {
          id: string;
          title: string;
          memo: string;
          items: Json;
          todo_type: "purchase" | "sale" | "both";
          ship_date: string | null;
          supplier_id: string | null;
          customer_id: string | null;
          purchase_done_at: string | null;
          sale_done_at: string | null;
          due_date: string | null;
          done: boolean;
          done_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          memo?: string;
          items?: Json;
          todo_type?: "purchase" | "sale" | "both";
          ship_date?: string | null;
          supplier_id?: string | null;
          customer_id?: string | null;
          purchase_done_at?: string | null;
          sale_done_at?: string | null;
          due_date?: string | null;
          done?: boolean;
          done_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          memo?: string;
          items?: Json;
          todo_type?: "purchase" | "sale" | "both";
          ship_date?: string | null;
          supplier_id?: string | null;
          customer_id?: string | null;
          purchase_done_at?: string | null;
          sale_done_at?: string | null;
          due_date?: string | null;
          done?: boolean;
          done_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "todos_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "todos_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "todos_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
        ];
      };
      announcements: {
        Row: {
          id: string;
          title: string;
          content: string;
          pinned: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          content?: string;
          pinned?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          content?: string;
          pinned?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "announcements_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      announcement_reads: {
        Row: {
          announcement_id: string;
          user_id: string;
          read_at: string;
        };
        Insert: {
          announcement_id: string;
          user_id: string;
          read_at?: string;
        };
        Update: {
          announcement_id?: string;
          user_id?: string;
          read_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "announcement_reads_announcement_id_fkey";
            columns: ["announcement_id"];
            isOneToOne: false;
            referencedRelation: "announcements";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "announcement_reads_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      messenger_messages: {
        Row: {
          id: string;
          sender_id: string | null;
          content: string;
          file_url: string | null;
          file_path: string | null;
          file_name: string | null;
          file_size: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          sender_id?: string | null;
          content?: string;
          file_url?: string | null;
          file_path?: string | null;
          file_name?: string | null;
          file_size?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          sender_id?: string | null;
          content?: string;
          file_url?: string | null;
          file_path?: string | null;
          file_name?: string | null;
          file_size?: number | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "messenger_messages_sender_id_fkey";
            columns: ["sender_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_logs: {
        Row: {
          id: string;
          table_name: string;
          record_id: string;
          action: string;
          actor: string | null;
          old_data: Json | null;
          new_data: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          table_name: string;
          record_id: string;
          action: string;
          actor?: string | null;
          old_data?: Json | null;
          new_data?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          table_name?: string;
          record_id?: string;
          action?: string;
          actor?: string | null;
          old_data?: Json | null;
          new_data?: Json | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_fkey";
            columns: ["actor"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      get_email_for_username: {
        Args: { p_username: string };
        Returns: string | null;
      };
      create_sale_with_items: {
        Args: {
          p_customer_id: string;
          p_warehouse_id: string;
          p_order_date: string;
          p_memo: string | null;
          p_created_by: string | null;
          p_items: Json;
          p_payment_method?: string | null;
          p_delivery_method?: string | null;
          p_doc_no?: number | null;
          p_is_return?: boolean;
          p_return_reason?: string | null;
          p_is_carryover?: boolean;
        };
        Returns: string;
      };
      create_purchase_with_items: {
        Args: {
          p_supplier_id: string;
          p_warehouse_id: string;
          p_purchase_date: string;
          p_memo: string | null;
          p_created_by: string | null;
          p_items: Json;
          p_payment_method?: string | null;
          p_delivery_method?: string | null;
          p_doc_no?: number | null;
          p_is_carryover?: boolean;
        };
        Returns: string;
      };
      update_sale_with_items: {
        Args: {
          p_id: string;
          p_customer_id: string;
          p_warehouse_id: string;
          p_order_date: string;
          p_memo: string | null;
          p_updated_by: string | null;
          p_items: Json;
          p_payment_method?: string | null;
          p_delivery_method?: string | null;
          p_doc_no?: number | null;
          p_is_return?: boolean | null;
          p_return_reason?: string | null;
          p_is_carryover?: boolean | null;
        };
        Returns: string;
      };
      update_purchase_with_items: {
        Args: {
          p_id: string;
          p_supplier_id: string;
          p_warehouse_id: string;
          p_purchase_date: string;
          p_memo: string | null;
          p_updated_by: string | null;
          p_items: Json;
          p_payment_method?: string | null;
          p_delivery_method?: string | null;
          p_doc_no?: number | null;
          p_is_carryover?: boolean | null;
        };
        Returns: string;
      };
      create_purchase_and_sale_with_items: {
        Args: {
          p_supplier_id: string;
          p_customer_id: string;
          p_warehouse_id: string;
          p_purchase_date: string;
          p_sale_date: string;
          p_purchase_memo: string | null;
          p_sale_memo: string | null;
          p_created_by: string | null;
          p_purchase_items: Json;
          p_sale_items: Json;
          p_payment_method?: string | null;
          p_delivery_method?: string | null;
          p_purchase_doc_no?: number | null;
          p_sale_doc_no?: number | null;
        };
        Returns: { purchase_order_id: string; sale_order_id: string }[];
      };
      delete_sale_with_items: {
        Args: { p_id: string; p_deleted_by: string | null };
        Returns: void;
      };
      delete_purchase_with_items: {
        Args: { p_id: string; p_deleted_by: string | null };
        Returns: void;
      };
      create_payment_request_with_items: {
        Args: {
          p_department: string | null;
          p_period_from: string | null;
          p_period_to: string | null;
          p_card_type: string;
          p_requested_by: string | null;
          p_items: Json;
        };
        Returns: string;
      };
      update_payment_request_with_items: {
        Args: {
          p_id: string;
          p_department: string | null;
          p_period_from: string | null;
          p_period_to: string | null;
          p_card_type: string;
          p_items: Json;
        };
        Returns: string;
      };
      find_or_create_payment_request_bucket: {
        Args: {
          p_department: string;
          p_card_type: string;
          p_month_key: string;
          p_requested_by: string | null;
        };
        Returns: string;
      };
      get_database_size: {
        Args: Record<string, never>;
        Returns: number;
      };
      get_storage_size: {
        Args: Record<string, never>;
        Returns: number;
      };
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      toggle_todo_done: {
        Args: { p_id: string };
        Returns: undefined;
      };
      mark_todo_side_done: {
        Args: { p_id: string; p_side: string };
        Returns: undefined;
      };
      apply_due_price_schedules: {
        Args: { p_customer_id: string | null };
        Returns: undefined;
      };
      apply_due_purchase_price_schedules: {
        Args: { p_supplier_id: string | null };
        Returns: undefined;
      };
      insert_payment_request_line_item: {
        Args: {
          p_payment_request_id: string;
          p_used_at: string;
          p_vendor: string;
          p_purpose: string | null;
          p_amount: number;
          p_remark: string | null;
          p_is_highlighted: boolean;
        };
        Returns: string;
      };
      insert_payment_request_receipt: {
        Args: {
          p_payment_request_id: string;
          p_file_path: string;
          p_file_url: string;
          p_created_by: string | null;
        };
        Returns: string;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
