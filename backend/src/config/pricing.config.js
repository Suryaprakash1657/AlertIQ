/**
 * LLM Pricing Configuration for AlertIQ
 * 
 * Token pricing is specified in USD per 1,000,000 tokens ($ / 1M tokens).
 * 
 * NOTE: These are estimated standard API pricing rates used for request cost calculation.
 * Actual billed amounts from Google Cloud / Gemini API may vary based on caching, batching,
 * tier, or promotional credits.
 */

export const MODEL_PRICING = {
  // Gemini 3.x / 2.5 / 2.0 / 1.5 Flash standard tier baseline
  "gemini-3.6-flash": {
    inputCostPerMillion: 0.10,   // $0.10 per 1M input tokens
    outputCostPerMillion: 0.40   // $0.40 per 1M output/candidate tokens
  },
  "gemini-2.5-flash": {
    inputCostPerMillion: 0.10,
    outputCostPerMillion: 0.40
  },
  "gemini-2.0-flash": {
    inputCostPerMillion: 0.10,
    outputCostPerMillion: 0.40
  },
  "gemini-1.5-flash": {
    inputCostPerMillion: 0.075,
    outputCostPerMillion: 0.30
  },
  "gemini-1.5-pro": {
    inputCostPerMillion: 1.25,
    outputCostPerMillion: 5.00
  },
  // Default fallback rate for unspecified or custom models
  default: {
    inputCostPerMillion: 0.10,
    outputCostPerMillion: 0.40
  }
};

/**
 * Retrieve the pricing rate configuration for a specific model name.
 * Supports environment variable overrides if configured.
 * 
 * @param {string} [modelName] - The model identifier (e.g. "gemini-3.6-flash")
 * @returns {{inputCostPerMillion: number, outputCostPerMillion: number}}
 */
export const getModelPricing = (modelName = "") => {
  const envInputCost = process.env.LLM_INPUT_COST_PER_MILLION ? parseFloat(process.env.LLM_INPUT_COST_PER_MILLION) : null;
  const envOutputCost = process.env.LLM_OUTPUT_COST_PER_MILLION ? parseFloat(process.env.LLM_OUTPUT_COST_PER_MILLION) : null;

  if (envInputCost !== null && envOutputCost !== null && !isNaN(envInputCost) && !isNaN(envOutputCost)) {
    return {
      inputCostPerMillion: envInputCost,
      outputCostPerMillion: envOutputCost
    };
  }

  const modelKey = modelName.toLowerCase();
  const pricing = MODEL_PRICING[modelKey] || MODEL_PRICING.default;

  return {
    inputCostPerMillion: pricing.inputCostPerMillion,
    outputCostPerMillion: pricing.outputCostPerMillion
  };
};
