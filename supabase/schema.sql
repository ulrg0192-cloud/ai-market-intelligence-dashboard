-- Role Enum
CREATE TYPE user_role AS ENUM ('visitor', 'master');

-- Users Table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR UNIQUE NOT NULL,
  role user_role DEFAULT 'visitor',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Access Codes Table
CREATE TABLE access_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  hashed_code VARCHAR NOT NULL,
  is_used BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sessions Table
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL, -- Designed for 48h expiration handling
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Portfolio Data Table
CREATE TABLE portfolio_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source VARCHAR UNIQUE NOT NULL,
  payload JSONB NOT NULL,
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_access_codes_user_id ON access_codes(user_id);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_token_hash ON sessions(token_hash);
