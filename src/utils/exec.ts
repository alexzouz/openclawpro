import { execSync } from 'node:child_process';
import ora from 'ora';

export function run(cmd: string, options?: { cwd?: string; env?: Record<string, string> }): string {
  return execSync(cmd, {
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: options?.cwd,
    env: { ...process.env, ...options?.env },
  }).trim();
}

export function runSafe(cmd: string): string | null {
  try {
    return run(cmd);
  } catch {
    return null;
  }
}

export function runInteractive(cmd: string, options?: { cwd?: string; env?: Record<string, string> }): void {
  execSync(cmd, {
    stdio: 'inherit',
    cwd: options?.cwd,
    env: { ...process.env, ...options?.env },
  });
}

export async function runWithSpinner(label: string, cmd: string): Promise<string> {
  const spinner = ora(label).start();
  try {
    const result = run(cmd);
    spinner.succeed();
    return result;
  } catch (error) {
    spinner.fail();
    throw error;
  }
}

export function commandExists(cmd: string): boolean {
  return runSafe(`command -v ${cmd}`) !== null;
}

export function runCapture(cmd: string): string[] {
  const output = runSafe(cmd);
  if (!output) return [];
  return output.split('\n').filter(Boolean);
}
