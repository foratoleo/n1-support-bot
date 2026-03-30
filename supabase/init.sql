-- N1 Support Bot Database Schema
-- rag schema for RAG knowledge base and support bot

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create rag schema
CREATE SCHEMA IF NOT EXISTS rag;

-- Knowledge base documents
CREATE TABLE IF NOT EXISTS rag.kb_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    area TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    file_path TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User issue reports
CREATE TABLE IF NOT EXISTS rag.user_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    project_id UUID,
    description TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Conversation history
CREATE TABLE IF NOT EXISTS rag.conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_report_id UUID REFERENCES rag.user_reports(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'bot')),
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Human escalations
CREATE TABLE IF NOT EXISTS rag.escalations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_report_id UUID REFERENCES rag.user_reports(id) ON DELETE CASCADE,
    summary TEXT NOT NULL,
    project_name TEXT,
    impact TEXT,
    assigned_to UUID,
    status TEXT DEFAULT 'open',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_kb_documents_area ON rag.kb_documents(area);
CREATE INDEX IF NOT EXISTS idx_kb_documents_title ON rag.kb_documents(title);
CREATE INDEX IF NOT EXISTS idx_user_reports_status ON rag.user_reports(status);
CREATE INDEX IF NOT EXISTS idx_user_reports_user_id ON rag.user_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user_report_id ON rag.conversations(user_report_id);
CREATE INDEX IF NOT EXISTS idx_escalations_user_report_id ON rag.escalations(user_report_id);
CREATE INDEX IF NOT EXISTS idx_escalations_status ON rag.escalations(status);

-- Optional: Enable pgvector for similarity search (uncomment if pgvector installed)
-- CREATE EXTENSION IF NOT EXISTS vector;
-- ALTER TABLE rag.kb_documents ADD COLUMN IF NOT EXISTS embedding vector(1536);
-- CREATE INDEX IF NOT EXISTS idx_kb_documents_embedding ON rag.kb_documents USING ivfflat(embedding vector_cosine_ops);
