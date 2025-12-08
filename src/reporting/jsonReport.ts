/**
 * Reporting layer: JSON output for frontend consumption
 */

import { PoolSummary } from "../types";

/**
 * Generate JSON report
 */
export function generateJSONReport(poolSummary: PoolSummary): string {
  return JSON.stringify(poolSummary, null, 2);
}

