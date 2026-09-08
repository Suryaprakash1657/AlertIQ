-- Migration: 002_create_knowledge_tables.sql
-- Description: Create knowledge_documents and knowledge_chunks tables with pgvector VECTOR(768)

-- 1. Create knowledge_documents table
CREATE TABLE IF NOT EXISTS knowledge_documents (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL CHECK (length(trim(title)) > 0),
    content TEXT NOT NULL CHECK (length(trim(content)) > 0),
    source TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    chunk_count INTEGER NOT NULL DEFAULT 0 CHECK (chunk_count >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create knowledge_chunks table
CREATE TABLE IF NOT EXISTS knowledge_chunks (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL CHECK (chunk_index >= 0),
    total_chunks INTEGER NOT NULL CHECK (total_chunks > 0),
    content TEXT NOT NULL CHECK (length(trim(content)) > 0),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    char_count INTEGER NOT NULL CHECK (char_count >= 0),
    token_estimate INTEGER NOT NULL CHECK (token_estimate >= 0),
    embedding VECTOR(768),
    embedding_status TEXT NOT NULL DEFAULT 'pending' CHECK (embedding_status IN ('pending', 'ready', 'failed')),
    embedding_model TEXT,
    embedding_dimensions INTEGER CHECK (
        (embedding IS NULL AND embedding_dimensions IS NULL) OR 
        (embedding IS NOT NULL AND embedding_dimensions = 768)
    ),
    embedding_generated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_knowledge_chunks_doc_idx UNIQUE (document_id, chunk_index)
);

-- 3. Create required performance indexes
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_document_id 
    ON knowledge_chunks(document_id);

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding_status 
    ON knowledge_chunks(embedding_status);

CREATE INDEX IF NOT EXISTS idx_knowledge_documents_created_at 
    ON knowledge_documents(created_at DESC);
