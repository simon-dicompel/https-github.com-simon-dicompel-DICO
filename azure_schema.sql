-- PostgreSQL Initial Script for Dicompel Catalog
-- This matches the routes in server.ts

-- Profiles Table
CREATE TABLE IF NOT EXISTS profiles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'REPRESENTATIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Products Table
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    code VARCHAR(100) UNIQUE NOT NULL,
    description TEXT NOT NULL,
    reference VARCHAR(100),
    colors TEXT[], -- Array of strings
    image_url TEXT,
    category VARCHAR(100),
    subcategory VARCHAR(100),
    line VARCHAR(100),
    amperage VARCHAR(50),
    details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Orders Table
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    representative_id INTEGER REFERENCES profiles(id),
    items JSONB NOT NULL, -- List of CartItems
    customer_name VARCHAR(255),
    customer_email VARCHAR(255),
    customer_contact VARCHAR(255),
    notes TEXT,
    status VARCHAR(50) DEFAULT 'Novo',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    interactions JSONB DEFAULT '[]'::jsonb
);

-- Seed Initial Data
INSERT INTO profiles (name, email, password, role) 
VALUES ('Administrador Dicompel', 'admin@dicompel.com.br', 'Sigilo!@#2025', 'ADMIN')
ON CONFLICT (email) DO NOTHING;

INSERT INTO profiles (name, email, password, role) 
VALUES ('Fabiano Dias', 'fabiano@dicompel.com.br', 'senha123', 'REPRESENTATIVE')
ON CONFLICT (email) DO NOTHING;

-- Initial Products
INSERT INTO products (code, description, reference, colors, category, line)
VALUES ('2001', 'Interruptor Simples 10A 250V~', 'D-2001', ARRAY['Branco', 'Preto', 'Cromado'], 'Interruptores', 'Pollar')
ON CONFLICT (code) DO NOTHING;

INSERT INTO products (code, description, reference, colors, category, line)
VALUES ('2002', 'Tomada 2P+T 10A 250V~', 'D-2002', ARRAY['Branco', 'Preto'], 'Tomadas', 'Pollar')
ON CONFLICT (code) DO NOTHING;
