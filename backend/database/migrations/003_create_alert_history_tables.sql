-- Migration: 003_create_alert_history_tables.sql
-- Description: Create alerts, alert_analyses, and alert_analysis_sources tables for AlertIQ history persistence

-- 1. Create alerts table
CREATE TABLE IF NOT EXISTS alerts (
    id BIGSERIAL PRIMARY KEY,
    alert_id TEXT,
    title TEXT NOT NULL CHECK (length(trim(title)) > 0),
    severity TEXT NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    source TEXT NOT NULL CHECK (length(trim(source)) > 0),
    timestamp TIMESTAMPTZ,
    description TEXT,
    source_ip TEXT,
    destination_ip TEXT,
    target_host TEXT,
    user_name TEXT,
    status TEXT,
    evidence JSONB,
    additional_details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for alerts table
CREATE INDEX IF NOT EXISTS idx_alerts_alert_id 
    ON alerts(alert_id);

CREATE INDEX IF NOT EXISTS idx_alerts_created_at 
    ON alerts(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_alerts_severity 
    ON alerts(severity);

CREATE INDEX IF NOT EXISTS idx_alerts_source 
    ON alerts(source);

-- 2. Create alert_analyses table
CREATE TABLE IF NOT EXISTS alert_analyses (
    id BIGSERIAL PRIMARY KEY,
    alert_id BIGINT NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
    summary TEXT NOT NULL,
    risk_level TEXT NOT NULL CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    risk_reasoning TEXT NOT NULL,
    key_indicators JSONB NOT NULL DEFAULT '[]'::jsonb,
    investigation_steps JSONB NOT NULL DEFAULT '[]'::jsonb,
    recommended_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
    assumptions JSONB NOT NULL DEFAULT '[]'::jsonb,
    limitations JSONB NOT NULL DEFAULT '[]'::jsonb,
    model TEXT,
    usage JSONB,
    rag_status TEXT NOT NULL CHECK (rag_status IN ('success', 'no_match', 'empty_kb', 'failed', 'disabled')),
    matches_found INTEGER NOT NULL DEFAULT 0 CHECK (matches_found >= 0),
    sources_used_count INTEGER NOT NULL DEFAULT 0 CHECK (sources_used_count >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for alert_analyses table
CREATE INDEX IF NOT EXISTS idx_alert_analyses_alert_id 
    ON alert_analyses(alert_id);

CREATE INDEX IF NOT EXISTS idx_alert_analyses_risk_level 
    ON alert_analyses(risk_level);

CREATE INDEX IF NOT EXISTS idx_alert_analyses_created_at 
    ON alert_analyses(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_alert_analyses_rag_status 
    ON alert_analyses(rag_status);

-- 3. Create alert_analysis_sources table (No raw vector storage, provenance metadata only)
CREATE TABLE IF NOT EXISTS alert_analysis_sources (
    id BIGSERIAL PRIMARY KEY,
    analysis_id BIGINT NOT NULL REFERENCES alert_analyses(id) ON DELETE CASCADE,
    document_id TEXT NOT NULL,
    document_title TEXT,
    source TEXT,
    category TEXT,
    similarity DOUBLE PRECISION,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for alert_analysis_sources table
CREATE INDEX IF NOT EXISTS idx_alert_analysis_sources_analysis_id 
    ON alert_analysis_sources(analysis_id);

CREATE INDEX IF NOT EXISTS idx_alert_analysis_sources_document_id 
    ON alert_analysis_sources(document_id);
