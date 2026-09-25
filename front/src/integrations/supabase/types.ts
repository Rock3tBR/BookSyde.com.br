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
      publication_cleanup: {
        Row: { id: string; requested_by: string; bucket_id: string; object_path: string; created_at: string }
        Insert: { requested_by: string; bucket_id: string; object_path: string; id?: string; created_at?: string }
        Update: { object_path?: string }
        Relationships: []
      }
      bookmark_collections: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      comments: {
        Row: {
          body: string
          created_at: string
          id: string
          manga_id: string
          user_id: string
          volume_id: string | null
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          manga_id: string
          user_id: string
          volume_id?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          manga_id?: string
          user_id?: string
          volume_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comments_manga_id_fkey"
            columns: ["manga_id"]
            isOneToOne: false
            referencedRelation: "mangas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_volume_id_fkey"
            columns: ["volume_id"]
            isOneToOne: false
            referencedRelation: "volumes"
            referencedColumns: ["id"]
          },
        ]
      }
      content_removals: {
        Row: {
          created_at: string
          details: string | null
          id: string
          manga_id: string
          manga_title: string
          page_paths: string[]
          reason: string | null
          removed_by: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          manga_id: string
          manga_title: string
          page_paths?: string[]
          reason?: string | null
          removed_by?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          manga_id?: string
          manga_title?: string
          page_paths?: string[]
          reason?: string | null
          removed_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      direct_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          manga_id: string | null
          marketplace_order_id: string | null
          message_kind: string
          page_id: string | null
          read_at: string | null
          receiver_id: string
          sender_id: string
          share_code: string | null
          share_path: string | null
          share_title: string | null
          share_type: string | null
          volume_id: string | null
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          manga_id?: string | null
          marketplace_order_id?: string | null
          message_kind?: string
          page_id?: string | null
          read_at?: string | null
          receiver_id: string
          sender_id: string
          share_code?: string | null
          share_path?: string | null
          share_title?: string | null
          share_type?: string | null
          volume_id?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          manga_id?: string | null
          marketplace_order_id?: string | null
          message_kind?: string
          page_id?: string | null
          read_at?: string | null
          receiver_id?: string
          sender_id?: string
          share_code?: string | null
          share_path?: string | null
          share_title?: string | null
          share_type?: string | null
          volume_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "direct_messages_manga_id_fkey"
            columns: ["manga_id"]
            isOneToOne: false
            referencedRelation: "mangas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "direct_messages_marketplace_order_id_fkey"
            columns: ["marketplace_order_id"]
            isOneToOne: false
            referencedRelation: "marketplace_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "direct_messages_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "direct_messages_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "direct_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "direct_messages_volume_id_fkey"
            columns: ["volume_id"]
            isOneToOne: false
            referencedRelation: "volumes"
            referencedColumns: ["id"]
          },
        ]
      }
      friend_share_codes: {
        Row: {
          code: string
          created_at: string
          expires_at: string
          folder_color: string | null
          folder_id: string | null
          folder_name: string | null
          manga_id: string | null
          manga_ids: string[]
          page_id: string | null
          recipient_id: string
          sender_id: string
          share_path: string | null
          share_type: string
          title: string
          used_at: string | null
          used_by: string | null
          volume_id: string | null
        }
        Insert: {
          code: string
          created_at?: string
          expires_at?: string
          folder_color?: string | null
          folder_id?: string | null
          folder_name?: string | null
          manga_id?: string | null
          manga_ids?: string[]
          page_id?: string | null
          recipient_id: string
          sender_id: string
          share_path?: string | null
          share_type: string
          title: string
          used_at?: string | null
          used_by?: string | null
          volume_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string
          folder_color?: string | null
          folder_id?: string | null
          folder_name?: string | null
          manga_id?: string | null
          manga_ids?: string[]
          page_id?: string | null
          recipient_id?: string
          sender_id?: string
          share_path?: string | null
          share_type?: string
          title?: string
          used_at?: string | null
          used_by?: string | null
          volume_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "friend_share_codes_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "library_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friend_share_codes_manga_id_fkey"
            columns: ["manga_id"]
            isOneToOne: false
            referencedRelation: "mangas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friend_share_codes_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friend_share_codes_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friend_share_codes_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friend_share_codes_used_by_fkey"
            columns: ["used_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friend_share_codes_volume_id_fkey"
            columns: ["volume_id"]
            isOneToOne: false
            referencedRelation: "volumes"
            referencedColumns: ["id"]
          },
        ]
      }
      friendships: {
        Row: {
          addressee_id: string
          created_at: string
          id: string
          requester_id: string
          status: string
          updated_at: string
        }
        Insert: {
          addressee_id: string
          created_at?: string
          id?: string
          requester_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          addressee_id?: string
          created_at?: string
          id?: string
          requester_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "friendships_addressee_id_fkey"
            columns: ["addressee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      library_folders: {
        Row: {
          color: string
          created_at: string
          creator_id: string | null
          id: string
          name: string
          owner_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          creator_id?: string | null
          id?: string
          name: string
          owner_id: string
        }
        Update: {
          color?: string
          created_at?: string
          creator_id?: string | null
          id?: string
          name?: string
          owner_id?: string
        }
        Relationships: []
      }
      library_items: {
        Row: {
          folder_id: string | null
          id: string
          manga_id: string
          owner_id: string
          position: number
        }
        Insert: {
          folder_id?: string | null
          id?: string
          manga_id: string
          owner_id: string
          position?: number
        }
        Update: {
          folder_id?: string | null
          id?: string
          manga_id?: string
          owner_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "library_items_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "library_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_items_manga_id_fkey"
            columns: ["manga_id"]
            isOneToOne: false
            referencedRelation: "mangas"
            referencedColumns: ["id"]
          },
        ]
      }
      library_share_codes: {
        Row: {
          code: string
          creator_id: string
          expires_at: string
          folder_id: string
          folder_name: string
          manga_ids: string[]
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          code?: string
          creator_id: string
          expires_at?: string
          folder_id: string
          folder_name: string
          manga_ids: string[]
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          code?: string
          creator_id?: string
          expires_at?: string
          folder_id?: string
          folder_name?: string
          manga_ids?: string[]
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "library_share_codes_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "library_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      literary_place_confirmations: {
        Row: {
          created_at: string
          id: string
          place_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          place_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          place_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "literary_place_confirmations_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "literary_places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "literary_place_confirmations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      literary_place_reviews: {
        Row: {
          body: string
          created_at: string
          id: string
          place_id: string
          rating: number
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          place_id: string
          rating: number
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          place_id?: string
          rating?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "literary_place_reviews_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "literary_places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "literary_place_reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      literary_places: {
        Row: {
          address: string
          categories: string[]
          created_at: string
          created_by: string
          description: string
          id: string
          instagram_url: string | null
          latitude: number
          longitude: number
          name: string
          phone: string | null
          photo_url: string
          updated_at: string
          website_url: string | null
        }
        Insert: {
          address: string
          categories: string[]
          created_at?: string
          created_by: string
          description?: string
          id?: string
          instagram_url?: string | null
          latitude: number
          longitude: number
          name: string
          phone?: string | null
          photo_url: string
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          address?: string
          categories?: string[]
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          instagram_url?: string | null
          latitude?: number
          longitude?: number
          name?: string
          phone?: string | null
          photo_url?: string
          updated_at?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "literary_places_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      manga_access: {
        Row: {
          created_at: string
          granted_by: string | null
          id: string
          manga_id: string
          note: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          id?: string
          manga_id: string
          note?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          id?: string
          manga_id?: string
          note?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "manga_access_manga_id_fkey"
            columns: ["manga_id"]
            isOneToOne: false
            referencedRelation: "mangas"
            referencedColumns: ["id"]
          },
        ]
      }
      manga_favorites: {
        Row: {
          created_at: string
          manga_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          manga_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          manga_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "manga_favorites_manga_id_fkey"
            columns: ["manga_id"]
            isOneToOne: false
            referencedRelation: "mangas"
            referencedColumns: ["id"]
          },
        ]
      }
      mangas: {
        Row: {
          author: string
          category: string
          catalog_sale_enabled: boolean
          cover_url: string | null
          created_at: string
          creator_id: string | null
          currency: string
          description: string
          distribution_channel: string
          genres: string[]
          id: string
          invite_token: string
          is_collection: boolean
          licensed_purchase_url: string | null
          licensed_store_name: string | null
          price_cents: number
          rights_basis: string | null
          rights_confirmed_at: string | null
          slug: string
          status: string
          synopsis: string
          terms_accepted_at: string | null
          terms_version: string | null
          title: string
          view_count: number
          visibility: string
          work_type: string
        }
        Insert: {
          author?: string
          category?: string
          catalog_sale_enabled?: boolean
          cover_url?: string | null
          created_at?: string
          creator_id?: string | null
          currency?: string
          description?: string
          distribution_channel?: string
          genres?: string[]
          id?: string
          invite_token?: string
          is_collection?: boolean
          licensed_purchase_url?: string | null
          licensed_store_name?: string | null
          price_cents?: number
          rights_basis?: string | null
          rights_confirmed_at?: string | null
          slug: string
          status?: string
          synopsis?: string
          terms_accepted_at?: string | null
          terms_version?: string | null
          title: string
          view_count?: number
          visibility?: string
          work_type: string
        }
        Update: {
          author?: string
          category?: string
          catalog_sale_enabled?: boolean
          cover_url?: string | null
          created_at?: string
          creator_id?: string | null
          currency?: string
          description?: string
          distribution_channel?: string
          genres?: string[]
          id?: string
          invite_token?: string
          is_collection?: boolean
          licensed_purchase_url?: string | null
          licensed_store_name?: string | null
          price_cents?: number
          rights_basis?: string | null
          rights_confirmed_at?: string | null
          slug?: string
          status?: string
          synopsis?: string
          terms_accepted_at?: string | null
          terms_version?: string | null
          title?: string
          view_count?: number
          visibility?: string
          work_type?: string
        }
        Relationships: []
      }
      marketplace_delivery_codes: {
        Row: {
          buyer_id: string
          code: string
          created_at: string
          folder_color: string | null
          manga_ids: string[]
          order_id: string
          order_item_id: string
          seller_id: string
          target_type: string
          title: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          buyer_id: string
          code: string
          created_at?: string
          folder_color?: string | null
          manga_ids: string[]
          order_id: string
          order_item_id: string
          seller_id: string
          target_type: string
          title: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          buyer_id?: string
          code?: string
          created_at?: string
          folder_color?: string | null
          manga_ids?: string[]
          order_id?: string
          order_item_id?: string
          seller_id?: string
          target_type?: string
          title?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_delivery_codes_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_delivery_codes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "marketplace_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_delivery_codes_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: true
            referencedRelation: "marketplace_order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_delivery_codes_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_delivery_codes_used_by_fkey"
            columns: ["used_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_listings: {
        Row: {
          active: boolean
          author: string
          category: string
          cover_url: string | null
          created_at: string
          currency: string
          folder_color: string | null
          folder_id: string | null
          id: string
          manga_id: string | null
          manga_ids: string[]
          price_cents: number
          seller_id: string
          target_type: string
          title: string
          updated_at: string
          work_type: string
        }
        Insert: {
          active?: boolean
          author?: string
          category?: string
          cover_url?: string | null
          created_at?: string
          currency?: string
          folder_color?: string | null
          folder_id?: string | null
          id?: string
          manga_id?: string | null
          manga_ids?: string[]
          price_cents: number
          seller_id: string
          target_type: string
          title: string
          updated_at?: string
          work_type?: string
        }
        Update: {
          active?: boolean
          author?: string
          category?: string
          cover_url?: string | null
          created_at?: string
          currency?: string
          folder_color?: string | null
          folder_id?: string | null
          id?: string
          manga_id?: string | null
          manga_ids?: string[]
          price_cents?: number
          seller_id?: string
          target_type?: string
          title?: string
          updated_at?: string
          work_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_listings_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "library_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_listings_manga_id_fkey"
            columns: ["manga_id"]
            isOneToOne: false
            referencedRelation: "mangas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_listings_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_order_items: {
        Row: {
          author: string
          category: string
          cover_url: string | null
          created_at: string
          currency: string
          folder_color: string | null
          id: string
          listing_id: string | null
          manga_ids: string[]
          order_id: string
          price_cents: number
          target_type: string
          title: string
          work_type: string
        }
        Insert: {
          author?: string
          category?: string
          cover_url?: string | null
          created_at?: string
          currency?: string
          folder_color?: string | null
          id?: string
          listing_id?: string | null
          manga_ids: string[]
          order_id: string
          price_cents: number
          target_type: string
          title: string
          work_type?: string
        }
        Update: {
          author?: string
          category?: string
          cover_url?: string | null
          created_at?: string
          currency?: string
          folder_color?: string | null
          id?: string
          listing_id?: string | null
          manga_ids?: string[]
          order_id?: string
          price_cents?: number
          target_type?: string
          title?: string
          work_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_order_items_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "marketplace_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_order_items_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "marketplace_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "marketplace_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_orders: {
        Row: {
          buyer_id: string
          checkout_session_id: string | null
          checkout_url: string | null
          created_at: string
          currency: string
          id: string
          paid_at: string | null
          seller_id: string
          status: string
          stripe_account_id: string | null
          stripe_environment: string
          total_cents: number
          updated_at: string
        }
        Insert: {
          buyer_id: string
          checkout_session_id?: string | null
          checkout_url?: string | null
          created_at?: string
          currency?: string
          id?: string
          paid_at?: string | null
          seller_id: string
          status?: string
          stripe_account_id?: string | null
          stripe_environment: string
          total_cents: number
          updated_at?: string
        }
        Update: {
          buyer_id?: string
          checkout_session_id?: string | null
          checkout_url?: string | null
          created_at?: string
          currency?: string
          id?: string
          paid_at?: string | null
          seller_id?: string
          status?: string
          stripe_account_id?: string | null
          stripe_environment?: string
          total_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_orders_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_orders_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_sellers: {
        Row: {
          created_at: string
          featured: boolean
          live_charges_enabled: boolean
          live_details_submitted: boolean
          live_payouts_enabled: boolean
          sandbox_charges_enabled: boolean
          sandbox_details_submitted: boolean
          sandbox_payouts_enabled: boolean
          stripe_live_account_id: string | null
          stripe_sandbox_account_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          featured?: boolean
          live_charges_enabled?: boolean
          live_details_submitted?: boolean
          live_payouts_enabled?: boolean
          sandbox_charges_enabled?: boolean
          sandbox_details_submitted?: boolean
          sandbox_payouts_enabled?: boolean
          stripe_live_account_id?: string | null
          stripe_sandbox_account_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          featured?: boolean
          live_charges_enabled?: boolean
          live_details_submitted?: boolean
          live_payouts_enabled?: boolean
          sandbox_charges_enabled?: boolean
          sandbox_details_submitted?: boolean
          sandbox_payouts_enabled?: boolean
          stripe_live_account_id?: string | null
          stripe_sandbox_account_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_sellers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_wishlist: {
        Row: {
          created_at: string
          listing_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          listing_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          listing_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_wishlist_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "marketplace_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_wishlist_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "marketplace_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_wishlist_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      page_bookmarks: {
        Row: {
          collection_id: string
          created_at: string
          id: string
          page_index: number
          user_id: string
          volume_id: string
        }
        Insert: {
          collection_id: string
          created_at?: string
          id?: string
          page_index: number
          user_id: string
          volume_id: string
        }
        Update: {
          collection_id?: string
          created_at?: string
          id?: string
          page_index?: number
          user_id?: string
          volume_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "page_bookmarks_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "bookmark_collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_bookmarks_volume_id_fkey"
            columns: ["volume_id"]
            isOneToOne: false
            referencedRelation: "volumes"
            referencedColumns: ["id"]
          },
        ]
      }
      pages: {
        Row: {
          created_at: string
          id: string
          page_index: number
          storage_path: string
          volume_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          page_index: number
          storage_path: string
          volume_id: string
        }
        Update: {
          created_at?: string
          id?: string
          page_index?: number
          storage_path?: string
          volume_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pages_volume_id_fkey"
            columns: ["volume_id"]
            isOneToOne: false
            referencedRelation: "volumes"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_contacts: {
        Row: {
          user_id: string
          phone_e164: string | null
          updated_at: string
        }
        Insert: {
          user_id: string
          phone_e164?: string | null
          updated_at?: string
        }
        Update: {
          user_id?: string
          phone_e164?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          auto_next_volume: boolean
          avatar_url: string | null
          book_display_style: string
          continue_reading_preview: string
          created_at: string
          data_saver: boolean
          display_name: string
          gibi_display_style: string
          hide_reader_comments: boolean
          hq_display_style: string
          id: string
          manga_display_style: string
          page_transition: string
          page_turn_speed: string
          progress_style: string
          reader_background: string
          reader_brightness: number
          reader_onboarding_completed: boolean
          reading_direction: string
          show_progress: boolean
          site_onboarding_completed: boolean
          theme: string
          updated_at: string
          user_code: string | null
          visible_work_types: string[]
        }
        Insert: {
          auto_next_volume?: boolean
          avatar_url?: string | null
          book_display_style?: string
          continue_reading_preview?: string
          created_at?: string
          data_saver?: boolean
          display_name?: string
          gibi_display_style?: string
          hide_reader_comments?: boolean
          hq_display_style?: string
          id: string
          manga_display_style?: string
          page_transition?: string
          page_turn_speed?: string
          progress_style?: string
          reader_background?: string
          reader_brightness?: number
          reader_onboarding_completed?: boolean
          reading_direction?: string
          show_progress?: boolean
          site_onboarding_completed?: boolean
          theme?: string
          updated_at?: string
          user_code?: string | null
          visible_work_types?: string[]
        }
        Update: {
          auto_next_volume?: boolean
          avatar_url?: string | null
          book_display_style?: string
          continue_reading_preview?: string
          created_at?: string
          data_saver?: boolean
          display_name?: string
          gibi_display_style?: string
          hide_reader_comments?: boolean
          hq_display_style?: string
          id?: string
          manga_display_style?: string
          page_transition?: string
          page_turn_speed?: string
          progress_style?: string
          reader_background?: string
          reader_brightness?: number
          reader_onboarding_completed?: boolean
          reading_direction?: string
          show_progress?: boolean
          site_onboarding_completed?: boolean
          theme?: string
          updated_at?: string
          user_code?: string | null
          visible_work_types?: string[]
        }
        Relationships: []
      }
      purchases: {
        Row: {
          amount_cents: number
          created_at: string
          id: string
          manga_id: string
          provider: string
          provider_ref: string | null
          status: string
          user_id: string
        }
        Insert: {
          amount_cents?: number
          created_at?: string
          id?: string
          manga_id: string
          provider?: string
          provider_ref?: string | null
          status?: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          id?: string
          manga_id?: string
          provider?: string
          provider_ref?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchases_manga_id_fkey"
            columns: ["manga_id"]
            isOneToOne: false
            referencedRelation: "mangas"
            referencedColumns: ["id"]
          },
        ]
      }
      reading_progress: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          page_index: number
          updated_at: string
          user_id: string
          volume_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          page_index?: number
          updated_at?: string
          user_id: string
          volume_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          page_index?: number
          updated_at?: string
          user_id?: string
          volume_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reading_progress_volume_id_fkey"
            columns: ["volume_id"]
            isOneToOne: false
            referencedRelation: "volumes"
            referencedColumns: ["id"]
          },
        ]
      }
      reading_time_daily: {
        Row: {
          created_at: string
          id: string
          reading_date: string
          seconds_read: number
          updated_at: string
          user_id: string
          volume_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reading_date?: string
          seconds_read?: number
          updated_at?: string
          user_id: string
          volume_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reading_date?: string
          seconds_read?: number
          updated_at?: string
          user_id?: string
          volume_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reading_time_daily_volume_id_fkey"
            columns: ["volume_id"]
            isOneToOne: false
            referencedRelation: "volumes"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          body: string
          created_at: string
          id: string
          manga_id: string
          rating: number
          user_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          manga_id: string
          rating: number
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          manga_id?: string
          rating?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_manga_id_fkey"
            columns: ["manga_id"]
            isOneToOne: false
            referencedRelation: "mangas"
            referencedColumns: ["id"]
          },
        ]
      }
      site_settings: {
        Row: {
          created_at: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          created_at?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          environment: string
          id: string
          plan_code: string
          price_id: string | null
          provider: string
          provider_ref: string
          status: string
          stripe_customer_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          environment?: string
          id?: string
          plan_code: string
          price_id?: string | null
          provider?: string
          provider_ref?: string
          status?: string
          stripe_customer_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          environment?: string
          id?: string
          plan_code?: string
          price_id?: string | null
          provider?: string
          provider_ref?: string
          status?: string
          stripe_customer_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      system_access_daily: {
        Row: {
          day: string
          sessions: number
          user_id: string
        }
        Insert: {
          day: string
          sessions?: number
          user_id: string
        }
        Update: {
          day?: string
          sessions?: number
          user_id?: string
        }
        Relationships: []
      }
      system_access_state: {
        Row: {
          last_seen: string
          user_id: string
        }
        Insert: {
          last_seen: string
          user_id: string
        }
        Update: {
          last_seen?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      volumes: {
        Row: {
          cover_url: string | null
          created_at: string
          file_format: string
          id: string
          manga_id: string
          number: number
          page_count: number
          published: boolean
          source_name: string | null
          source_path: string | null
          source_size: number | null
          source_type: string | null
          title: string
          unit_kind: string
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          file_format?: string
          id?: string
          manga_id: string
          number: number
          page_count?: number
          published?: boolean
          source_name?: string | null
          source_path?: string | null
          source_size?: number | null
          source_type?: string | null
          title?: string
          unit_kind?: string
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          file_format?: string
          id?: string
          manga_id?: string
          number?: number
          page_count?: number
          published?: boolean
          source_name?: string | null
          source_path?: string | null
          source_size?: number | null
          source_type?: string | null
          title?: string
          unit_kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "volumes_manga_id_fkey"
            columns: ["manga_id"]
            isOneToOne: false
            referencedRelation: "mangas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      marketplace_catalog: {
        Row: {
          author: string | null
          category: string | null
          cover_url: string | null
          created_at: string | null
          currency: string | null
          id: string | null
          live_charges_enabled: boolean | null
          price_cents: number | null
          sandbox_charges_enabled: boolean | null
          seller_avatar_url: string | null
          seller_id: string | null
          seller_name: string | null
          target_type: string | null
          title: string | null
          work_type: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_listings_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_seller_stats: {
        Row: {
          avatar_url: string | null
          display_name: string | null
          featured: boolean | null
          live_charges_enabled: boolean | null
          live_sales_count: number | null
          profile_created_at: string | null
          published_count: number | null
          sandbox_charges_enabled: boolean | null
          sandbox_sales_count: number | null
          seller_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_sellers_user_id_fkey"
            columns: ["seller_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      booksyde_drive_import_ready: { Args: Record<PropertyKey, never>; Returns: boolean };
      booksyde_import_drive_volume: {
        Args: { p_manga_id: string; p_file_id: string; p_name: string; p_number: number; p_unit_kind: string; p_page_count: number; p_size: number };
        Returns: string;
      };
      booksyde_reader_source: {
        Args: { p_volume_id: string }
        Returns: string | null
      }
      booksyde_reader_preview: {
        Args: { p_volume_id: string }
        Returns: { bucket_id: string; object_path: string | null }[]
      }
      booksyde_delete_publication: {
        Args: { p_manga_id?: string; p_volume_id?: string; p_reason?: string; p_details?: string }
        Returns: Json
      }
      booksyde_reader_pages: {
        Args: { p_volume_ids: string[]; p_page_index?: number }
        Returns: { id: string; volume_id: string; page_index: number; storage_path: string }[]
      }
      booksyde_admin_list_users: { Args: never; Returns: Json }
      booksyde_admin_set_account_type: { Args: { p_user_id: string; p_account_type: string }; Returns: Json }
      booksyde_private_work_fields: {
        Args: { p_work_ids: string[] }
        Returns: { id: string; invite_token: string; licensed_purchase_url: string | null; licensed_store_name: string | null }[]
      }
      add_reading_time: {
        Args: { p_seconds: number; p_volume_id: string }
        Returns: undefined
      }
      can_access_manga: {
        Args: { _manga_id: string; _user_id: string }
        Returns: boolean
      }
      can_marketplace_chat: {
        Args: { _other_id: string; _user_id: string }
        Returns: boolean
      }
      can_read_page_path: {
        Args: { _path: string; _user_id: string }
        Returns: boolean
      }
      create_marketplace_order: {
        Args: { _environment: string; _listing_ids: string[] }
        Returns: Json
      }
      format_brl: { Args: { _cents: number }; Returns: string }
      fulfill_marketplace_order: {
        Args: { _order_id: string; _stripe_session_id: string }
        Returns: Json
      }
      generate_library_share: { Args: { _folder_id: string }; Returns: Json }
      get_admin_dashboard: { Args: { _days?: number }; Returns: Json }
      get_library_workspace: { Args: never; Returns: Json }
      get_marketplace_order_details: {
        Args: { _order_id: string }
        Returns: Json
      }
      get_similar_marketplace_listings: {
        Args: { _limit?: number; _manga_id: string }
        Returns: {
          listing_id: string
          similarity_score: number
          source_title: string
        }[]
      }
      has_purchased: {
        Args: { _manga_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_manga_view: { Args: { _manga_id: string }; Returns: undefined }
      is_creator: { Args: { _user_id: string }; Returns: boolean }
      is_free_sample_path: { Args: { _path: string }; Returns: boolean }
      mark_direct_messages_read: {
        Args: { _friend_id: string }
        Returns: undefined
      }
      record_system_access: { Args: never; Returns: undefined }
      redeem_friend_share_code: { Args: { _code: string }; Returns: Json }
      redeem_library_share:
        | { Args: { _as_folder: boolean; _code: string }; Returns: Json }
        | {
            Args: {
              _as_folder: boolean
              _code: string
              _folder_color: string
              _folder_name: string
            }
            Returns: Json
          }
      redeem_manga_invite: { Args: { _token: string }; Returns: string }
      redeem_marketplace_code: { Args: { _code: string }; Returns: Json }
      redeem_marketplace_order: { Args: { _order_id: string }; Returns: Json }
      respond_friend_request: {
        Args: { _accept: boolean; _friendship_id: string }
        Returns: undefined
      }
      save_library_folder:
        | {
            Args: {
              _color: string
              _folder_id?: string
              _manga_ids: string[]
              _name: string
            }
            Returns: string
          }
        | {
            Args: { _folder_id?: string; _manga_ids: string[]; _name: string }
            Returns: string
          }
      send_direct_message: {
        Args: {
          _body?: string
          _manga_id?: string
          _page_id?: string
          _receiver_id: string
          _share_path?: string
          _share_title?: string
          _share_type?: string
          _volume_id?: string
        }
        Returns: string
      }
      send_friend_request: { Args: { _addressee_id: string }; Returns: string }
      set_marketplace_listing_active: {
        Args: { _active: boolean; _listing_id: string }
        Returns: undefined
      }
      share_code_with_friend: {
        Args: {
          _folder_id?: string
          _manga_id?: string
          _message?: string
          _page_id?: string
          _path?: string
          _receiver_id: string
          _share_type: string
          _title: string
          _volume_id?: string
        }
        Returns: Json
      }
      upsert_marketplace_listing: {
        Args: { _price_cents: number; _target_id: string; _target_type: string }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "user" | "creator" | "editora"
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
      app_role: ["admin", "user", "creator", "editora"],
    },
  },
} as const
