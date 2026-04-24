import { getProviderLabel } from './stdin.js';
const TOKENS_PER_MILLION = 1_000_000;
function calc(tokens, pricePerMillion) {
    return (tokens * pricePerMillion) / TOKENS_PER_MILLION;
}
// Anthropic cache pricing: write = input × 1.25, read = input × 0.10
function anthropic(input, output) {
    return {
        inputPricePerMillion: input,
        outputPricePerMillion: output,
        cacheWritePricePerMillion: input * 1.25,
        cacheReadPricePerMillion: input * 0.10,
        currency: 'USD',
    };
}
// DeepSeek/Kimi cache pricing: only two tiers (hit/miss), no separate write premium.
// cache_creation is already billed as input (cache miss), so write price = 0.
function deepseekKimi(cacheMiss, cacheHit, output) {
    return {
        inputPricePerMillion: cacheMiss,
        outputPricePerMillion: output,
        cacheWritePricePerMillion: 0,
        cacheReadPricePerMillion: cacheHit,
        currency: 'CNY',
    };
}
const MODEL_PRICING = [
    // Anthropic
    { pattern: /\bopus 4(?:[.\s]\d+)?\b/i, pricing: anthropic(15, 75) },
    { pattern: /\bsonnet 4(?:[.\s]\d+)?\b/i, pricing: anthropic(3, 15) },
    { pattern: /\bsonnet 3[.\s]7\b/i, pricing: anthropic(3, 15) },
    { pattern: /\bsonnet 3[.\s]5\b/i, pricing: anthropic(3, 15) },
    { pattern: /\bhaiku 3[.\s]5\b/i, pricing: anthropic(0.8, 4) },
    // DeepSeek (cache miss = input, cache hit = read, write = miss)
    { pattern: /\bdeepseek[-\s]?v4[-\s]?pro\b/i, pricing: deepseekKimi(12, 1, 24) },
    { pattern: /\bdeepseek[-\s]?v4[-\s]?flash\b/i, pricing: deepseekKimi(1, 0.2, 2) },
    // Catch-all for any DeepSeek model variant
    { pattern: /\bdeepseek\b/i, pricing: deepseekKimi(12, 1, 24) },
    // Kimi (cache miss = input, cache hit = read, write = miss)
    { pattern: /\bkimi[-\s]?k?2[.\s]?6\b/i, pricing: deepseekKimi(6.5, 1.1, 27) },
    // MiniMax (explicit cache write pricing)
    { pattern: /\bminimax[-\s]?m?2[.\s]?7[-\s]?highspeed\b/i, pricing: { inputPricePerMillion: 4.2, outputPricePerMillion: 16.8, cacheWritePricePerMillion: 5.25, cacheReadPricePerMillion: 0.42, currency: 'CNY' } },
    { pattern: /\bminimax[-\s]?m?2[.\s]?7\b/i, pricing: { inputPricePerMillion: 2.1, outputPricePerMillion: 8.4, cacheWritePricePerMillion: 2.625, cacheReadPricePerMillion: 0.42, currency: 'CNY' } },
];
function normalizeModelName(modelName) {
    return modelName
        .toLowerCase()
        .replace(/^claude\s+/, '')
        .replace(/\([^)]*\)/g, ' ')
        .replace(/[._-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
function matchPricing(modelName) {
    const normalized = normalizeModelName(modelName);
    for (const entry of MODEL_PRICING) {
        if (entry.pattern.test(normalized)) {
            return entry.pricing;
        }
    }
    return null;
}
function getModelPricing(stdin) {
    const candidates = [
        stdin.model?.display_name?.trim(),
        stdin.model?.id?.trim(),
    ];
    for (const candidate of candidates) {
        if (!candidate)
            continue;
        const pricing = matchPricing(candidate);
        if (pricing)
            return pricing;
    }
    return null;
}
export function estimateSessionCost(stdin, sessionTokens) {
    if (!sessionTokens)
        return null;
    if (getProviderLabel(stdin))
        return null;
    const pricing = getModelPricing(stdin);
    if (!pricing)
        return null;
    const totalTokens = sessionTokens.inputTokens
        + sessionTokens.cacheCreationTokens
        + sessionTokens.cacheReadTokens
        + sessionTokens.outputTokens;
    if (totalTokens === 0)
        return null;
    const inputCost = calc(sessionTokens.inputTokens, pricing.inputPricePerMillion);
    const cacheCreationCost = calc(sessionTokens.cacheCreationTokens, pricing.cacheWritePricePerMillion);
    const cacheReadCost = calc(sessionTokens.cacheReadTokens, pricing.cacheReadPricePerMillion);
    const outputCost = calc(sessionTokens.outputTokens, pricing.outputPricePerMillion);
    return {
        totalCost: inputCost + cacheCreationCost + cacheReadCost + outputCost,
        inputCost,
        cacheCreationCost,
        cacheReadCost,
        outputCost,
        currency: pricing.currency,
    };
}
function getNativeCost(stdin) {
    const nativeCost = stdin.cost?.total_cost_usd;
    if (typeof nativeCost !== 'number' || !Number.isFinite(nativeCost))
        return null;
    if (getProviderLabel(stdin))
        return null;
    // For non-Anthropic models, total_cost_usd is Claude Code's estimate
    // using Anthropic pricing — skip it and use our model-specific estimate.
    const pricing = getModelPricing(stdin);
    if (pricing && pricing.currency !== 'USD')
        return null;
    return { totalCost: nativeCost, currency: 'USD' };
}
export function resolveSessionCost(stdin, sessionTokens) {
    const nativeCost = getNativeCost(stdin);
    if (nativeCost !== null) {
        return { totalCost: nativeCost.totalCost, currency: nativeCost.currency, source: 'native' };
    }
    const estimate = estimateSessionCost(stdin, sessionTokens);
    if (!estimate)
        return null;
    return {
        totalCost: estimate.totalCost,
        currency: estimate.currency,
        source: 'estimate',
    };
}
export function formatCost(amount, currency) {
    const symbol = currency === 'CNY' ? '\u00A5' : '$';
    if (amount >= 1)
        return `${symbol}${amount.toFixed(2)}`;
    if (amount >= 0.1)
        return `${symbol}${amount.toFixed(3)}`;
    return `${symbol}${amount.toFixed(4)}`;
}
/** @deprecated Use formatCost instead */
export function formatUsd(amount) {
    return formatCost(amount, 'USD');
}
//# sourceMappingURL=cost.js.map