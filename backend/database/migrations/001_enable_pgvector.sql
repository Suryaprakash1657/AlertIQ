-- Migration: 001_enable_pgvector.sql
-- Description: Enable pgvector extension for vector embeddings

CREATE EXTENSION IF NOT EXISTS vector;
