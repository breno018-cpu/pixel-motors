export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string | null
          id: string
          ip_address: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      api_keys: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          scopes: string[]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          scopes?: string[]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          scopes?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      bank_credentials: {
        Row: {
          api_environment: string
          bank_code: string
          bank_name: string
          client_id: string | null
          client_secret: string | null
          created_at: string
          created_by: string | null
          extra_config: Json
          id: string
          is_active: boolean
          notes: string | null
          partner_code: string | null
          store_id: string
          updated_at: string
        }
        Insert: {
          api_environment?: string
          bank_code: string
          bank_name: string
          client_id?: string | null
          client_secret?: string | null
          created_at?: string
          created_by?: string | null
          extra_config?: Json
          id?: string
          is_active?: boolean
          notes?: string | null
          partner_code?: string | null
          store_id: string
          updated_at?: string
        }
        Update: {
          api_environment?: string
          bank_code?: string
          bank_name?: string
          client_id?: string | null
          client_secret?: string | null
          created_at?: string
          created_by?: string | null
          extra_config?: Json
          id?: string
          is_active?: boolean
          notes?: string | null
          partner_code?: string | null
          store_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      chassis_patterns: {
        Row: {
          brand: string
          created_at: string
          default_purchase_price: number | null
          default_sale_price: number | null
          engine_cc: number | null
          fuel_type: string | null
          id: string
          model_name: string | null
          model_pattern: string | null
          service_interval_km: number | null
          service_interval_months: number | null
          transmission: string | null
          updated_at: string
          vehicle_type: string
          warranty_months: number | null
          wmi_code: string
        }
        Insert: {
          brand: string
          created_at?: string
          default_purchase_price?: number | null
          default_sale_price?: number | null
          engine_cc?: number | null
          fuel_type?: string | null
          id?: string
          model_name?: string | null
          model_pattern?: string | null
          service_interval_km?: number | null
          service_interval_months?: number | null
          transmission?: string | null
          updated_at?: string
          vehicle_type?: string
          warranty_months?: number | null
          wmi_code: string
        }
        Update: {
          brand?: string
          created_at?: string
          default_purchase_price?: number | null
          default_sale_price?: number | null
          engine_cc?: number | null
          fuel_type?: string | null
          id?: string
          model_name?: string | null
          model_pattern?: string | null
          service_interval_km?: number | null
          service_interval_months?: number | null
          transmission?: string | null
          updated_at?: string
          vehicle_type?: string
          warranty_months?: number | null
          wmi_code?: string
        }
        Relationships: []
      }
      chassis_year_codes: {
        Row: {
          brand: string | null
          created_at: string
          created_by: string | null
          id: string
          manufacture_year: number | null
          model_year: number
          notes: string | null
          updated_at: string
          year_code: string
        }
        Insert: {
          brand?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          manufacture_year?: number | null
          model_year: number
          notes?: string | null
          updated_at?: string
          year_code: string
        }
        Update: {
          brand?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          manufacture_year?: number | null
          model_year?: number
          notes?: string | null
          updated_at?: string
          year_code?: string
        }
        Relationships: []
      }
      contract_acceptances: {
        Row: {
          acceptance_token: string
          accepted_at: string | null
          accepted_ip: string | null
          accepted_user_agent: string | null
          buyer_name_typed: string | null
          contract_id: string
          created_at: string
          created_by: string | null
          id: string
          revision_number: number
        }
        Insert: {
          acceptance_token?: string
          accepted_at?: string | null
          accepted_ip?: string | null
          accepted_user_agent?: string | null
          buyer_name_typed?: string | null
          contract_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          revision_number?: number
        }
        Update: {
          acceptance_token?: string
          accepted_at?: string | null
          accepted_ip?: string | null
          accepted_user_agent?: string | null
          buyer_name_typed?: string | null
          contract_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          revision_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "contract_acceptances_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_revisions: {
        Row: {
          active_clause_ids: string[]
          change_reason: string | null
          changed_by: string | null
          clause_variables: Json
          contract_id: string
          created_at: string
          id: string
          revision_number: number
        }
        Insert: {
          active_clause_ids?: string[]
          change_reason?: string | null
          changed_by?: string | null
          clause_variables?: Json
          contract_id: string
          created_at?: string
          id?: string
          revision_number: number
        }
        Update: {
          active_clause_ids?: string[]
          change_reason?: string | null
          changed_by?: string | null
          clause_variables?: Json
          contract_id?: string
          created_at?: string
          id?: string
          revision_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "contract_revisions_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_templates: {
        Row: {
          body_content: string
          clause_categories: string[]
          clauses_content: string | null
          created_at: string
          created_by: string | null
          fixed_clauses: string[] | null
          header_content: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          optional_clauses: Json
          signature_content: string | null
          signature_url: string | null
          store_id: string | null
          template_type: Database["public"]["Enums"]["contract_template_type"]
          updated_at: string
          updated_by: string | null
          vehicle_types: string[]
          version: number
          watermark_opacity: number
          watermark_url: string | null
        }
        Insert: {
          body_content: string
          clause_categories?: string[]
          clauses_content?: string | null
          created_at?: string
          created_by?: string | null
          fixed_clauses?: string[] | null
          header_content?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          optional_clauses?: Json
          signature_content?: string | null
          signature_url?: string | null
          store_id?: string | null
          template_type: Database["public"]["Enums"]["contract_template_type"]
          updated_at?: string
          updated_by?: string | null
          vehicle_types?: string[]
          version?: number
          watermark_opacity?: number
          watermark_url?: string | null
        }
        Update: {
          body_content?: string
          clause_categories?: string[]
          clauses_content?: string | null
          created_at?: string
          created_by?: string | null
          fixed_clauses?: string[] | null
          header_content?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          optional_clauses?: Json
          signature_content?: string | null
          signature_url?: string | null
          store_id?: string | null
          template_type?: Database["public"]["Enums"]["contract_template_type"]
          updated_at?: string
          updated_by?: string | null
          vehicle_types?: string[]
          version?: number
          watermark_opacity?: number
          watermark_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_templates_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          active_clause_ids: string[]
          ad_id: string | null
          buyer_address: string | null
          buyer_cpf: string
          buyer_email: string | null
          buyer_name: string
          buyer_phone: string | null
          campaign_name: string | null
          clause_variables: Json
          contract_number: string
          contract_type: string | null
          created_at: string
          created_by: string | null
          down_payment: number | null
          down_payment_card: number
          down_payment_card_installments: number | null
          down_payment_cash: number
          down_payment_pix: number
          evidence_paths: string[]
          external_data: Json
          financing_bank: string | null
          financing_installment_value: number | null
          financing_installments: number | null
          id: string
          installment_value: number | null
          installments: number | null
          lead_source: string | null
          lead_source_detail: string | null
          notes: string | null
          payment_method: string | null
          reseller_id: string | null
          review_note: string | null
          review_requested_at: string | null
          review_requested_by: string | null
          review_resolved_at: string | null
          review_resolved_by: string | null
          review_response: string | null
          review_status: string
          revision_number: number
          sale_channel: string
          sale_group_id: string | null
          sale_price: number
          signed_at: string | null
          signed_contract_url: string | null
          status: string
          store_id: string
          template_id: string | null
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          active_clause_ids?: string[]
          ad_id?: string | null
          buyer_address?: string | null
          buyer_cpf: string
          buyer_email?: string | null
          buyer_name: string
          buyer_phone?: string | null
          campaign_name?: string | null
          clause_variables?: Json
          contract_number: string
          contract_type?: string | null
          created_at?: string
          created_by?: string | null
          down_payment?: number | null
          down_payment_card?: number
          down_payment_card_installments?: number | null
          down_payment_cash?: number
          down_payment_pix?: number
          evidence_paths?: string[]
          external_data?: Json
          financing_bank?: string | null
          financing_installment_value?: number | null
          financing_installments?: number | null
          id?: string
          installment_value?: number | null
          installments?: number | null
          lead_source?: string | null
          lead_source_detail?: string | null
          notes?: string | null
          payment_method?: string | null
          reseller_id?: string | null
          review_note?: string | null
          review_requested_at?: string | null
          review_requested_by?: string | null
          review_resolved_at?: string | null
          review_resolved_by?: string | null
          review_response?: string | null
          review_status?: string
          revision_number?: number
          sale_channel?: string
          sale_group_id?: string | null
          sale_price: number
          signed_at?: string | null
          signed_contract_url?: string | null
          status?: string
          store_id: string
          template_id?: string | null
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          active_clause_ids?: string[]
          ad_id?: string | null
          buyer_address?: string | null
          buyer_cpf?: string
          buyer_email?: string | null
          buyer_name?: string
          buyer_phone?: string | null
          campaign_name?: string | null
          clause_variables?: Json
          contract_number?: string
          contract_type?: string | null
          created_at?: string
          created_by?: string | null
          down_payment?: number | null
          down_payment_card?: number
          down_payment_card_installments?: number | null
          down_payment_cash?: number
          down_payment_pix?: number
          evidence_paths?: string[]
          external_data?: Json
          financing_bank?: string | null
          financing_installment_value?: number | null
          financing_installments?: number | null
          id?: string
          installment_value?: number | null
          installments?: number | null
          lead_source?: string | null
          lead_source_detail?: string | null
          notes?: string | null
          payment_method?: string | null
          reseller_id?: string | null
          review_note?: string | null
          review_requested_at?: string | null
          review_requested_by?: string | null
          review_resolved_at?: string | null
          review_resolved_by?: string | null
          review_response?: string | null
          review_status?: string
          revision_number?: number
          sale_channel?: string
          sale_group_id?: string | null
          sale_price?: number
          signed_at?: string | null
          signed_contract_url?: string | null
          status?: string
          store_id?: string
          template_id?: string | null
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_ad_id_fkey"
            columns: ["ad_id"]
            isOneToOne: false
            referencedRelation: "store_ads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "contract_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_roles: {
        Row: {
          base_role: Database["public"]["Enums"]["app_role"]
          color: string
          created_at: string
          created_by: string | null
          data_scope: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          system_key: string | null
          updated_at: string
        }
        Insert: {
          base_role?: Database["public"]["Enums"]["app_role"]
          color?: string
          created_at?: string
          created_by?: string | null
          data_scope?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          system_key?: string | null
          updated_at?: string
        }
        Update: {
          base_role?: Database["public"]["Enums"]["app_role"]
          color?: string
          created_at?: string
          created_by?: string | null
          data_scope?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          system_key?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      employees: {
        Row: {
          bank_info: string | null
          base_salary: number
          commission_rate: number
          commission_tiers: Json
          commission_type: string
          cpf: string | null
          created_at: string
          created_by: string | null
          email: string | null
          full_name: string
          hire_date: string | null
          id: string
          is_active: boolean
          manager_commission_rate: number
          meal_allowance: number
          notes: string | null
          other_allowance: number
          phone: string | null
          pix_key: string | null
          position: string | null
          profile_id: string | null
          role: string
          salary_additions: Json
          store_id: string | null
          transport_allowance: number
          updated_at: string
        }
        Insert: {
          bank_info?: string | null
          base_salary?: number
          commission_rate?: number
          commission_tiers?: Json
          commission_type?: string
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name: string
          hire_date?: string | null
          id?: string
          is_active?: boolean
          manager_commission_rate?: number
          meal_allowance?: number
          notes?: string | null
          other_allowance?: number
          phone?: string | null
          pix_key?: string | null
          position?: string | null
          profile_id?: string | null
          role?: string
          salary_additions?: Json
          store_id?: string | null
          transport_allowance?: number
          updated_at?: string
        }
        Update: {
          bank_info?: string | null
          base_salary?: number
          commission_rate?: number
          commission_tiers?: Json
          commission_type?: string
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name?: string
          hire_date?: string | null
          id?: string
          is_active?: boolean
          manager_commission_rate?: number
          meal_allowance?: number
          notes?: string | null
          other_allowance?: number
          phone?: string | null
          pix_key?: string | null
          position?: string | null
          profile_id?: string | null
          role?: string
          salary_additions?: Json
          store_id?: string | null
          transport_allowance?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      eula_acceptances: {
        Row: {
          accepted_at: string
          accepted_ip: string | null
          created_at: string
          full_name_typed: string | null
          id: string
          user_agent: string | null
          user_id: string
          version: string
        }
        Insert: {
          accepted_at?: string
          accepted_ip?: string | null
          created_at?: string
          full_name_typed?: string | null
          id?: string
          user_agent?: string | null
          user_id: string
          version: string
        }
        Update: {
          accepted_at?: string
          accepted_ip?: string | null
          created_at?: string
          full_name_typed?: string | null
          id?: string
          user_agent?: string | null
          user_id?: string
          version?: string
        }
        Relationships: []
      }
      financing_banks: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          lien_holder: string | null
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          lien_holder?: string | null
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          lien_holder?: string | null
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      financing_simulations: {
        Row: {
          bank_code: string
          cet: number | null
          created_at: string
          created_by: string | null
          customer_birthdate: string | null
          customer_document: string
          customer_email: string | null
          customer_income: number | null
          customer_name: string
          customer_phone: string | null
          down_payment: number
          error_message: string | null
          financed_amount: number
          id: string
          installment_value: number | null
          installments: number
          monthly_rate: number | null
          response_data: Json | null
          status: string
          store_id: string
          total_amount: number | null
          updated_at: string
          vehicle_id: string | null
          vehicle_value: number
        }
        Insert: {
          bank_code: string
          cet?: number | null
          created_at?: string
          created_by?: string | null
          customer_birthdate?: string | null
          customer_document: string
          customer_email?: string | null
          customer_income?: number | null
          customer_name: string
          customer_phone?: string | null
          down_payment?: number
          error_message?: string | null
          financed_amount: number
          id?: string
          installment_value?: number | null
          installments: number
          monthly_rate?: number | null
          response_data?: Json | null
          status?: string
          store_id: string
          total_amount?: number | null
          updated_at?: string
          vehicle_id?: string | null
          vehicle_value: number
        }
        Update: {
          bank_code?: string
          cet?: number | null
          created_at?: string
          created_by?: string | null
          customer_birthdate?: string | null
          customer_document?: string
          customer_email?: string | null
          customer_income?: number | null
          customer_name?: string
          customer_phone?: string | null
          down_payment?: number
          error_message?: string | null
          financed_amount?: number
          id?: string
          installment_value?: number | null
          installments?: number
          monthly_rate?: number | null
          response_data?: Json | null
          status?: string
          store_id?: string
          total_amount?: number | null
          updated_at?: string
          vehicle_id?: string | null
          vehicle_value?: number
        }
        Relationships: []
      }
      invoices: {
        Row: {
          created_at: string
          created_by: string | null
          customer_address: string | null
          customer_document: string | null
          customer_email: string | null
          customer_name: string
          customer_phone: string | null
          id: string
          invoice_number: string
          invoice_type: string
          issue_date: string
          items: Json
          notes: string | null
          status: string
          store_id: string | null
          subtotal: number
          tax_rate: number
          tax_value: number
          total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_address?: string | null
          customer_document?: string | null
          customer_email?: string | null
          customer_name: string
          customer_phone?: string | null
          id?: string
          invoice_number: string
          invoice_type?: string
          issue_date?: string
          items?: Json
          notes?: string | null
          status?: string
          store_id?: string | null
          subtotal?: number
          tax_rate?: number
          tax_value?: number
          total?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_address?: string | null
          customer_document?: string | null
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string | null
          id?: string
          invoice_number?: string
          invoice_type?: string
          issue_date?: string
          items?: Json
          notes?: string | null
          status?: string
          store_id?: string | null
          subtotal?: number
          tax_rate?: number
          tax_value?: number
          total?: number
          updated_at?: string
        }
        Relationships: []
      }
      payroll_batches: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          created_at: string
          created_by: string | null
          employee_count: number
          id: string
          month: number
          status: string
          total_bruto: number
          total_encargos: number
          total_liquido: number
          updated_at: string
          year: number
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          created_by?: string | null
          employee_count?: number
          id?: string
          month: number
          status?: string
          total_bruto?: number
          total_encargos?: number
          total_liquido?: number
          updated_at?: string
          year: number
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          created_by?: string | null
          employee_count?: number
          id?: string
          month?: number
          status?: string
          total_bruto?: number
          total_encargos?: number
          total_liquido?: number
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      payroll_settings: {
        Row: {
          auto_reminder_enabled: boolean
          closing_day: number
          created_at: string
          default_dependents: number
          id: string
          reminder_days_before: number
          updated_at: string
        }
        Insert: {
          auto_reminder_enabled?: boolean
          closing_day?: number
          created_at?: string
          default_dependents?: number
          id?: string
          reminder_days_before?: number
          updated_at?: string
        }
        Update: {
          auto_reminder_enabled?: boolean
          closing_day?: number
          created_at?: string
          default_dependents?: number
          id?: string
          reminder_days_before?: number
          updated_at?: string
        }
        Relationships: []
      }
      payslips: {
        Row: {
          additions: Json
          base_salary: number
          batch_id: string | null
          bonus: number
          breakdown: Json | null
          commission_amount: number
          commission_sales_total: number
          created_at: string
          created_by: string | null
          employee_id: string
          id: string
          inss_discount: number
          irrf_discount: number
          manager_commission: number
          meal_allowance: number
          net_total: number
          notes: string | null
          other_allowance: number
          other_discounts: number
          overtime: number
          payment_date: string | null
          payment_method: string | null
          payslip_number: string
          reference_month: number
          reference_year: number
          sent_email_at: string | null
          sent_whatsapp_at: string | null
          status: string
          store_id: string | null
          transport_allowance: number
          updated_at: string
        }
        Insert: {
          additions?: Json
          base_salary?: number
          batch_id?: string | null
          bonus?: number
          breakdown?: Json | null
          commission_amount?: number
          commission_sales_total?: number
          created_at?: string
          created_by?: string | null
          employee_id: string
          id?: string
          inss_discount?: number
          irrf_discount?: number
          manager_commission?: number
          meal_allowance?: number
          net_total?: number
          notes?: string | null
          other_allowance?: number
          other_discounts?: number
          overtime?: number
          payment_date?: string | null
          payment_method?: string | null
          payslip_number: string
          reference_month: number
          reference_year: number
          sent_email_at?: string | null
          sent_whatsapp_at?: string | null
          status?: string
          store_id?: string | null
          transport_allowance?: number
          updated_at?: string
        }
        Update: {
          additions?: Json
          base_salary?: number
          batch_id?: string | null
          bonus?: number
          breakdown?: Json | null
          commission_amount?: number
          commission_sales_total?: number
          created_at?: string
          created_by?: string | null
          employee_id?: string
          id?: string
          inss_discount?: number
          irrf_discount?: number
          manager_commission?: number
          meal_allowance?: number
          net_total?: number
          notes?: string | null
          other_allowance?: number
          other_discounts?: number
          overtime?: number
          payment_date?: string | null
          payment_method?: string | null
          payslip_number?: string
          reference_month?: number
          reference_year?: number
          sent_email_at?: string | null
          sent_whatsapp_at?: string | null
          status?: string
          store_id?: string | null
          transport_allowance?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payslips_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "payroll_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payslips_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payslips_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          must_change_password: boolean | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name: string
          id: string
          must_change_password?: boolean | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          must_change_password?: boolean | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      reseller_consignment_contracts: {
        Row: {
          created_at: string
          created_by: string | null
          full_payment_amount: number | null
          id: string
          notes: string | null
          payment_type: string
          remaining_amount: number | null
          remaining_paid: boolean | null
          remaining_paid_at: string | null
          remaining_percentage: number | null
          reseller_id: string
          status: string
          store_id: string
          terms: string | null
          updated_at: string
          upfront_amount: number | null
          upfront_paid: boolean | null
          upfront_paid_at: string | null
          upfront_percentage: number | null
          vehicle_cost: number
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          full_payment_amount?: number | null
          id?: string
          notes?: string | null
          payment_type?: string
          remaining_amount?: number | null
          remaining_paid?: boolean | null
          remaining_paid_at?: string | null
          remaining_percentage?: number | null
          reseller_id: string
          status?: string
          store_id: string
          terms?: string | null
          updated_at?: string
          upfront_amount?: number | null
          upfront_paid?: boolean | null
          upfront_paid_at?: string | null
          upfront_percentage?: number | null
          vehicle_cost: number
          vehicle_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          full_payment_amount?: number | null
          id?: string
          notes?: string | null
          payment_type?: string
          remaining_amount?: number | null
          remaining_paid?: boolean | null
          remaining_paid_at?: string | null
          remaining_percentage?: number | null
          reseller_id?: string
          status?: string
          store_id?: string
          terms?: string | null
          updated_at?: string
          upfront_amount?: number | null
          upfront_paid?: boolean | null
          upfront_paid_at?: string | null
          upfront_percentage?: number | null
          vehicle_cost?: number
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reseller_consignment_contracts_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reseller_consignment_contracts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reseller_consignment_contracts_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      resellers: {
        Row: {
          commission_rate: number | null
          cpf: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_active: boolean
          partner_type: string
          phone: string | null
          store_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          commission_rate?: number | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          is_active?: boolean
          partner_type?: string
          phone?: string | null
          store_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          commission_rate?: number | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          partner_type?: string
          phone?: string | null
          store_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "resellers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          id: string
          permission: string
          role_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          permission: string
          role_id: string
        }
        Update: {
          created_at?: string
          id?: string
          permission?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "custom_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_targets: {
        Row: {
          bonus_on_target: number
          created_at: string
          created_by: string | null
          id: string
          month: number
          notes: string | null
          store_id: string | null
          target_qty: number
          target_value: number
          updated_at: string
          user_id: string | null
          year: number
        }
        Insert: {
          bonus_on_target?: number
          created_at?: string
          created_by?: string | null
          id?: string
          month: number
          notes?: string | null
          store_id?: string | null
          target_qty?: number
          target_value?: number
          updated_at?: string
          user_id?: string | null
          year: number
        }
        Update: {
          bonus_on_target?: number
          created_at?: string
          created_by?: string | null
          id?: string
          month?: number
          notes?: string | null
          store_id?: string | null
          target_qty?: number
          target_value?: number
          updated_at?: string
          user_id?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_targets_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_sync_config: {
        Row: {
          created_at: string
          enabled: boolean
          function_token: string | null
          function_url: string | null
          id: string
          last_error: string | null
          last_pulled_at: string | null
          last_pushed_at: string | null
          sheet_name: string
          spreadsheet_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          function_token?: string | null
          function_url?: string | null
          id?: string
          last_error?: string | null
          last_pulled_at?: string | null
          last_pushed_at?: string | null
          sheet_name?: string
          spreadsheet_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          function_token?: string | null
          function_url?: string | null
          id?: string
          last_error?: string | null
          last_pulled_at?: string | null
          last_pushed_at?: string | null
          sheet_name?: string
          spreadsheet_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      stock_transfers: {
        Row: {
          agreed_amount: number
          created_at: string
          created_by: string | null
          from_reseller_id: string | null
          from_store_id: string | null
          id: string
          notes: string | null
          partner_name: string | null
          received_amount: number
          status: string
          to_reseller_id: string | null
          to_store_id: string | null
          transfer_date: string
          transfer_type: string
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          agreed_amount?: number
          created_at?: string
          created_by?: string | null
          from_reseller_id?: string | null
          from_store_id?: string | null
          id?: string
          notes?: string | null
          partner_name?: string | null
          received_amount?: number
          status?: string
          to_reseller_id?: string | null
          to_store_id?: string | null
          transfer_date?: string
          transfer_type?: string
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          agreed_amount?: number
          created_at?: string
          created_by?: string | null
          from_reseller_id?: string | null
          from_store_id?: string | null
          id?: string
          notes?: string | null
          partner_name?: string | null
          received_amount?: number
          status?: string
          to_reseller_id?: string | null
          to_store_id?: string | null
          transfer_date?: string
          transfer_type?: string
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_transfers_from_reseller_id_fkey"
            columns: ["from_reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_from_store_id_fkey"
            columns: ["from_store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_to_reseller_id_fkey"
            columns: ["to_reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_to_store_id_fkey"
            columns: ["to_store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      store_ads: {
        Row: {
          ad_url: string | null
          budget_spent: number
          campaign_name: string
          caption: string | null
          created_at: string
          created_by: string | null
          ended_at: string | null
          id: string
          image_url: string | null
          notes: string | null
          platform: string
          started_at: string | null
          status: string
          store_id: string
          title: string
          updated_at: string
        }
        Insert: {
          ad_url?: string | null
          budget_spent?: number
          campaign_name: string
          caption?: string | null
          created_at?: string
          created_by?: string | null
          ended_at?: string | null
          id?: string
          image_url?: string | null
          notes?: string | null
          platform?: string
          started_at?: string | null
          status?: string
          store_id: string
          title: string
          updated_at?: string
        }
        Update: {
          ad_url?: string | null
          budget_spent?: number
          campaign_name?: string
          caption?: string | null
          created_at?: string
          created_by?: string | null
          ended_at?: string | null
          id?: string
          image_url?: string | null
          notes?: string | null
          platform?: string
          started_at?: string | null
          status?: string
          store_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_ads_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          address: string | null
          city: string | null
          cnpj: string | null
          created_at: string
          email: string | null
          id: string
          instagram_handle: string | null
          is_active: boolean
          manager_id: string | null
          name: string
          phone: string | null
          state: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          cnpj?: string | null
          created_at?: string
          email?: string | null
          id?: string
          instagram_handle?: string | null
          is_active?: boolean
          manager_id?: string | null
          name: string
          phone?: string | null
          state?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          cnpj?: string | null
          created_at?: string
          email?: string | null
          id?: string
          instagram_handle?: string | null
          is_active?: boolean
          manager_id?: string | null
          name?: string
          phone?: string | null
          state?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          custom_role_id: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          custom_role_id?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          custom_role_id?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_custom_role_id_fkey"
            columns: ["custom_role_id"]
            isOneToOne: false
            referencedRelation: "custom_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_colors: {
        Row: {
          created_at: string
          created_by: string | null
          hex: string | null
          hex_secondary: string | null
          id: string
          is_active: boolean
          model_scope: string
          name: string
          updated_at: string
          vehicle_model_id: string | null
          vehicle_model_ids: string[]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          hex?: string | null
          hex_secondary?: string | null
          id?: string
          is_active?: boolean
          model_scope?: string
          name: string
          updated_at?: string
          vehicle_model_id?: string | null
          vehicle_model_ids?: string[]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          hex?: string | null
          hex_secondary?: string | null
          id?: string
          is_active?: boolean
          model_scope?: string
          name?: string
          updated_at?: string
          vehicle_model_id?: string | null
          vehicle_model_ids?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_colors_vehicle_model_id_fkey"
            columns: ["vehicle_model_id"]
            isOneToOne: false
            referencedRelation: "vehicle_models"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_models: {
        Row: {
          brand: string
          created_at: string
          created_by: string | null
          default_purchase_price: number | null
          default_sale_price: number | null
          engine_cc: number | null
          fuel_type: string | null
          id: string
          is_active: boolean
          model: string
          promo_active: boolean
          promo_ends_on: string | null
          promo_label: string | null
          promo_price: number | null
          revision_period_km: number | null
          revision_period_months: number | null
          transmission: string | null
          updated_at: string
          vehicle_type: string
          warranty_months: number | null
        }
        Insert: {
          brand: string
          created_at?: string
          created_by?: string | null
          default_purchase_price?: number | null
          default_sale_price?: number | null
          engine_cc?: number | null
          fuel_type?: string | null
          id?: string
          is_active?: boolean
          model: string
          promo_active?: boolean
          promo_ends_on?: string | null
          promo_label?: string | null
          promo_price?: number | null
          revision_period_km?: number | null
          revision_period_months?: number | null
          transmission?: string | null
          updated_at?: string
          vehicle_type?: string
          warranty_months?: number | null
        }
        Update: {
          brand?: string
          created_at?: string
          created_by?: string | null
          default_purchase_price?: number | null
          default_sale_price?: number | null
          engine_cc?: number | null
          fuel_type?: string | null
          id?: string
          is_active?: boolean
          model?: string
          promo_active?: boolean
          promo_ends_on?: string | null
          promo_label?: string | null
          promo_price?: number | null
          revision_period_km?: number | null
          revision_period_months?: number | null
          transmission?: string | null
          updated_at?: string
          vehicle_type?: string
          warranty_months?: number | null
        }
        Relationships: []
      }
      vehicle_reservations: {
        Row: {
          buyer_address: string | null
          buyer_cpf: string
          buyer_email: string | null
          buyer_name: string
          buyer_phone: string | null
          converted_contract_id: string | null
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          notes: string | null
          payment_method: string | null
          reseller_id: string | null
          reservation_amount: number
          reservation_date: string
          reservation_number: string
          signed_contract_url: string | null
          status: string
          store_id: string
          template_id: string | null
          updated_at: string
          vehicle_id: string
          vehicle_price: number
        }
        Insert: {
          buyer_address?: string | null
          buyer_cpf: string
          buyer_email?: string | null
          buyer_name: string
          buyer_phone?: string | null
          converted_contract_id?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          notes?: string | null
          payment_method?: string | null
          reseller_id?: string | null
          reservation_amount?: number
          reservation_date?: string
          reservation_number: string
          signed_contract_url?: string | null
          status?: string
          store_id: string
          template_id?: string | null
          updated_at?: string
          vehicle_id: string
          vehicle_price: number
        }
        Update: {
          buyer_address?: string | null
          buyer_cpf?: string
          buyer_email?: string | null
          buyer_name?: string
          buyer_phone?: string | null
          converted_contract_id?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          notes?: string | null
          payment_method?: string | null
          reseller_id?: string | null
          reservation_amount?: number
          reservation_date?: string
          reservation_number?: string
          signed_contract_url?: string | null
          status?: string
          store_id?: string
          template_id?: string | null
          updated_at?: string
          vehicle_id?: string
          vehicle_price?: number
        }
        Relationships: []
      }
      vehicles: {
        Row: {
          brand: string
          chassis: string | null
          color: string | null
          created_at: string
          engine_cc: number | null
          fuel_type: string | null
          id: string
          images: string[] | null
          manufacture_year: number | null
          mileage: number | null
          model: string
          notes: string | null
          plate: string | null
          purchase_price: number | null
          renavam: string | null
          reseller_id: string | null
          revision_period_km: number | null
          revision_period_months: number | null
          sale_price: number | null
          status: string
          store_id: string | null
          transmission: string | null
          updated_at: string
          vehicle_type: string | null
          warranty_months: number | null
          year: number
        }
        Insert: {
          brand: string
          chassis?: string | null
          color?: string | null
          created_at?: string
          engine_cc?: number | null
          fuel_type?: string | null
          id?: string
          images?: string[] | null
          manufacture_year?: number | null
          mileage?: number | null
          model: string
          notes?: string | null
          plate?: string | null
          purchase_price?: number | null
          renavam?: string | null
          reseller_id?: string | null
          revision_period_km?: number | null
          revision_period_months?: number | null
          sale_price?: number | null
          status?: string
          store_id?: string | null
          transmission?: string | null
          updated_at?: string
          vehicle_type?: string | null
          warranty_months?: number | null
          year: number
        }
        Update: {
          brand?: string
          chassis?: string | null
          color?: string | null
          created_at?: string
          engine_cc?: number | null
          fuel_type?: string | null
          id?: string
          images?: string[] | null
          manufacture_year?: number | null
          mileage?: number | null
          model?: string
          notes?: string | null
          plate?: string | null
          purchase_price?: number | null
          renavam?: string | null
          reseller_id?: string | null
          revision_period_km?: number | null
          revision_period_months?: number | null
          sale_price?: number | null
          status?: string
          store_id?: string | null
          transmission?: string | null
          updated_at?: string
          vehicle_type?: string | null
          warranty_months?: number | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_create_sales: { Args: { _user_id: string }; Returns: boolean }
      can_register_vehicles: { Args: { _user_id: string }; Returns: boolean }
      get_user_store_id: { Args: { _user_id: string }; Returns: string }
      has_elevated_access: { Args: { _user_id: string }; Returns: boolean }
      has_permission: {
        Args: { _perm: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_external_seller: { Args: { _user_id: string }; Returns: boolean }
      user_data_scope: { Args: { _user_id: string }; Returns: string }
    }
    Enums: {
      app_role:
        | "admin"
        | "gerente"
        | "revendedor"
        | "visualizador"
        | "vendedor"
        | "vendedor_plus"
        | "vendedor_externo"
      contract_template_type:
        | "venda_carro"
        | "venda_moto"
        | "repasse"
        | "generico"
        | "reserva"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "admin",
        "gerente",
        "revendedor",
        "visualizador",
        "vendedor",
        "vendedor_plus",
        "vendedor_externo",
      ],
      contract_template_type: [
        "venda_carro",
        "venda_moto",
        "repasse",
        "generico",
        "reserva",
      ],
    },
  },
} as const
