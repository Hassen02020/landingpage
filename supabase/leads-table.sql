-- Créer la table leads
CREATE TABLE IF NOT EXISTS leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  destination TEXT,
  travel_date DATE,
  adults INTEGER DEFAULT 1,
  children INTEGER DEFAULT 0,
  trip_type TEXT,
  budget TEXT,
  source TEXT DEFAULT 'landing_easy2book',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Ajouter des index pour les performances
CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at);

-- Activer Row Level Security (RLS)
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- Politique pour permettre les insertions depuis l'application
CREATE POLICY "Allow insert leads" ON leads
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Politique pour permettre la lecture (optionnel, pour admin)
CREATE POLICY "Allow read leads" ON leads
  FOR SELECT
  TO authenticated
  USING (true);

-- Commentaire sur la table
COMMENT ON TABLE leads IS 'Leads capturés depuis le formulaire Summer Vibes';
