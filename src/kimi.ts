import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface KimiUsage {
  percent: number;           // 0-100
  used: number;              // used count
  total: number;             // total limit
  resetsAt: Date | null;     // reset timestamp
  daysRemaining: number;     // days until reset
}

/**
 * Fetch Kimi usage from codexbar CLI.
 * Returns null if codexbar is not installed or fails.
 */
export async function getKimiUsage(): Promise<KimiUsage | null> {
  try {
    const { stdout } = await execFileAsync("codexbar", [
      "usage",
      "--provider",
      "kimi",
      "--format",
      "json",
    ]);

    const data = JSON.parse(stdout);
    if (!Array.isArray(data) || data.length === 0) {
      return null;
    }

    const usage = data[0].usage?.primary;
    if (!usage) {
      return null;
    }

    const percent = usage.usedPercent ?? 0;
    const desc = usage.resetDescription ?? "0/0";
    const resetsAtStr = usage.resetsAt;

    // Parse "26/100 requests" format
    const [usedStr, rest] = desc.split("/");
    const totalStr = rest?.split(" ")[0] ?? "0";
    const used = parseInt(usedStr, 10) || 0;
    const total = parseInt(totalStr, 10) || 0;

    // Parse reset time
    let resetsAt: Date | null = null;
    let daysRemaining = 0;
    if (resetsAtStr) {
      resetsAt = new Date(resetsAtStr);
      const now = new Date();
      const diffMs = resetsAt.getTime() - now.getTime();
      daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    }

    return {
      percent,
      used,
      total,
      resetsAt,
      daysRemaining,
    };
  } catch {
    // codexbar not installed or failed - silently return null
    return null;
  }
}
