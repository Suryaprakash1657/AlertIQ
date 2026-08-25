import { getModelPricing } from "../config/pricing.config.js";

/**
 * Estimate the API cost for a given token usage and model.
 *
 * @param {Object} usage - Token usage object containing inputTokens, outputTokens, totalTokens, etc.
 * @param {number} [usage.inputTokens=0] - Number of input/prompt tokens.
 * @param {number} [usage.outputTokens=0] - Number of output/candidate tokens.
 * @param {number} [usage.thoughtsTokens=0] - Number of reasoning/thought tokens (if applicable).
 * @param {string} [modelName=""] - The model identifier used for pricing lookup.
 * @returns {Object} Estimated cost breakdown and totals.
 */
export const estimateLlmCost = (usage = {}, modelName = "") => {
  const inputTokens = Math.max(0, Number(usage.inputTokens) || 0);
  const outputTokens = Math.max(0, Number(usage.outputTokens) || 0);
  const thoughtsTokens = Math.max(0, Number(usage.thoughtsTokens) || 0);

  const pricing = getModelPricing(modelName);

  // Total billable output tokens includes candidates and any internal thought reasoning tokens
  const totalOutputTokens = outputTokens + thoughtsTokens;

  // Calculation formula: (tokens / 1,000,000) * ratePerMillion
  const inputCost = (inputTokens / 1_000_000) * pricing.inputCostPerMillion;
  const outputCost = (totalOutputTokens / 1_000_000) * pricing.outputCostPerMillion;
  const totalCost = inputCost + outputCost;

  return {
    totalCostUsd: Number(totalCost.toFixed(8)),
    inputCostUsd: Number(inputCost.toFixed(8)),
    outputCostUsd: Number(outputCost.toFixed(8)),
    currency: "USD",
    rates: {
      inputCostPerMillionUsd: pricing.inputCostPerMillion,
      outputCostPerMillionUsd: pricing.outputCostPerMillion
    },
    isEstimate: true
  };
};
