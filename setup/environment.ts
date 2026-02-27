/**
 * Step: environment — Detect OS, Node, container runtimes, existing config.
 * Replaces 01-check-environment.sh
 */
import fs from 'fs';
import path from 'path';

import Database from 'better-sqlite3';

import { STORE_DIR } from '../src/config.js';
import { logger } from '../src/logger.js';
import { commandExists, getPlatform, isHeadless, isWSL } from './platform.js';
import { emitStatus } from './status.js';

export async function run(_args: string[]): Promise<void> {
  const projectRoot = process.cwd();

  logger.info('Starting environment check');

  const platform = getPlatform();
  const wsl = isWSL();
  const headless = isHeadless();

  // Check Apple Container
  let appleContainer: 'installed' | 'not_found' = 'not_found';
  if (commandExists('container')) {
    appleContainer = 'installed';
  }

  // Check Docker
  let docker: 'running' | 'installed_not_running' | 'not_found' = 'not_found';
  if (commandExists('docker')) {
    try {
      const { execSync } = await import('child_process');
      execSync('docker info', { stdio: 'ignore' });
      docker = 'running';
    } catch {
      docker = 'installed_not_running';
    }
  }

  // Check existing config
  const hasEnv = fs.existsSync(path.join(projectRoot, '.env'));
  let hasClaudeKey = false;
  let hasOpenAIKey = false;
  let hasGeminiKey = false;

  if (hasEnv) {
    const envContent = fs.readFileSync(path.join(projectRoot, '.env'), 'utf-8');
    hasClaudeKey = envContent.includes('ANTHROPIC_API_KEY=');
    hasOpenAIKey = envContent.includes('OPENAI_API_KEY=');
    hasGeminiKey = envContent.includes('GEMINI_API_KEY=');
  }

  const channelsDir = path.join(projectRoot, 'config', 'channels');
  const enabledChannels: string[] = [];
  if (fs.existsSync(channelsDir)) {
    const files = fs.readdirSync(channelsDir).filter((f) => f.endsWith('.json'));
    for (const file of files) {
      try {
        const config = JSON.parse(
          fs.readFileSync(path.join(channelsDir, file), 'utf-8'),
        );
        if (config.enabled) enabledChannels.push(config.type);
      } catch {
        // Ignore bad config
      }
    }
  }

  const authDir = path.join(projectRoot, 'store', 'auth');
  const hasAuth = fs.existsSync(authDir) && fs.readdirSync(authDir).length > 0;

  let hasRegisteredGroups = false;
  // Check JSON file first (pre-migration)
  if (fs.existsSync(path.join(projectRoot, 'data', 'registered_groups.json'))) {
    hasRegisteredGroups = true;
  } else {
    // Check SQLite directly using better-sqlite3 (no sqlite3 CLI needed)
    const dbPath = path.join(STORE_DIR, 'messages.db');
    if (fs.existsSync(dbPath)) {
      try {
        const db = new Database(dbPath, { readonly: true });
        const row = db
          .prepare('SELECT COUNT(*) as count FROM registered_groups')
          .get() as { count: number };
        if (row.count > 0) hasRegisteredGroups = true;
        db.close();
      } catch {
        // Table might not exist yet
      }
    }
  }

  logger.info(
    {
      platform,
      wsl,
      appleContainer,
      docker,
      hasEnv,
      hasAuth,
      hasRegisteredGroups,
    },
    'Environment check complete',
  );

  emitStatus('CHECK_ENVIRONMENT', {
    PLATFORM: platform,
    IS_WSL: wsl,
    IS_HEADLESS: headless,
    APPLE_CONTAINER: appleContainer,
    DOCKER: docker,
    HAS_ENV: hasEnv,
    HAS_CLAUDE_KEY: hasClaudeKey,
    HAS_OPENAI_KEY: hasOpenAIKey,
    HAS_GEMINI_KEY: hasGeminiKey,
    ENABLED_CHANNELS: enabledChannels.join(','),
    HAS_AUTH: hasAuth,
    HAS_REGISTERED_GROUPS: hasRegisteredGroups,
    STATUS: 'success',
    LOG: 'logs/setup.log',
  });
}
