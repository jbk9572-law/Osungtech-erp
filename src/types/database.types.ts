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
          department_id: string | null;
          position_title: string | null;
          signature_image_url: string | null;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          username?: string | null;
          email?: string | null;
          role?: "admin" | "manager" | "staff";
          is_demo?: boolean;
          created_at?: string;
          department_id?: string | null;
          position_title?: string | null;
          signature_image_url?: string | null;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          username?: string | null;
          email?: string | null;
          role?: "admin" | "manager" | "staff";
          is_demo?: boolean;
          created_at?: string;
          department_id?: string | null;
          position_title?: string | null;
          signature_image_url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_department_id_fkey";
            columns: ["department_id"];
            isOneToOne: false;
            referencedRelation: "departments";
            referencedColumns: ["id"];
          },
        ];
      };
      departments: {
        Row: {
          id: string;
          name: string;
          parent_department_id: string | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          parent_department_id?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          parent_department_id?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "departments_parent_department_id_fkey";
            columns: ["parent_department_id"];
            isOneToOne: false;
            referencedRelation: "departments";
            referencedColumns: ["id"];
          },
        ];
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
          supplier_code: string;
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
          supplier_code?: string;
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
          supplier_code?: string;
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
          label_direction: string;
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
          label_direction?: string;
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
          label_direction?: string;
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
      attendance_records: {
        Row: {
          id: string;
          user_id: string;
          work_date: string;
          clock_in_at: string | null;
          clock_out_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          work_date?: string;
          clock_in_at?: string | null;
          clock_out_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          work_date?: string;
          clock_in_at?: string | null;
          clock_out_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "attendance_records_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      attendance_correction_requests: {
        Row: {
          id: string;
          user_id: string;
          work_date: string;
          requested_clock_in_at: string | null;
          requested_clock_out_at: string | null;
          reason: string;
          status: string;
          approval_document_id: string | null;
          created_at: string;
          decided_at: string | null;
          decided_by: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          work_date: string;
          requested_clock_in_at?: string | null;
          requested_clock_out_at?: string | null;
          reason: string;
          status?: string;
          approval_document_id?: string | null;
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          work_date?: string;
          requested_clock_in_at?: string | null;
          requested_clock_out_at?: string | null;
          reason?: string;
          status?: string;
          approval_document_id?: string | null;
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "attendance_correction_requests_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attendance_correction_requests_approval_document_id_fkey";
            columns: ["approval_document_id"];
            isOneToOne: false;
            referencedRelation: "approval_documents";
            referencedColumns: ["id"];
          },
        ];
      };
      leave_requests: {
        Row: {
          id: string;
          user_id: string;
          start_date: string;
          end_date: string;
          days: number;
          reason: string | null;
          status: string;
          created_at: string;
          decided_at: string | null;
          decided_by: string | null;
          approval_document_id: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          start_date: string;
          end_date: string;
          days: number;
          reason?: string | null;
          status?: string;
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          approval_document_id?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          start_date?: string;
          end_date?: string;
          days?: number;
          reason?: string | null;
          status?: string;
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          approval_document_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "leave_requests_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "leave_requests_approval_document_id_fkey";
            columns: ["approval_document_id"];
            isOneToOne: false;
            referencedRelation: "approval_documents";
            referencedColumns: ["id"];
          },
        ];
      };
      leave_balances: {
        Row: {
          id: string;
          user_id: string;
          year: number;
          total_days: number;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          year: number;
          total_days?: number;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          year?: number;
          total_days?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "leave_balances_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      payroll_rate_settings: {
        Row: {
          id: string;
          year: number;
          min_wage_hourly: number;
          national_pension_rate: number;
          health_insurance_rate: number;
          long_term_care_rate: number;
          employment_insurance_rate: number;
          source_note: string | null;
          last_confirmed_at: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          id?: string;
          year: number;
          min_wage_hourly?: number;
          national_pension_rate?: number;
          health_insurance_rate?: number;
          long_term_care_rate?: number;
          employment_insurance_rate?: number;
          source_note?: string | null;
          last_confirmed_at?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          id?: string;
          year?: number;
          min_wage_hourly?: number;
          national_pension_rate?: number;
          health_insurance_rate?: number;
          long_term_care_rate?: number;
          employment_insurance_rate?: number;
          source_note?: string | null;
          last_confirmed_at?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "payroll_rate_settings_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      employee_pay_settings: {
        Row: {
          id: string;
          user_id: string;
          monthly_base_pay: number;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          monthly_base_pay?: number;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          monthly_base_pay?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "employee_pay_settings_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      payslips: {
        Row: {
          id: string;
          user_id: string;
          pay_month: string;
          base_pay: number;
          gross_pay: number;
          pension_deduction: number;
          health_deduction: number;
          long_term_care_deduction: number;
          employment_deduction: number;
          total_deduction: number;
          net_pay: number;
          rate_year: number;
          status: string;
          created_at: string;
          confirmed_at: string | null;
          confirmed_by: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          pay_month: string;
          base_pay?: number;
          gross_pay?: number;
          pension_deduction?: number;
          health_deduction?: number;
          long_term_care_deduction?: number;
          employment_deduction?: number;
          total_deduction?: number;
          net_pay?: number;
          rate_year: number;
          status?: string;
          created_at?: string;
          confirmed_at?: string | null;
          confirmed_by?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          pay_month?: string;
          base_pay?: number;
          gross_pay?: number;
          pension_deduction?: number;
          health_deduction?: number;
          long_term_care_deduction?: number;
          employment_deduction?: number;
          total_deduction?: number;
          net_pay?: number;
          rate_year?: number;
          status?: string;
          created_at?: string;
          confirmed_at?: string | null;
          confirmed_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "payslips_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      document_templates: {
        Row: {
          id: string;
          category: string;
          name: string;
          body: string;
          is_active: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          category?: string;
          name: string;
          body?: string;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          category?: string;
          name?: string;
          body?: string;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "document_templates_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      document_instances: {
        Row: {
          id: string;
          template_id: string | null;
          category: string;
          title: string;
          subject_user_id: string | null;
          field_values: Json;
          rendered_body: string;
          status: string;
          created_by: string | null;
          created_at: string;
          issued_at: string | null;
        };
        Insert: {
          id?: string;
          template_id?: string | null;
          category?: string;
          title: string;
          subject_user_id?: string | null;
          field_values?: Json;
          rendered_body?: string;
          status?: string;
          created_by?: string | null;
          created_at?: string;
          issued_at?: string | null;
        };
        Update: {
          id?: string;
          template_id?: string | null;
          category?: string;
          title?: string;
          subject_user_id?: string | null;
          field_values?: Json;
          rendered_body?: string;
          status?: string;
          created_by?: string | null;
          created_at?: string;
          issued_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "document_instances_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "document_templates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "document_instances_subject_user_id_fkey";
            columns: ["subject_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "document_instances_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      tenants: {
        Row: {
          id: string;
          name: string;
          slug: string;
          created_at: string;
          disabled_features: string[];
          disabled_at: string | null;
          plan: string;
          plan_started_at: string | null;
          plan_expires_at: string | null;
          points_balance: number;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          created_at?: string;
          disabled_features?: string[];
          disabled_at?: string | null;
          plan?: string;
          plan_started_at?: string | null;
          plan_expires_at?: string | null;
          points_balance?: number;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          created_at?: string;
          disabled_features?: string[];
          disabled_at?: string | null;
          plan?: string;
          plan_started_at?: string | null;
          plan_expires_at?: string | null;
          points_balance?: number;
        };
        Relationships: [];
      };
      platform_settings: {
        Row: {
          id: boolean;
          default_plan: string;
          default_disabled_features: string[];
          updated_at: string;
        };
        Insert: {
          id?: boolean;
          default_plan?: string;
          default_disabled_features?: string[];
          updated_at?: string;
        };
        Update: {
          id?: boolean;
          default_plan?: string;
          default_disabled_features?: string[];
          updated_at?: string;
        };
        Relationships: [];
      };
      platform_announcements: {
        Row: {
          id: string;
          title: string;
          content: string | null;
          is_active: boolean;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          content?: string | null;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          content?: string | null;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      platform_plans: {
        Row: {
          id: string;
          plan_key: string;
          name: string;
          monthly_price: number;
          description: string | null;
          is_active: boolean;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          plan_key: string;
          name: string;
          monthly_price?: number;
          description?: string | null;
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          plan_key?: string;
          name?: string;
          monthly_price?: number;
          description?: string | null;
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      point_transactions: {
        Row: {
          id: string;
          tenant_id: string;
          delta: number;
          action_type: string | null;
          reason: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          delta: number;
          action_type?: string | null;
          reason?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          delta?: number;
          action_type?: string | null;
          reason?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "point_transactions_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      tenant_members: {
        Row: {
          id: string;
          tenant_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          user_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tenant_members_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      approval_documents: {
        Row: {
          id: string;
          title: string;
          content: string;
          status: string;
          created_by: string | null;
          created_at: string;
          decided_at: string | null;
          recalled_at: string | null;
          draft_approver_ids: string[];
          draft_reference_ids: string[];
        };
        Insert: {
          id?: string;
          title: string;
          content?: string;
          status?: string;
          created_by?: string | null;
          created_at?: string;
          decided_at?: string | null;
          recalled_at?: string | null;
          draft_approver_ids?: string[];
          draft_reference_ids?: string[];
        };
        Update: {
          id?: string;
          title?: string;
          content?: string;
          status?: string;
          created_by?: string | null;
          created_at?: string;
          decided_at?: string | null;
          recalled_at?: string | null;
          draft_approver_ids?: string[];
          draft_reference_ids?: string[];
        };
        Relationships: [
          {
            foreignKeyName: "approval_documents_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      approval_steps: {
        Row: {
          id: string;
          document_id: string;
          step_order: number | null;
          approver_id: string;
          status: string;
          role: string;
          comment: string | null;
          decided_at: string | null;
          decided_by: string | null;
        };
        Insert: {
          id?: string;
          document_id: string;
          step_order?: number | null;
          approver_id: string;
          status?: string;
          role?: string;
          comment?: string | null;
          decided_at?: string | null;
          decided_by?: string | null;
        };
        Update: {
          id?: string;
          document_id?: string;
          step_order?: number | null;
          approver_id?: string;
          status?: string;
          role?: string;
          comment?: string | null;
          decided_at?: string | null;
          decided_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "approval_steps_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "approval_documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "approval_steps_approver_id_fkey";
            columns: ["approver_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "approval_steps_decided_by_fkey";
            columns: ["decided_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      approval_delegations: {
        Row: {
          id: string;
          delegator_id: string;
          delegate_id: string;
          start_date: string;
          end_date: string;
          reason: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          delegator_id: string;
          delegate_id: string;
          start_date: string;
          end_date: string;
          reason?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          delegator_id?: string;
          delegate_id?: string;
          start_date?: string;
          end_date?: string;
          reason?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "approval_delegations_delegator_id_fkey";
            columns: ["delegator_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "approval_delegations_delegate_id_fkey";
            columns: ["delegate_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      approval_line_presets: {
        Row: {
          id: string;
          name: string;
          approver_ids: string[];
          reference_ids: string[];
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          approver_ids?: string[];
          reference_ids?: string[];
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          approver_ids?: string[];
          reference_ids?: string[];
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "approval_line_presets_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      approval_matrix_rules: {
        Row: {
          id: string;
          template_id: string;
          preset_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          template_id: string;
          preset_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          template_id?: string;
          preset_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "approval_matrix_rules_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: true;
            referencedRelation: "document_templates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "approval_matrix_rules_preset_id_fkey";
            columns: ["preset_id"];
            isOneToOne: false;
            referencedRelation: "approval_line_presets";
            referencedColumns: ["id"];
          },
        ];
      };
      bom_items: {
        Row: {
          id: string;
          parent_product_id: string;
          component_product_id: string;
          quantity_per_unit: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          parent_product_id: string;
          component_product_id: string;
          quantity_per_unit: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          parent_product_id?: string;
          component_product_id?: string;
          quantity_per_unit?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bom_items_parent_product_id_fkey";
            columns: ["parent_product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bom_items_component_product_id_fkey";
            columns: ["component_product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      work_orders: {
        Row: {
          id: string;
          product_id: string;
          warehouse_id: string;
          quantity: number;
          order_date: string;
          memo: string | null;
          doc_no: number;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          warehouse_id: string;
          quantity: number;
          order_date: string;
          memo?: string | null;
          doc_no?: number;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          warehouse_id?: string;
          quantity?: number;
          order_date?: string;
          memo?: string | null;
          doc_no?: number;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "work_orders_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "work_orders_warehouse_id_fkey";
            columns: ["warehouse_id"];
            isOneToOne: false;
            referencedRelation: "warehouses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "work_orders_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
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
      locations: {
        Row: {
          id: string;
          warehouse_id: string;
          rack: string;
          tier: number;
          position: number;
          code: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          warehouse_id: string;
          rack: string;
          tier: number;
          position: number;
          code: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          warehouse_id?: string;
          rack?: string;
          tier?: number;
          position?: number;
          code?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "locations_warehouse_id_fkey";
            columns: ["warehouse_id"];
            isOneToOne: false;
            referencedRelation: "warehouses";
            referencedColumns: ["id"];
          },
        ];
      };
      inventory_locations: {
        Row: {
          id: string;
          product_id: string;
          location_id: string;
          quantity: number;
          updated_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          location_id: string;
          quantity?: number;
          updated_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          location_id?: string;
          quantity?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_locations_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_locations_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
        ];
      };
      location_stock_history: {
        Row: {
          id: string;
          location_id: string | null;
          location_code: string;
          product_id: string | null;
          product_sku: string | null;
          product_name: string | null;
          product_spec: string | null;
          previous_quantity: number | null;
          new_quantity: number | null;
          actor: string | null;
          created_at: string;
          reason: "manual" | "in" | "out";
        };
        Insert: {
          id?: string;
          location_id?: string | null;
          location_code: string;
          product_id?: string | null;
          product_sku?: string | null;
          product_name?: string | null;
          product_spec?: string | null;
          previous_quantity?: number | null;
          new_quantity?: number | null;
          actor?: string | null;
          created_at?: string;
          reason?: "manual" | "in" | "out";
        };
        Update: {
          id?: string;
          location_id?: string | null;
          location_code?: string;
          product_id?: string | null;
          product_sku?: string | null;
          product_name?: string | null;
          product_spec?: string | null;
          previous_quantity?: number | null;
          new_quantity?: number | null;
          actor?: string | null;
          created_at?: string;
          reason?: "manual" | "in" | "out";
        };
        Relationships: [
          {
            foreignKeyName: "location_stock_history_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "location_stock_history_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "location_stock_history_actor_fkey";
            columns: ["actor"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      order_item_location_stock: {
        Row: {
          id: string;
          order_type: "sale" | "purchase";
          order_id: string;
          product_id: string;
          location_id: string;
          quantity_delta: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_type: "sale" | "purchase";
          order_id: string;
          product_id: string;
          location_id: string;
          quantity_delta: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_type?: "sale" | "purchase";
          order_id?: string;
          product_id?: string;
          location_id?: string;
          quantity_delta?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "order_item_location_stock_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_item_location_stock_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
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
      stock_transfers: {
        Row: {
          id: string;
          tenant_id: string;
          from_warehouse_id: string;
          to_warehouse_id: string;
          transfer_date: string;
          memo: string | null;
          is_demo: boolean;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id?: string;
          from_warehouse_id: string;
          to_warehouse_id: string;
          transfer_date?: string;
          memo?: string | null;
          is_demo?: boolean;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          from_warehouse_id?: string;
          to_warehouse_id?: string;
          transfer_date?: string;
          memo?: string | null;
          is_demo?: boolean;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stock_transfers_from_warehouse_id_fkey";
            columns: ["from_warehouse_id"];
            isOneToOne: false;
            referencedRelation: "warehouses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_transfers_to_warehouse_id_fkey";
            columns: ["to_warehouse_id"];
            isOneToOne: false;
            referencedRelation: "warehouses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_transfers_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      stock_transfer_items: {
        Row: {
          id: string;
          tenant_id: string;
          stock_transfer_id: string;
          product_id: string;
          quantity: number;
          remark: string | null;
          is_demo: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id?: string;
          stock_transfer_id: string;
          product_id: string;
          quantity: number;
          remark?: string | null;
          is_demo?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          stock_transfer_id?: string;
          product_id?: string;
          quantity?: number;
          remark?: string | null;
          is_demo?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stock_transfer_items_stock_transfer_id_fkey";
            columns: ["stock_transfer_id"];
            isOneToOne: false;
            referencedRelation: "stock_transfers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_transfer_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
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
          customer_code: string;
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
          tenant_id: string;
        };
        Insert: {
          id?: string;
          name: string;
          customer_code?: string;
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
          tenant_id?: string;
        };
        Update: {
          id?: string;
          name?: string;
          customer_code?: string;
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
          tenant_id?: string;
        };
        Relationships: [];
      };
      sales_activities: {
        Row: {
          id: string;
          tenant_id: string;
          customer_id: string;
          activity_type: "전화" | "방문" | "이메일" | "기타";
          subject: string;
          content: string | null;
          activity_date: string;
          next_action_date: string | null;
          next_action_memo: string | null;
          next_action_done: boolean;
          is_demo: boolean;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id?: string;
          customer_id: string;
          activity_type?: "전화" | "방문" | "이메일" | "기타";
          subject: string;
          content?: string | null;
          activity_date?: string;
          next_action_date?: string | null;
          next_action_memo?: string | null;
          next_action_done?: boolean;
          is_demo?: boolean;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          customer_id?: string;
          activity_type?: "전화" | "방문" | "이메일" | "기타";
          subject?: string;
          content?: string | null;
          activity_date?: string;
          next_action_date?: string | null;
          next_action_memo?: string | null;
          next_action_done?: boolean;
          is_demo?: boolean;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sales_activities_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
        ];
      };
      quotes: {
        Row: {
          id: string;
          tenant_id: string;
          customer_id: string;
          doc_no: number;
          quote_date: string;
          valid_until: string | null;
          status: "draft" | "sent" | "accepted" | "rejected" | "expired";
          memo: string | null;
          converted_sales_order_id: string | null;
          is_demo: boolean;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id?: string;
          customer_id: string;
          doc_no?: number;
          quote_date?: string;
          valid_until?: string | null;
          status?: "draft" | "sent" | "accepted" | "rejected" | "expired";
          memo?: string | null;
          converted_sales_order_id?: string | null;
          is_demo?: boolean;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          customer_id?: string;
          doc_no?: number;
          quote_date?: string;
          valid_until?: string | null;
          status?: "draft" | "sent" | "accepted" | "rejected" | "expired";
          memo?: string | null;
          converted_sales_order_id?: string | null;
          is_demo?: boolean;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "quotes_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quotes_converted_sales_order_id_fkey";
            columns: ["converted_sales_order_id"];
            isOneToOne: false;
            referencedRelation: "sales_orders";
            referencedColumns: ["id"];
          },
        ];
      };
      quote_items: {
        Row: {
          id: string;
          tenant_id: string;
          quote_id: string;
          product_id: string | null;
          custom_name: string | null;
          spec: string | null;
          quantity: number;
          unit_price: number;
          remark: string | null;
          is_demo: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id?: string;
          quote_id: string;
          product_id?: string | null;
          custom_name?: string | null;
          spec?: string | null;
          quantity: number;
          unit_price?: number;
          remark?: string | null;
          is_demo?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          quote_id?: string;
          product_id?: string | null;
          custom_name?: string | null;
          spec?: string | null;
          quantity?: number;
          unit_price?: number;
          remark?: string | null;
          is_demo?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "quote_items_quote_id_fkey";
            columns: ["quote_id"];
            isOneToOne: false;
            referencedRelation: "quotes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quote_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      purchase_requests: {
        Row: {
          id: string;
          tenant_id: string;
          supplier_id: string;
          request_date: string;
          memo: string | null;
          status: "draft" | "pending" | "approved" | "rejected";
          approval_document_id: string | null;
          decided_at: string | null;
          decided_by: string | null;
          converted_purchase_order_id: string | null;
          is_demo: boolean;
          requested_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id?: string;
          supplier_id: string;
          request_date?: string;
          memo?: string | null;
          status?: "draft" | "pending" | "approved" | "rejected";
          approval_document_id?: string | null;
          decided_at?: string | null;
          decided_by?: string | null;
          converted_purchase_order_id?: string | null;
          is_demo?: boolean;
          requested_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          supplier_id?: string;
          request_date?: string;
          memo?: string | null;
          status?: "draft" | "pending" | "approved" | "rejected";
          approval_document_id?: string | null;
          decided_at?: string | null;
          decided_by?: string | null;
          converted_purchase_order_id?: string | null;
          is_demo?: boolean;
          requested_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "purchase_requests_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchase_requests_converted_purchase_order_id_fkey";
            columns: ["converted_purchase_order_id"];
            isOneToOne: false;
            referencedRelation: "purchase_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchase_requests_requested_by_fkey";
            columns: ["requested_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      purchase_request_items: {
        Row: {
          id: string;
          tenant_id: string;
          purchase_request_id: string;
          product_id: string | null;
          custom_name: string | null;
          spec: string | null;
          quantity: number;
          estimated_unit_price: number;
          remark: string | null;
          is_demo: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id?: string;
          purchase_request_id: string;
          product_id?: string | null;
          custom_name?: string | null;
          spec?: string | null;
          quantity: number;
          estimated_unit_price?: number;
          remark?: string | null;
          is_demo?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          purchase_request_id?: string;
          product_id?: string | null;
          custom_name?: string | null;
          spec?: string | null;
          quantity?: number;
          estimated_unit_price?: number;
          remark?: string | null;
          is_demo?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "purchase_request_items_purchase_request_id_fkey";
            columns: ["purchase_request_id"];
            isOneToOne: false;
            referencedRelation: "purchase_requests";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchase_request_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      purchase_quote_requests: {
        Row: {
          id: string;
          tenant_id: string;
          request_date: string;
          memo: string | null;
          status: "open" | "closed";
          target_supplier_ids: string[];
          selected_supplier_id: string | null;
          converted_purchase_request_id: string | null;
          is_demo: boolean;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id?: string;
          request_date?: string;
          memo?: string | null;
          status?: "open" | "closed";
          target_supplier_ids?: string[];
          selected_supplier_id?: string | null;
          converted_purchase_request_id?: string | null;
          is_demo?: boolean;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          request_date?: string;
          memo?: string | null;
          status?: "open" | "closed";
          target_supplier_ids?: string[];
          selected_supplier_id?: string | null;
          converted_purchase_request_id?: string | null;
          is_demo?: boolean;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "purchase_quote_requests_selected_supplier_id_fkey";
            columns: ["selected_supplier_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchase_quote_requests_converted_purchase_request_id_fkey";
            columns: ["converted_purchase_request_id"];
            isOneToOne: false;
            referencedRelation: "purchase_requests";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchase_quote_requests_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      purchase_quote_request_items: {
        Row: {
          id: string;
          tenant_id: string;
          purchase_quote_request_id: string;
          product_id: string | null;
          custom_name: string | null;
          spec: string | null;
          quantity: number;
          remark: string | null;
          is_demo: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id?: string;
          purchase_quote_request_id: string;
          product_id?: string | null;
          custom_name?: string | null;
          spec?: string | null;
          quantity: number;
          remark?: string | null;
          is_demo?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          purchase_quote_request_id?: string;
          product_id?: string | null;
          custom_name?: string | null;
          spec?: string | null;
          quantity?: number;
          remark?: string | null;
          is_demo?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "purchase_quote_request_items_purchase_quote_request_id_fkey";
            columns: ["purchase_quote_request_id"];
            isOneToOne: false;
            referencedRelation: "purchase_quote_requests";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchase_quote_request_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      purchase_quote_prices: {
        Row: {
          id: string;
          tenant_id: string;
          purchase_quote_request_id: string;
          purchase_quote_request_item_id: string;
          supplier_id: string;
          unit_price: number;
          remark: string | null;
          is_demo: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id?: string;
          purchase_quote_request_id: string;
          purchase_quote_request_item_id: string;
          supplier_id: string;
          unit_price?: number;
          remark?: string | null;
          is_demo?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          purchase_quote_request_id?: string;
          purchase_quote_request_item_id?: string;
          supplier_id?: string;
          unit_price?: number;
          remark?: string | null;
          is_demo?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "purchase_quote_prices_purchase_quote_request_id_fkey";
            columns: ["purchase_quote_request_id"];
            isOneToOne: false;
            referencedRelation: "purchase_quote_requests";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchase_quote_prices_purchase_quote_request_item_id_fkey";
            columns: ["purchase_quote_request_item_id"];
            isOneToOne: false;
            referencedRelation: "purchase_quote_request_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchase_quote_prices_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["id"];
          },
        ];
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
          invoice_status: string;
          invoice_number: string | null;
          invoice_issued_at: string | null;
          invoice_provider: string;
          tax_type: "과세" | "면세" | "영세";
          evidence_type: "세금계산서" | "계산서" | "현금영수증" | "카드매출전표" | null;
          statement_issued_at: string | null;
          tenant_id: string;
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
          invoice_status?: string;
          invoice_number?: string | null;
          invoice_issued_at?: string | null;
          invoice_provider?: string;
          tax_type?: "과세" | "면세" | "영세";
          evidence_type?: "세금계산서" | "계산서" | "현금영수증" | "카드매출전표" | null;
          statement_issued_at?: string | null;
          tenant_id?: string;
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
          invoice_status?: string;
          invoice_number?: string | null;
          invoice_issued_at?: string | null;
          invoice_provider?: string;
          tax_type?: "과세" | "면세" | "영세";
          evidence_type?: "세금계산서" | "계산서" | "현금영수증" | "카드매출전표" | null;
          statement_issued_at?: string | null;
          tenant_id?: string;
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
          product_id: string | null;
          custom_name: string | null;
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
          product_id?: string | null;
          custom_name?: string | null;
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
          product_id?: string | null;
          custom_name?: string | null;
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
          tax_type: "과세" | "면세" | "영세";
          evidence_type: "세금계산서" | "계산서" | "현금영수증" | "카드매출전표" | null;
          statement_issued_at: string | null;
          tenant_id: string;
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
          tax_type?: "과세" | "면세" | "영세";
          evidence_type?: "세금계산서" | "계산서" | "현금영수증" | "카드매출전표" | null;
          statement_issued_at?: string | null;
          tenant_id?: string;
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
          tax_type?: "과세" | "면세" | "영세";
          evidence_type?: "세금계산서" | "계산서" | "현금영수증" | "카드매출전표" | null;
          statement_issued_at?: string | null;
          tenant_id?: string;
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
          product_id: string | null;
          custom_name: string | null;
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
          product_id?: string | null;
          custom_name?: string | null;
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
          product_id?: string | null;
          custom_name?: string | null;
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
          status: string;
          approval_document_id: string | null;
          decided_at: string | null;
          decided_by: string | null;
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
          status?: string;
          approval_document_id?: string | null;
          decided_at?: string | null;
          decided_by?: string | null;
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
          status?: string;
          approval_document_id?: string | null;
          decided_at?: string | null;
          decided_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "payment_requests_requested_by_fkey";
            columns: ["requested_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payment_requests_approval_document_id_fkey";
            columns: ["approval_document_id"];
            isOneToOne: false;
            referencedRelation: "approval_documents";
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
      mail_accounts: {
        Row: {
          id: string;
          tenant_id: string;
          user_id: string;
          email_address: string;
          display_name: string | null;
          imap_host: string;
          imap_port: number;
          smtp_host: string;
          smtp_port: number;
          username: string;
          encrypted_app_password: string;
          is_active: boolean;
          last_synced_at: string | null;
          last_sync_error: string | null;
          last_synced_uid: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id?: string;
          user_id: string;
          email_address: string;
          display_name?: string | null;
          imap_host?: string;
          imap_port?: number;
          smtp_host?: string;
          smtp_port?: number;
          username: string;
          encrypted_app_password: string;
          is_active?: boolean;
          last_synced_at?: string | null;
          last_sync_error?: string | null;
          last_synced_uid?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          user_id?: string;
          email_address?: string;
          display_name?: string | null;
          imap_host?: string;
          imap_port?: number;
          smtp_host?: string;
          smtp_port?: number;
          username?: string;
          encrypted_app_password?: string;
          is_active?: boolean;
          last_synced_at?: string | null;
          last_sync_error?: string | null;
          last_synced_uid?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      mail_messages: {
        Row: {
          id: string;
          tenant_id: string;
          mail_account_id: string;
          user_id: string;
          folder: string;
          uid: number;
          message_id: string | null;
          subject: string | null;
          from_address: string | null;
          from_name: string | null;
          to_addresses: Json;
          cc_addresses: Json;
          sent_at: string | null;
          body_text: string | null;
          body_html: string | null;
          snippet: string | null;
          has_attachments: boolean;
          is_read: boolean;
          is_starred: boolean;
          size_bytes: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id?: string;
          mail_account_id: string;
          user_id: string;
          folder: string;
          uid: number;
          message_id?: string | null;
          subject?: string | null;
          from_address?: string | null;
          from_name?: string | null;
          to_addresses?: Json;
          cc_addresses?: Json;
          sent_at?: string | null;
          body_text?: string | null;
          body_html?: string | null;
          snippet?: string | null;
          has_attachments?: boolean;
          is_read?: boolean;
          is_starred?: boolean;
          size_bytes?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          mail_account_id?: string;
          user_id?: string;
          folder?: string;
          uid?: number;
          message_id?: string | null;
          subject?: string | null;
          from_address?: string | null;
          from_name?: string | null;
          to_addresses?: Json;
          cc_addresses?: Json;
          sent_at?: string | null;
          body_text?: string | null;
          body_html?: string | null;
          snippet?: string | null;
          has_attachments?: boolean;
          is_read?: boolean;
          is_starred?: boolean;
          size_bytes?: number | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "mail_messages_mail_account_id_fkey";
            columns: ["mail_account_id"];
            isOneToOne: false;
            referencedRelation: "mail_accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      mail_attachments: {
        Row: {
          id: string;
          tenant_id: string;
          mail_message_id: string;
          user_id: string;
          filename: string;
          content_type: string | null;
          size_bytes: number | null;
          storage_path: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id?: string;
          mail_message_id: string;
          user_id: string;
          filename: string;
          content_type?: string | null;
          size_bytes?: number | null;
          storage_path: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          mail_message_id?: string;
          user_id?: string;
          filename?: string;
          content_type?: string | null;
          size_bytes?: number | null;
          storage_path?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "mail_attachments_mail_message_id_fkey";
            columns: ["mail_message_id"];
            isOneToOne: false;
            referencedRelation: "mail_messages";
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
      ui_grid_column_widths: {
        Row: {
          id: string;
          grid_key: string;
          widths: Json;
          is_demo: boolean;
          updated_at: string;
        };
        Insert: {
          id?: string;
          grid_key: string;
          widths: Json;
          is_demo?: boolean;
          updated_at?: string;
        };
        Update: {
          id?: string;
          grid_key?: string;
          widths?: Json;
          is_demo?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      get_email_for_username: {
        Args: { p_username: string };
        Returns: string | null;
      };
      set_tenant_feature_enabled: {
        Args: { p_feature_key: string; p_enabled: boolean };
        Returns: void;
      };
      set_platform_default_feature_enabled: {
        Args: { p_feature_key: string; p_enabled: boolean };
        Returns: void;
      };
      is_approval_step_approver: {
        Args: { p_document_id: string };
        Returns: boolean;
      };
      is_approval_document_owner: {
        Args: { p_document_id: string };
        Returns: boolean;
      };
      is_active_delegate_for: {
        Args: { p_delegator_id: string };
        Returns: boolean;
      };
      submit_approval_document: {
        Args: { p_title: string; p_content: string; p_approver_ids: string[]; p_reference_ids?: string[] };
        Returns: string;
      };
      decide_approval_step: {
        Args: { p_step_id: string; p_decision: string; p_comment?: string | null };
        Returns: void;
      };
      save_approval_draft: {
        Args: {
          p_id: string | null;
          p_title: string;
          p_content: string;
          p_approver_ids?: string[];
          p_reference_ids?: string[];
        };
        Returns: string;
      };
      submit_approval_draft: {
        Args: { p_id: string };
        Returns: void;
      };
      recall_approval_document: {
        Args: { p_id: string };
        Returns: void;
      };
      submit_leave_request: {
        Args: {
          p_start_date: string;
          p_end_date: string;
          p_days: number;
          p_reason: string | null;
          p_approver_ids: string[];
          p_reference_ids?: string[];
        };
        Returns: string;
      };
      submit_payment_request: {
        Args: { p_id: string; p_approver_ids: string[]; p_reference_ids?: string[] };
        Returns: string;
      };
      recall_payment_request: {
        Args: { p_id: string };
        Returns: void;
      };
      submit_attendance_correction: {
        Args: {
          p_work_date: string;
          p_requested_clock_in_at: string | null;
          p_requested_clock_out_at: string | null;
          p_reason: string;
          p_approver_ids: string[];
          p_reference_ids?: string[];
        };
        Returns: string;
      };
      update_own_signature: {
        Args: { p_url: string | null };
        Returns: void;
      };
      get_ledger_opening_balance: {
        Args: {
          p_product_id: string;
          p_warehouse_id?: string | null;
          p_before?: string;
        };
        Returns: number;
      };
      create_work_order: {
        Args: {
          p_product_id: string;
          p_warehouse_id: string;
          p_quantity: number;
          p_order_date: string;
          p_memo?: string | null;
          p_doc_no?: number | null;
        };
        Returns: string;
      };
      delete_work_order: {
        Args: { p_id: string };
        Returns: void;
      };
      apply_location_stock_delta: {
        Args: { p_product_id: string; p_location_id: string; p_delta: number };
        Returns: void;
      };
      create_quote_with_items: {
        Args: {
          p_customer_id: string;
          p_quote_date: string;
          p_valid_until: string | null;
          p_memo: string | null;
          p_items: Json;
        };
        Returns: string;
      };
      create_purchase_request_with_items: {
        Args: {
          p_supplier_id: string;
          p_request_date: string;
          p_memo: string | null;
          p_items: Json;
        };
        Returns: string;
      };
      create_purchase_quote_request_with_items: {
        Args: {
          p_supplier_ids: string[];
          p_request_date: string;
          p_memo: string | null;
          p_items: Json;
        };
        Returns: string;
      };
      set_purchase_quote_prices: {
        Args: { p_purchase_quote_request_id: string; p_supplier_id: string; p_items: Json };
        Returns: void;
      };
      convert_purchase_quote_request: {
        Args: { p_id: string; p_supplier_id: string };
        Returns: string;
      };
      submit_purchase_request: {
        Args: { p_id: string; p_approver_ids: string[]; p_reference_ids?: string[] };
        Returns: string;
      };
      recall_purchase_request: {
        Args: { p_id: string };
        Returns: void;
      };
      create_stock_transfer_with_items: {
        Args: {
          p_from_warehouse_id: string;
          p_to_warehouse_id: string;
          p_transfer_date: string;
          p_memo: string | null;
          p_items: Json;
        };
        Returns: string;
      };
      delete_stock_transfer: {
        Args: { p_id: string };
        Returns: void;
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
      get_customer_balances: {
        Args: Record<string, never>;
        Returns: { id: string; name: string; total: number; paid: number; balance: number }[];
      };
      get_supplier_balances: {
        Args: Record<string, never>;
        Returns: { id: string; name: string; total: number; paid: number; balance: number }[];
      };
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      is_demo_actor: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      is_platform_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      get_cross_tenant_activity_log: {
        Args: { p_limit?: number };
        Returns: {
          id: string;
          tenant_name: string | null;
          table_name: string;
          action: string;
          actor_name: string | null;
          created_at: string;
        }[];
      };
      get_platform_stats: {
        Args: Record<string, never>;
        Returns: Json;
      };
      get_login_block_reason: {
        Args: { p_username: string };
        Returns: string | null;
      };
      adjust_tenant_points: {
        Args: { p_tenant_id: string; p_delta: number; p_action_type: string | null; p_reason: string | null };
        Returns: number;
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
