import type { SessionTokenUsage, StdinData } from './types.js';
type Currency = 'USD' | 'CNY';
export interface SessionCostEstimate {
    totalCost: number;
    inputCost: number;
    cacheCreationCost: number;
    cacheReadCost: number;
    outputCost: number;
    currency: Currency;
}
export interface SessionCostDisplay {
    totalCost: number;
    currency: Currency;
    source: 'native' | 'estimate';
}
export declare function estimateSessionCost(stdin: StdinData, sessionTokens: SessionTokenUsage | undefined): SessionCostEstimate | null;
export declare function resolveSessionCost(stdin: StdinData, sessionTokens: SessionTokenUsage | undefined): SessionCostDisplay | null;
export declare function formatCost(amount: number, currency: Currency): string;
/** @deprecated Use formatCost instead */
export declare function formatUsd(amount: number): string;
export {};
//# sourceMappingURL=cost.d.ts.map