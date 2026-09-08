/**
 * Alert & Analysis History Repository for AlertIQ (Module 3.26)
 *
 * Provides persistent PostgreSQL-backed and in-memory implementations
 * for persisting structured alerts, Gemini analyses, and RAG source provenance.
 */

import { getClient, query as dbQuery } from "../config/db.js";

/**
 * Validates and normalizes pagination and filter parameters.
 */
export const normalizeHistoryQueryOptions = (options = {}) => {
  let page = parseInt(options.page, 10);
  if (isNaN(page) || page < 1) page = 1;

  let limit = parseInt(options.limit, 10);
  if (isNaN(limit) || limit < 1) limit = 20;
  if (limit > 100) limit = 100;

  const filters = {};
  if (options.severity && typeof options.severity === "string" && options.severity.trim()) {
    filters.severity = options.severity.trim().toUpperCase();
  }
  if (options.riskLevel && typeof options.riskLevel === "string" && options.riskLevel.trim()) {
    filters.riskLevel = options.riskLevel.trim().toUpperCase();
  }
  if (options.source && typeof options.source === "string" && options.source.trim()) {
    filters.source = options.source.trim();
  }
  if (options.ragStatus && typeof options.ragStatus === "string" && options.ragStatus.trim()) {
    filters.ragStatus = options.ragStatus.trim().toLowerCase();
  }

  return { page, limit, filters };
};

/**
 * In-Memory Alert History Repository implementation for isolated tests.
 */
export class InMemoryAlertHistoryRepository {
  constructor() {
    this.alerts = new Map();
    this.analyses = new Map();
    this.sources = new Map();
    this.nextAlertId = 1;
    this.nextAnalysisId = 1;
    this.nextSourceId = 1;
  }

  async saveAlertAnalysis({ alert, analysis, knowledgeContext = {}, model = null, usage = null }) {
    const alertRecordId = this.nextAlertId++;
    const analysisId = this.nextAnalysisId++;

    const alertRecord = {
      id: alertRecordId,
      alertId: alert.alertId || null,
      title: alert.title,
      severity: alert.severity,
      source: alert.source,
      timestamp: alert.timestamp ? new Date(alert.timestamp).toISOString() : null,
      description: alert.description || null,
      sourceIp: alert.sourceIp || null,
      destinationIp: alert.destinationIp || null,
      targetHost: alert.targetHost || null,
      userName: alert.user || alert.userName || null,
      status: alert.status || null,
      evidence: alert.evidence || alert.rawLogs || null,
      additionalDetails: alert.additionalDetails || null,
      createdAt: new Date().toISOString()
    };
    this.alerts.set(alertRecordId, alertRecord);

    const ragStatus = knowledgeContext.status || "disabled";
    const rawSources = ragStatus === "success" && Array.isArray(knowledgeContext.sourcesUsed)
      ? knowledgeContext.sourcesUsed
      : [];

    const analysisRecord = {
      id: analysisId,
      alertRecordId,
      summary: analysis.summary,
      riskLevel: analysis.riskAssessment?.level || "LOW",
      riskReasoning: analysis.riskAssessment?.reasoning || "",
      keyIndicators: analysis.keyIndicators || [],
      investigationSteps: analysis.investigationSteps || [],
      recommendedActions: analysis.recommendedActions || [],
      assumptions: analysis.assumptions || [],
      limitations: analysis.limitations || [],
      model: model || null,
      usage: usage || null,
      ragStatus,
      matchesFound: knowledgeContext.matchesFound || 0,
      sourcesUsedCount: rawSources.length,
      createdAt: new Date().toISOString()
    };
    this.analyses.set(analysisId, analysisRecord);

    const savedSources = [];
    for (const src of rawSources) {
      const sourceId = this.nextSourceId++;
      const sourceRecord = {
        id: sourceId,
        analysisId,
        documentId: src.documentId,
        documentTitle: src.title || null,
        source: src.source || null,
        category: src.category || null,
        similarity: typeof src.similarity === "number" ? src.similarity : null,
        createdAt: new Date().toISOString()
      };
      this.sources.set(sourceId, sourceRecord);
      savedSources.push(sourceRecord);
    }

    return {
      saved: true,
      analysisId,
      alertRecordId,
      alert: alertRecord,
      analysis: analysisRecord,
      sources: savedSources
    };
  }

  async findAnalysisById(analysisId) {
    const numericId = parseInt(analysisId, 10);
    if (isNaN(numericId)) return null;

    const analysis = this.analyses.get(numericId);
    if (!analysis) return null;

    const alert = this.alerts.get(analysis.alertRecordId) || null;
    const sources = Array.from(this.sources.values()).filter((s) => s.analysisId === numericId);

    return {
      analysisId: analysis.id,
      alert: alert ? {
        id: alert.id,
        alertId: alert.alertId,
        title: alert.title,
        severity: alert.severity,
        source: alert.source,
        timestamp: alert.timestamp,
        description: alert.description,
        sourceIp: alert.sourceIp,
        destinationIp: alert.destinationIp,
        targetHost: alert.targetHost,
        userName: alert.userName,
        status: alert.status,
        evidence: alert.evidence,
        additionalDetails: alert.additionalDetails,
        createdAt: alert.createdAt
      } : null,
      analysis: {
        summary: analysis.summary,
        riskAssessment: {
          level: analysis.riskLevel,
          reasoning: analysis.riskReasoning
        },
        keyIndicators: analysis.keyIndicators,
        investigationSteps: analysis.investigationSteps,
        recommendedActions: analysis.recommendedActions,
        assumptions: analysis.assumptions,
        limitations: analysis.limitations
      },
      model: analysis.model,
      usage: analysis.usage,
      ragStatus: analysis.ragStatus,
      matchesFound: analysis.matchesFound,
      sourcesUsedCount: analysis.sourcesUsedCount,
      sources,
      createdAt: analysis.createdAt
    };
  }

  async findAllAnalyses(options = {}) {
    const { page, limit, filters } = normalizeHistoryQueryOptions(options);

    let items = Array.from(this.analyses.values()).map((an) => {
      const alert = this.alerts.get(an.alertRecordId) || {};
      return {
        analysisId: an.id,
        alertId: an.alertRecordId,
        externalAlertId: alert.alertId || null,
        title: alert.title || "",
        severity: alert.severity || "",
        source: alert.source || "",
        riskLevel: an.riskLevel,
        summary: an.summary,
        model: an.model,
        ragStatus: an.ragStatus,
        matchesFound: an.matchesFound,
        sourcesUsedCount: an.sourcesUsedCount,
        createdAt: an.createdAt
      };
    });

    if (filters.severity) {
      items = items.filter((i) => i.severity === filters.severity);
    }
    if (filters.riskLevel) {
      items = items.filter((i) => i.riskLevel === filters.riskLevel);
    }
    if (filters.source) {
      items = items.filter((i) => i.source === filters.source);
    }
    if (filters.ragStatus) {
      items = items.filter((i) => i.ragStatus === filters.ragStatus);
    }

    // Sort newest first
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const total = items.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const offset = (page - 1) * limit;
    const pagedData = items.slice(offset, offset + limit);

    return {
      data: pagedData,
      pagination: {
        page,
        limit,
        total,
        totalPages
      }
    };
  }

  async deleteAnalysisById(analysisId) {
    const numericId = parseInt(analysisId, 10);
    const analysis = this.analyses.get(numericId);
    if (!analysis) return false;

    this.analyses.delete(numericId);
    if (analysis.alertRecordId) {
      this.alerts.delete(analysis.alertRecordId);
    }
    for (const [sId, src] of this.sources.entries()) {
      if (src.analysisId === numericId) {
        this.sources.delete(sId);
      }
    }
    return true;
  }

  async deleteAlertById(alertId) {
    const numericId = parseInt(alertId, 10);
    this.alerts.delete(numericId);
    for (const [anId, an] of this.analyses.entries()) {
      if (an.alertRecordId === numericId) {
        this.deleteAnalysisById(anId);
      }
    }
    return true;
  }

  async clearAll() {
    this.alerts.clear();
    this.analyses.clear();
    this.sources.clear();
    this.nextAlertId = 1;
    this.nextAnalysisId = 1;
    this.nextSourceId = 1;
  }
}

/**
 * PostgreSQL Alert History Repository implementation.
 */
export class PostgresAlertHistoryRepository {
  /**
   * Saves an alert, its analysis, and RAG sources atomically in a single PostgreSQL transaction.
   *
   * @param {Object} params
   * @param {Object} params.alert - Normalized alert object.
   * @param {Object} params.analysis - Normalized structured Gemini analysis.
   * @param {Object} [params.knowledgeContext] - RAG knowledge context metadata.
   * @param {string} [params.model] - Gemini model identifier.
   * @param {Object} [params.usage] - Token usage metadata.
   * @returns {Promise<{
   *   saved: boolean,
   *   analysisId: number,
   *   alertRecordId: number,
   *   alert: Object,
   *   analysis: Object,
   *   sources: Array<Object>
   * }>}
   */
  async saveAlertAnalysis({ alert, analysis, knowledgeContext = {}, model = null, usage = null }) {
    const client = await getClient();
    try {
      await client.query("BEGIN;");

      // 1. Insert alert record
      const alertSql = `
        INSERT INTO alerts (
          alert_id, title, severity, source, timestamp, description,
          source_ip, destination_ip, target_host, user_name, status,
          evidence, additional_details, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
        RETURNING id, alert_id as "alertId", title, severity, source, timestamp,
                  description, source_ip as "sourceIp", destination_ip as "destinationIp",
                  target_host as "targetHost", user_name as "userName", status,
                  evidence, additional_details as "additionalDetails", created_at as "createdAt";
      `;

      const alertParams = [
        alert.alertId || null,
        alert.title,
        alert.severity,
        alert.source,
        alert.timestamp ? new Date(alert.timestamp) : null,
        alert.description || null,
        alert.sourceIp || null,
        alert.destinationIp || null,
        alert.targetHost || null,
        alert.user || alert.userName || null,
        alert.status || null,
        alert.evidence || alert.rawLogs ? JSON.stringify(alert.evidence || alert.rawLogs) : null,
        alert.additionalDetails ? JSON.stringify(alert.additionalDetails) : null
      ];

      const alertRes = await client.query(alertSql, alertParams);
      const savedAlert = alertRes.rows[0];
      const alertRecordId = Number(savedAlert.id);

      // 2. Insert analysis record
      const ragStatus = knowledgeContext.status || "disabled";
      const rawSources = ragStatus === "success" && Array.isArray(knowledgeContext.sourcesUsed)
        ? knowledgeContext.sourcesUsed
        : [];

      const analysisSql = `
        INSERT INTO alert_analyses (
          alert_id, summary, risk_level, risk_reasoning,
          key_indicators, investigation_steps, recommended_actions,
          assumptions, limitations, model, usage,
          rag_status, matches_found, sources_used_count, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
        RETURNING id, alert_id as "alertRecordId", summary, risk_level as "riskLevel",
                  risk_reasoning as "riskReasoning", key_indicators as "keyIndicators",
                  investigation_steps as "investigationSteps", recommended_actions as "recommendedActions",
                  assumptions, limitations, model, usage, rag_status as "ragStatus",
                  matches_found as "matchesFound", sources_used_count as "sourcesUsedCount",
                  created_at as "createdAt";
      `;

      const analysisParams = [
        alertRecordId,
        analysis.summary,
        analysis.riskAssessment?.level || "LOW",
        analysis.riskAssessment?.reasoning || "",
        JSON.stringify(analysis.keyIndicators || []),
        JSON.stringify(analysis.investigationSteps || []),
        JSON.stringify(analysis.recommendedActions || []),
        JSON.stringify(analysis.assumptions || []),
        JSON.stringify(analysis.limitations || []),
        model || null,
        usage ? JSON.stringify(usage) : null,
        ragStatus,
        knowledgeContext.matchesFound || 0,
        rawSources.length
      ];

      const analysisRes = await client.query(analysisSql, analysisParams);
      const savedAnalysis = analysisRes.rows[0];
      const analysisId = Number(savedAnalysis.id);

      // 3. Insert RAG source provenance records (Zero vectors stored)
      const savedSources = [];
      if (rawSources.length > 0) {
        for (const src of rawSources) {
          const sourceSql = `
            INSERT INTO alert_analysis_sources (
              analysis_id, document_id, document_title, source, category, similarity, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
            RETURNING id, analysis_id as "analysisId", document_id as "documentId",
                      document_title as "documentTitle", source, category, similarity,
                      created_at as "createdAt";
          `;

          const sourceParams = [
            analysisId,
            src.documentId,
            src.title || null,
            src.source || null,
            src.category || null,
            typeof src.similarity === "number" ? src.similarity : null
          ];

          const sourceRes = await client.query(sourceSql, sourceParams);
          savedSources.push(sourceRes.rows[0]);
        }
      }

      await client.query("COMMIT;");

      return {
        saved: true,
        analysisId,
        alertRecordId,
        alert: savedAlert,
        analysis: savedAnalysis,
        sources: savedSources
      };
    } catch (err) {
      await client.query("ROLLBACK;");
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Retrieves a complete persisted analysis with its alert context and RAG sources by analysis ID.
   *
   * @param {number|string} analysisId
   * @returns {Promise<Object|null>}
   */
  async findAnalysisById(analysisId) {
    const numericId = parseInt(analysisId, 10);
    if (isNaN(numericId) || numericId <= 0) return null;

    const sql = `
      SELECT 
        an.id as "analysisId",
        an.summary,
        an.risk_level as "riskLevel",
        an.risk_reasoning as "riskReasoning",
        an.key_indicators as "keyIndicators",
        an.investigation_steps as "investigationSteps",
        an.recommended_actions as "recommendedActions",
        an.assumptions,
        an.limitations,
        an.model,
        an.usage,
        an.rag_status as "ragStatus",
        an.matches_found as "matchesFound",
        an.sources_used_count as "sourcesUsedCount",
        an.created_at as "createdAt",
        a.id as "alertRecordId",
        a.alert_id as "externalAlertId",
        a.title as "alertTitle",
        a.severity as "alertSeverity",
        a.source as "alertSource",
        a.timestamp as "alertTimestamp",
        a.description as "alertDescription",
        a.source_ip as "alertSourceIp",
        a.destination_ip as "alertDestinationIp",
        a.target_host as "alertTargetHost",
        a.user_name as "alertUserName",
        a.status as "alertStatus",
        a.evidence as "alertEvidence",
        a.additional_details as "alertAdditionalDetails",
        a.created_at as "alertCreatedAt"
      FROM alert_analyses an
      JOIN alerts a ON an.alert_id = a.id
      WHERE an.id = $1;
    `;

    const result = await dbQuery(sql, [numericId]);
    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];

    // Fetch associated RAG sources
    const sourcesSql = `
      SELECT 
        id,
        analysis_id as "analysisId",
        document_id as "documentId",
        document_title as "documentTitle",
        source,
        category,
        similarity,
        created_at as "createdAt"
      FROM alert_analysis_sources
      WHERE analysis_id = $1
      ORDER BY similarity DESC NULLS LAST, id ASC;
    `;
    const sourcesRes = await dbQuery(sourcesSql, [numericId]);

    return {
      analysisId: Number(row.analysisId),
      alert: {
        id: Number(row.alertRecordId),
        alertId: row.externalAlertId,
        title: row.alertTitle,
        severity: row.alertSeverity,
        source: row.alertSource,
        timestamp: row.alertTimestamp,
        description: row.alertDescription,
        sourceIp: row.alertSourceIp,
        destinationIp: row.alertDestinationIp,
        targetHost: row.alertTargetHost,
        userName: row.alertUserName,
        status: row.alertStatus,
        evidence: row.alertEvidence,
        additionalDetails: row.alertAdditionalDetails,
        createdAt: row.alertCreatedAt
      },
      analysis: {
        summary: row.summary,
        riskAssessment: {
          level: row.riskLevel,
          reasoning: row.riskReasoning
        },
        keyIndicators: row.keyIndicators || [],
        investigationSteps: row.investigationSteps || [],
        recommendedActions: row.recommendedActions || [],
        assumptions: row.assumptions || [],
        limitations: row.limitations || []
      },
      model: row.model,
      usage: row.usage,
      ragStatus: row.ragStatus,
      matchesFound: row.matchesFound,
      sourcesUsedCount: row.sourcesUsedCount,
      sources: sourcesRes.rows.map((s) => ({
        id: Number(s.id),
        analysisId: Number(s.analysisId),
        documentId: s.documentId,
        title: s.documentTitle,
        source: s.source,
        category: s.category,
        similarity: s.similarity !== null ? parseFloat(s.similarity) : null,
        createdAt: s.createdAt
      })),
      createdAt: row.createdAt
    };
  }

  /**
   * Retrieves paginated summary list of analyses with filtering.
   *
   * @param {Object} options
   * @param {number} [options.page=1]
   * @param {number} [options.limit=20]
   * @param {string} [options.severity]
   * @param {string} [options.riskLevel]
   * @param {string} [options.source]
   * @param {string} [options.ragStatus]
   * @returns {Promise<{
   *   data: Array<Object>,
   *   pagination: { page: number, limit: number, total: number, totalPages: number }
   * }>}
   */
  async findAllAnalyses(options = {}) {
    const { page, limit, filters } = normalizeHistoryQueryOptions(options);

    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (filters.severity) {
      conditions.push(`a.severity = $${paramIndex++}`);
      params.push(filters.severity);
    }
    if (filters.riskLevel) {
      conditions.push(`an.risk_level = $${paramIndex++}`);
      params.push(filters.riskLevel);
    }
    if (filters.source) {
      conditions.push(`a.source = $${paramIndex++}`);
      params.push(filters.source);
    }
    if (filters.ragStatus) {
      conditions.push(`an.rag_status = $${paramIndex++}`);
      params.push(filters.ragStatus);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Count query
    const countSql = `
      SELECT COUNT(*)::integer as count
      FROM alert_analyses an
      JOIN alerts a ON an.alert_id = a.id
      ${whereClause};
    `;
    const countRes = await dbQuery(countSql, params);
    const total = countRes.rows[0]?.count || 0;
    const totalPages = Math.ceil(total / limit) || 1;
    const offset = (page - 1) * limit;

    // Data query (lightweight, omitting giant evidence blobs and raw vectors)
    const dataSql = `
      SELECT 
        an.id as "analysisId",
        an.alert_id as "alertId",
        a.alert_id as "externalAlertId",
        a.title,
        a.severity,
        a.source,
        an.risk_level as "riskLevel",
        an.summary,
        an.model,
        an.rag_status as "ragStatus",
        an.matches_found as "matchesFound",
        an.sources_used_count as "sourcesUsedCount",
        an.created_at as "createdAt"
      FROM alert_analyses an
      JOIN alerts a ON an.alert_id = a.id
      ${whereClause}
      ORDER BY an.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++};
    `;

    const dataParams = [...params, limit, offset];
    const dataRes = await dbQuery(dataSql, dataParams);

    const data = dataRes.rows.map((r) => ({
      analysisId: Number(r.analysisId),
      alertId: Number(r.alertId),
      externalAlertId: r.externalAlertId,
      title: r.title,
      severity: r.severity,
      source: r.source,
      riskLevel: r.riskLevel,
      summary: r.summary,
      model: r.model,
      ragStatus: r.ragStatus,
      matchesFound: r.matchesFound,
      sourcesUsedCount: r.sourcesUsedCount,
      createdAt: r.createdAt
    }));

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages
      }
    };
  }

  /**
   * Deletes an analysis and cascade-deletes associated sources.
   * If the associated alert is orphaned or specified, cleans up appropriately.
   */
  async deleteAnalysisById(analysisId) {
    const numericId = parseInt(analysisId, 10);
    if (isNaN(numericId)) return false;

    const res = await dbQuery("DELETE FROM alert_analyses WHERE id = $1 RETURNING alert_id as \"alertId\";", [numericId]);
    if (res.rows.length === 0) return false;

    const alertId = res.rows[0].alertId;
    if (alertId) {
      await dbQuery("DELETE FROM alerts WHERE id = $1;", [alertId]);
    }
    return true;
  }

  /**
   * Deletes an alert and cascade-deletes all its analyses and sources.
   */
  async deleteAlertById(alertId) {
    const numericId = parseInt(alertId, 10);
    if (isNaN(numericId)) return false;

    const res = await dbQuery("DELETE FROM alerts WHERE id = $1 RETURNING id;", [numericId]);
    return res.rows.length > 0;
  }
}

// Singleton instances
export const inMemoryAlertHistoryRepository = new InMemoryAlertHistoryRepository();
export const postgresAlertHistoryRepository = new PostgresAlertHistoryRepository();

// Active repository reference (default: postgres in production, or in-memory if requested)
let activeAlertHistoryRepository = process.env.ALERT_HISTORY_STORAGE === "memory"
  ? inMemoryAlertHistoryRepository
  : postgresAlertHistoryRepository;

export const setAlertHistoryRepository = (repo) => {
  activeAlertHistoryRepository = repo;
};

export const useInMemoryAlertHistoryRepository = () => {
  activeAlertHistoryRepository = inMemoryAlertHistoryRepository;
  return activeAlertHistoryRepository;
};

export const usePostgresAlertHistoryRepository = () => {
  activeAlertHistoryRepository = postgresAlertHistoryRepository;
  return activeAlertHistoryRepository;
};

export const getAlertHistoryRepository = () => activeAlertHistoryRepository;

/**
 * Proxy export ensuring all existing and future imports of `alertHistoryRepository`
 * dynamically delegate to the currently active repository instance.
 */
export const alertHistoryRepository = new Proxy(
  {},
  {
    get(_, prop) {
      const target = activeAlertHistoryRepository;
      const val = target[prop];
      if (typeof val === "function") {
        return val.bind(target);
      }
      return val;
    }
  }
);
