export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      classes: {
        Row: {
          academic_year: number | null;
          class_code: string;
          created_at: string;
          grade: string | null;
          id: string;
          name: string;
          school_id: string;
          teacher_id: string | null;
        };
        Insert: {
          academic_year?: number | null;
          class_code: string;
          created_at?: string;
          grade?: string | null;
          id?: string;
          name: string;
          school_id: string;
          teacher_id?: string | null;
        };
        Update: {
          academic_year?: number | null;
          class_code?: string;
          created_at?: string;
          grade?: string | null;
          id?: string;
          name?: string;
          school_id?: string;
          teacher_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "classes_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "classes_teacher_fk";
            columns: ["teacher_id"];
            isOneToOne: false;
            referencedRelation: "teachers";
            referencedColumns: ["id"];
          },
        ];
      };
      logs: {
        Row: {
          action: string;
          actor_user_id: string;
          created_at: string;
          entity: string | null;
          entity_id: string | null;
          id: string;
          metadata: Json | null;
          school_id: string | null;
        };
        Insert: {
          action: string;
          actor_user_id: string;
          created_at?: string;
          entity?: string | null;
          entity_id?: string | null;
          id?: string;
          metadata?: Json | null;
          school_id?: string | null;
        };
        Update: {
          action?: string;
          actor_user_id?: string;
          created_at?: string;
          entity?: string | null;
          entity_id?: string | null;
          id?: string;
          metadata?: Json | null;
          school_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "logs_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      plans: {
        Row: {
          active: boolean;
          created_at: string;
          features: Json;
          id: string;
          max_schools: number;
          max_simulados_month: number;
          max_students: number;
          max_teachers: number;
          name: string;
          price_cents: number;
          tier: Database["public"]["Enums"]["plan_tier"];
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          features?: Json;
          id?: string;
          max_schools?: number;
          max_simulados_month?: number;
          max_students?: number;
          max_teachers?: number;
          name: string;
          price_cents?: number;
          tier: Database["public"]["Enums"]["plan_tier"];
        };
        Update: {
          active?: boolean;
          created_at?: string;
          features?: Json;
          id?: string;
          max_schools?: number;
          max_simulados_month?: number;
          max_students?: number;
          max_teachers?: number;
          name?: string;
          price_cents?: number;
          tier?: Database["public"]["Enums"]["plan_tier"];
        };
        Relationships: [];
      };
      platform_settings: {
        Row: {
          id: string;
          key: string;
          updated_at: string | null;
          value: Json;
        };
        Insert: {
          id?: string;
          key: string;
          updated_at?: string | null;
          value: Json;
        };
        Update: {
          id?: string;
          key?: string;
          updated_at?: string | null;
          value?: Json;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          email: string | null;
          full_name: string | null;
          id: string;
          phone: string | null;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id: string;
          phone?: string | null;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id?: string;
          phone?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      question_keys: {
        Row: {
          correct_answer: string | null;
          created_at: string;
          question_id: string;
          rubric: string | null;
          school_id: string;
          updated_at: string;
        };
        Insert: {
          correct_answer?: string | null;
          created_at?: string;
          question_id: string;
          rubric?: string | null;
          school_id: string;
          updated_at?: string;
        };
        Update: {
          correct_answer?: string | null;
          created_at?: string;
          question_id?: string;
          rubric?: string | null;
          school_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "question_keys_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: true;
            referencedRelation: "questions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "question_keys_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: true;
            referencedRelation: "questions_safe";
            referencedColumns: ["id"];
          },
        ];
      };
      questions: {
        Row: {
          created_at: string;
          created_by: string | null;
          explanation: string | null;
          id: string;
          options: Json;
          pirls_process: Database["public"]["Enums"]["pirls_process"];
          points: number;
          q_type: Database["public"]["Enums"]["question_type"];
          school_id: string;
          statement: string;
          text_id: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          explanation?: string | null;
          id?: string;
          options?: Json;
          pirls_process: Database["public"]["Enums"]["pirls_process"];
          points?: number;
          q_type?: Database["public"]["Enums"]["question_type"];
          school_id: string;
          statement: string;
          text_id?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          explanation?: string | null;
          id?: string;
          options?: Json;
          pirls_process?: Database["public"]["Enums"]["pirls_process"];
          points?: number;
          q_type?: Database["public"]["Enums"]["question_type"];
          school_id?: string;
          statement?: string;
          text_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "questions_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "questions_text_id_fkey";
            columns: ["text_id"];
            isOneToOne: false;
            referencedRelation: "texts";
            referencedColumns: ["id"];
          },
        ];
      };
      schools: {
        Row: {
          city: string | null;
          cnpj: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          logo_url: string | null;
          name: string;
          plan_id: string | null;
          primary_color: string | null;
          slug: string;
          state: string | null;
          subscription_expires_at: string | null;
          subscription_status: Database["public"]["Enums"]["subscription_status"];
          updated_at: string;
        };
        Insert: {
          city?: string | null;
          cnpj?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          logo_url?: string | null;
          name: string;
          plan_id?: string | null;
          primary_color?: string | null;
          slug: string;
          state?: string | null;
          subscription_expires_at?: string | null;
          subscription_status?: Database["public"]["Enums"]["subscription_status"];
          updated_at?: string;
        };
        Update: {
          city?: string | null;
          cnpj?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          logo_url?: string | null;
          name?: string;
          plan_id?: string | null;
          primary_color?: string | null;
          slug?: string;
          state?: string | null;
          subscription_expires_at?: string | null;
          subscription_status?: Database["public"]["Enums"]["subscription_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "schools_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "plans";
            referencedColumns: ["id"];
          },
        ];
      };
      simulado_answers: {
        Row: {
          ai_feedback: string | null;
          answer: string | null;
          attempt_id: string;
          created_at: string;
          graded_at: string | null;
          id: string;
          is_correct: boolean | null;
          max_points: number | null;
          question_id: string;
          score: number | null;
          updated_at: string;
        };
        Insert: {
          ai_feedback?: string | null;
          answer?: string | null;
          attempt_id: string;
          created_at?: string;
          graded_at?: string | null;
          id?: string;
          is_correct?: boolean | null;
          max_points?: number | null;
          question_id: string;
          score?: number | null;
          updated_at?: string;
        };
        Update: {
          ai_feedback?: string | null;
          answer?: string | null;
          attempt_id?: string;
          created_at?: string;
          graded_at?: string | null;
          id?: string;
          is_correct?: boolean | null;
          max_points?: number | null;
          question_id?: string;
          score?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "simulado_answers_attempt_id_fkey";
            columns: ["attempt_id"];
            isOneToOne: false;
            referencedRelation: "simulado_attempts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "simulado_answers_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "questions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "simulado_answers_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "questions_safe";
            referencedColumns: ["id"];
          },
        ];
      };
      simulado_attempts: {
        Row: {
          active_page_id: string | null;
          created_at: string;
          expires_at: string;
          graded_at: string | null;
          id: string;
          max_score: number | null;
          opened_page_ids: Json;
          process_scores: Json;
          school_id: string;
          simulado_id: string;
          started_at: string;
          student_id: string;
          submitted_at: string | null;
          total_score: number | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          active_page_id?: string | null;
          created_at?: string;
          expires_at: string;
          graded_at?: string | null;
          id?: string;
          max_score?: number | null;
          opened_page_ids?: Json;
          process_scores?: Json;
          school_id: string;
          simulado_id: string;
          started_at?: string;
          student_id: string;
          submitted_at?: string | null;
          total_score?: number | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          active_page_id?: string | null;
          created_at?: string;
          expires_at?: string;
          graded_at?: string | null;
          id?: string;
          max_score?: number | null;
          opened_page_ids?: Json;
          process_scores?: Json;
          school_id?: string;
          simulado_id?: string;
          started_at?: string;
          student_id?: string;
          submitted_at?: string | null;
          total_score?: number | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "simulado_attempts_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "simulado_attempts_simulado_id_fkey";
            columns: ["simulado_id"];
            isOneToOne: false;
            referencedRelation: "simulados";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "simulado_attempts_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      simulado_blocks: {
        Row: {
          b_type: Database["public"]["Enums"]["block_type"];
          content: string | null;
          created_at: string;
          id: string;
          page_id: string;
          position: number;
          question_id: string | null;
          text_id: string | null;
          updated_at: string;
        };
        Insert: {
          b_type: Database["public"]["Enums"]["block_type"];
          content?: string | null;
          created_at?: string;
          id?: string;
          page_id: string;
          position?: number;
          question_id?: string | null;
          text_id?: string | null;
          updated_at?: string;
        };
        Update: {
          b_type?: Database["public"]["Enums"]["block_type"];
          content?: string | null;
          created_at?: string;
          id?: string;
          page_id?: string;
          position?: number;
          question_id?: string | null;
          text_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "simulado_blocks_page_id_fkey";
            columns: ["page_id"];
            isOneToOne: false;
            referencedRelation: "simulado_pages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "simulado_blocks_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "questions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "simulado_blocks_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "questions_safe";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "simulado_blocks_text_id_fkey";
            columns: ["text_id"];
            isOneToOne: false;
            referencedRelation: "texts";
            referencedColumns: ["id"];
          },
        ];
      };
      simulado_pages: {
        Row: {
          created_at: string;
          id: string;
          instructions: string | null;
          position: number;
          simulado_id: string;
          text_id: string | null;
          title: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          instructions?: string | null;
          position?: number;
          simulado_id: string;
          text_id?: string | null;
          title?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          instructions?: string | null;
          position?: number;
          simulado_id?: string;
          text_id?: string | null;
          title?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "simulado_pages_simulado_id_fkey";
            columns: ["simulado_id"];
            isOneToOne: false;
            referencedRelation: "simulados";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "simulado_pages_text_id_fkey";
            columns: ["text_id"];
            isOneToOne: false;
            referencedRelation: "texts";
            referencedColumns: ["id"];
          },
        ];
      };
      simulado_retakes: {
        Row: {
          consumed_at: string | null;
          created_at: string;
          granted_by: string | null;
          id: string;
          reason: string | null;
          school_id: string;
          simulado_id: string;
          student_id: string;
          updated_at: string;
        };
        Insert: {
          consumed_at?: string | null;
          created_at?: string;
          granted_by?: string | null;
          id?: string;
          reason?: string | null;
          school_id: string;
          simulado_id: string;
          student_id: string;
          updated_at?: string;
        };
        Update: {
          consumed_at?: string | null;
          created_at?: string;
          granted_by?: string | null;
          id?: string;
          reason?: string | null;
          school_id?: string;
          simulado_id?: string;
          student_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "simulado_retakes_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "simulado_retakes_simulado_id_fkey";
            columns: ["simulado_id"];
            isOneToOne: false;
            referencedRelation: "simulados";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "simulado_retakes_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      simulados: {
        Row: {
          class_id: string | null;
          created_at: string;
          created_by: string | null;
          description: string | null;
          id: string;
          max_attempts: number;
          pirls_target: Json;
          published_at: string | null;
          school_id: string;
          status: Database["public"]["Enums"]["simulado_status"];
          time_limit_minutes: number;
          title: string;
          updated_at: string;
        };
        Insert: {
          class_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          max_attempts?: number;
          pirls_target?: Json;
          published_at?: string | null;
          school_id: string;
          status?: Database["public"]["Enums"]["simulado_status"];
          time_limit_minutes?: number;
          title: string;
          updated_at?: string;
        };
        Update: {
          class_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          max_attempts?: number;
          pirls_target?: Json;
          published_at?: string | null;
          school_id?: string;
          status?: Database["public"]["Enums"]["simulado_status"];
          time_limit_minutes?: number;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "simulados_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "simulados_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      student_credentials: {
        Row: {
          auth_email: string | null;
          birth_date: string | null;
          created_at: string;
          guardian_email: string | null;
          guardian_phone: string | null;
          pin_hash: string;
          student_id: string;
          updated_at: string;
        };
        Insert: {
          auth_email?: string | null;
          birth_date?: string | null;
          created_at?: string;
          guardian_email?: string | null;
          guardian_phone?: string | null;
          pin_hash: string;
          student_id: string;
          updated_at?: string;
        };
        Update: {
          auth_email?: string | null;
          birth_date?: string | null;
          created_at?: string;
          guardian_email?: string | null;
          guardian_phone?: string | null;
          pin_hash?: string;
          student_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "student_credentials_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: true;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      students: {
        Row: {
          class_id: string | null;
          created_at: string;
          full_name: string;
          id: string;
          school_id: string;
          student_code: string;
          user_id: string | null;
        };
        Insert: {
          class_id?: string | null;
          created_at?: string;
          full_name: string;
          id?: string;
          school_id: string;
          student_code: string;
          user_id?: string | null;
        };
        Update: {
          class_id?: string | null;
          created_at?: string;
          full_name?: string;
          id?: string;
          school_id?: string;
          student_code?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "students_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "students_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      subscriptions: {
        Row: {
          created_at: string;
          expires_at: string | null;
          id: string;
          plan_id: string;
          school_id: string;
          started_at: string;
          status: Database["public"]["Enums"]["subscription_status"];
        };
        Insert: {
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          plan_id: string;
          school_id: string;
          started_at?: string;
          status?: Database["public"]["Enums"]["subscription_status"];
        };
        Update: {
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          plan_id?: string;
          school_id?: string;
          started_at?: string;
          status?: Database["public"]["Enums"]["subscription_status"];
        };
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "plans";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subscriptions_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      teachers: {
        Row: {
          created_at: string;
          email: string;
          full_name: string;
          hire_date: string | null;
          id: string;
          school_id: string;
          subjects: string[] | null;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          email: string;
          full_name: string;
          hire_date?: string | null;
          id?: string;
          school_id: string;
          subjects?: string[] | null;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          email?: string;
          full_name?: string;
          hire_date?: string | null;
          id?: string;
          school_id?: string;
          subjects?: string[] | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "teachers_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      texts: {
        Row: {
          body: string;
          category: Database["public"]["Enums"]["text_category"];
          created_at: string;
          created_by: string | null;
          id: string;
          is_public: boolean;
          level: Database["public"]["Enums"]["text_level"];
          school_id: string | null;
          source: string | null;
          tags: string[];
          text_type: string | null;
          title: string;
          updated_at: string;
          word_count: number | null;
        };
        Insert: {
          body: string;
          category?: Database["public"]["Enums"]["text_category"];
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_public?: boolean;
          level?: Database["public"]["Enums"]["text_level"];
          school_id?: string | null;
          source?: string | null;
          tags?: string[];
          text_type?: string | null;
          title: string;
          updated_at?: string;
          word_count?: number | null;
        };
        Update: {
          body?: string;
          category?: Database["public"]["Enums"]["text_category"];
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_public?: boolean;
          level?: Database["public"]["Enums"]["text_level"];
          school_id?: string | null;
          source?: string | null;
          tags?: string[];
          text_type?: string | null;
          title?: string;
          updated_at?: string;
          word_count?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "texts_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          school_id: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          school_id?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          school_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_roles_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      questions_safe: {
        Row: {
          created_at: string | null;
          explanation: string | null;
          id: string | null;
          options: Json | null;
          pirls_process: Database["public"]["Enums"]["pirls_process"] | null;
          points: number | null;
          q_type: Database["public"]["Enums"]["question_type"] | null;
          school_id: string | null;
          statement: string | null;
          text_id: string | null;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          explanation?: string | null;
          id?: string | null;
          options?: Json | null;
          pirls_process?: Database["public"]["Enums"]["pirls_process"] | null;
          points?: number | null;
          q_type?: Database["public"]["Enums"]["question_type"] | null;
          school_id?: string | null;
          statement?: string | null;
          text_id?: string | null;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          explanation?: string | null;
          id?: string | null;
          options?: Json | null;
          pirls_process?: Database["public"]["Enums"]["pirls_process"] | null;
          points?: number | null;
          q_type?: Database["public"]["Enums"]["question_type"] | null;
          school_id?: string | null;
          statement?: string | null;
          text_id?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "questions_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "questions_text_id_fkey";
            columns: ["text_id"];
            isOneToOne: false;
            referencedRelation: "texts";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      hash_pin: { Args: { _pin: string }; Returns: string };
      is_attempt_staff: { Args: { _school_id: string }; Returns: boolean };
      is_school_editor: {
        Args: { _school_id: string; _user_id: string };
        Returns: boolean;
      };
      is_super_admin:
        { Args: never; Returns: boolean } | { Args: { _user_id: string }; Returns: boolean };
      user_school_id:
        { Args: never; Returns: string } | { Args: { _user_id: string }; Returns: string };
      verify_student_pin: {
        Args: { _pin: string; _student_id: string };
        Returns: boolean;
      };
    };
    Enums: {
      app_role: "super_admin" | "school_admin" | "teacher" | "student";
      block_type: "instruction" | "text" | "question";
      pirls_process:
        | "locate_information"
        | "straightforward_inference"
        | "interpret_integrate"
        | "evaluate_critique";
      plan_tier: "free" | "basic" | "pro" | "enterprise";
      question_type: "multiple_choice" | "open";
      simulado_status: "draft" | "published" | "archived";
      subscription_status: "trial" | "active" | "suspended" | "cancelled";
      text_category: "literary" | "informational" | "mixed";
      text_level: "easy" | "medium" | "hard";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["super_admin", "school_admin", "teacher", "student"],
      block_type: ["instruction", "text", "question"],
      pirls_process: [
        "locate_information",
        "straightforward_inference",
        "interpret_integrate",
        "evaluate_critique",
      ],
      plan_tier: ["free", "basic", "pro", "enterprise"],
      question_type: ["multiple_choice", "open"],
      simulado_status: ["draft", "published", "archived"],
      subscription_status: ["trial", "active", "suspended", "cancelled"],
      text_category: ["literary", "informational", "mixed"],
      text_level: ["easy", "medium", "hard"],
    },
  },
} as const;
