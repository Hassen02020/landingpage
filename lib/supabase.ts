// import { createClient } from '@supabase/supabase-js'
// Note: Installer @supabase/supabase-js avec: npm install @supabase/supabase-js
// Ajouter les variables d'environnement dans .env.local:
// NEXT_PUBLIC_SUPABASE_URL=votre_url_supabase
// NEXT_PUBLIC_SUPABASE_ANON_KEY=votre_cle_anon

// const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
// const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Client Supabase mock pour développement (remplacer par le vrai client après installation)
export const supabase = {
  from: (table: string) => ({
    insert: (data: any) => ({
      select: () => ({
        single: () => Promise.resolve({ data: { id: 'mock-id', ...data[0] }, error: null })
      })
    })
  })
}

export interface Lead {
  id?: string
  name: string
  phone: string
  destination: string
  travel_date: string
  adults: number
  children: number
  trip_type: string
  budget: string
  source: string
  created_at?: string
}

export async function saveLead(lead: Omit<Lead, 'id' | 'created_at'>) {
  const { data, error } = await supabase
    .from('leads')
    .insert([lead])
    .select()
    .single()

  if (error) {
    console.error('Error saving lead:', error)
    throw error
  }

  return data
}
