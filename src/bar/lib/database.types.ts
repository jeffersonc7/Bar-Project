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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      ajustes: {
        Row: {
          actualizado_en: string
          clave: string
          valor: string | null
        }
        Insert: {
          actualizado_en?: string
          clave: string
          valor?: string | null
        }
        Update: {
          actualizado_en?: string
          clave?: string
          valor?: string | null
        }
        Relationships: []
      }
      categorias: {
        Row: {
          activa: boolean
          id: number
          nombre: string
          requiere_descripcion: boolean
          requiere_vendedor: boolean
          tipo: string
        }
        Insert: {
          activa?: boolean
          id?: never
          nombre: string
          requiere_descripcion?: boolean
          requiere_vendedor?: boolean
          tipo: string
        }
        Update: {
          activa?: boolean
          id?: never
          nombre?: string
          requiere_descripcion?: boolean
          requiere_vendedor?: boolean
          tipo?: string
        }
        Relationships: []
      }
      cierres_caja: {
        Row: {
          contado: number
          creado_en: string
          diferencia: number | null
          esperado: number
          fecha: string
          id: number
          id_cliente: string | null
          nota: string | null
          registrado_por: string
        }
        Insert: {
          contado: number
          creado_en?: string
          diferencia?: number | null
          esperado: number
          fecha: string
          id?: never
          id_cliente?: string | null
          nota?: string | null
          registrado_por: string
        }
        Update: {
          contado?: number
          creado_en?: string
          diferencia?: number | null
          esperado?: number
          fecha?: string
          id?: never
          id_cliente?: string | null
          nota?: string | null
          registrado_por?: string
        }
        Relationships: []
      }
      movimientos: {
        Row: {
          anulado: boolean
          anulado_en: string | null
          anulado_por: string | null
          categoria_id: number
          creado_en: string
          descripcion: string | null
          fecha: string
          fuente: string
          id: number
          id_cliente: string | null
          imagen_origen: string | null
          lote_id: string | null
          monto: number
          motivo_anulacion: string | null
          nota_revision: string | null
          registrado_por: string
          revisar: boolean
          vendedor: string | null
        }
        Insert: {
          anulado?: boolean
          anulado_en?: string | null
          anulado_por?: string | null
          categoria_id: number
          creado_en?: string
          descripcion?: string | null
          fecha: string
          fuente?: string
          id?: never
          id_cliente?: string | null
          imagen_origen?: string | null
          lote_id?: string | null
          monto: number
          motivo_anulacion?: string | null
          nota_revision?: string | null
          registrado_por: string
          revisar?: boolean
          vendedor?: string | null
        }
        Update: {
          anulado?: boolean
          anulado_en?: string | null
          anulado_por?: string | null
          categoria_id?: number
          creado_en?: string
          descripcion?: string | null
          fecha?: string
          fuente?: string
          id?: never
          id_cliente?: string | null
          imagen_origen?: string | null
          lote_id?: string | null
          monto?: number
          motivo_anulacion?: string | null
          nota_revision?: string | null
          registrado_por?: string
          revisar?: boolean
          vendedor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "movimientos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_caja: {
        Row: {
          efectivo_en_caja: number | null
          fondo_caja: number | null
          para_transferir: number | null
        }
        Relationships: []
      }
      v_movimientos: {
        Row: {
          anulado: boolean | null
          anulado_en: string | null
          anulado_por: string | null
          categoria: string | null
          categoria_id: number | null
          creado_en: string | null
          descripcion: string | null
          fecha: string | null
          fuente: string | null
          id: number | null
          lote_id: string | null
          monto: number | null
          monto_caja: number | null
          monto_firmado: number | null
          motivo_anulacion: string | null
          nota_revision: string | null
          registrado_por: string | null
          revisar: boolean | null
          tipo: string | null
          vendedor: string | null
        }
        Relationships: [
          {
            foreignKeyName: "movimientos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      anular_movimiento: {
        Args: {
          p_anulado_por: string
          p_clave_admin: string
          p_motivo: string
          p_movimiento_id: number
        }
        Returns: Json
      }
      obtener_categorias: { Args: never; Returns: Json }
      panel_publico: { Args: never; Returns: Json }
      registrar_cierre_caja: {
        Args: {
          p_clave: string
          p_contado: number
          p_fecha: string
          p_id_cliente?: string
          p_nota?: string
          p_registrado_por: string
        }
        Returns: Json
      }
      registrar_movimientos: {
        Args: {
          p_clave: string
          p_lote_id?: string
          p_movimientos: Json
          p_registrado_por: string
        }
        Returns: Json
      }
      resumen_caja: { Args: { p_clave: string }; Returns: Json }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
