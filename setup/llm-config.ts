/**
 * Step: llm-config — Configure LLM providers and API keys.
 */
import fs from 'fs';
import path from 'path';
import { logger } from '../src/logger.js';
import { emitStatus } from './status.js';

interface LlmConfigArgs {
  provider: 'claude' | 'openai' | 'gemini';
  apiKey: string;
  model?: string;
}

function parseArgs(args: string[]): LlmConfigArgs {
  const result: LlmConfigArgs = {
    provider: 'claude',
    apiKey: '',
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--provider':
        result.provider = (args[++i] as any) || 'claude';
        break;
      case '--key':
        result.apiKey = args[++i] || '';
        break;
      case '--model':
        result.model = args[++i];
        break;
    }
  }

  return result;
}

export async function run(args: string[]): Promise<void> {
  const projectRoot = process.cwd();
  const parsed = parseArgs(args);

  if (!parsed.apiKey) {
    emitStatus('LLM_CONFIG', {
      STATUS: 'failed',
      ERROR: 'missing_api_key',
    });
    process.exit(4);
  }

  const envFile = path.join(projectRoot, '.env');
  let envContent = '';
  if (fs.existsSync(envFile)) {
    envContent = fs.readFileSync(envFile, 'utf-8');
  }

  const keyMap = {
    claude: 'ANTHROPIC_API_KEY',
    openai: 'OPENAI_API_KEY',
    gemini: 'GEMINI_API_KEY',
  };

  const envKey = keyMap[parsed.provider];
  const newEntry = `${envKey}="${parsed.apiKey}"`;

  if (envContent.includes(`${envKey}=`)) {
    const regex = new RegExp(`^${envKey}=.*$`, 'm');
    envContent = envContent.replace(regex, newEntry);
  } else {
    envContent += (envContent.endsWith('
') ? '' : '
') + newEntry + '
';
  }

  if (parsed.model) {
    const modelKey = `DEFAULT_${parsed.provider.toUpperCase()}_MODEL`;
    const modelEntry = `${modelKey}="${parsed.model}"`;
    if (envContent.includes(`${modelKey}=`)) {
      const regex = new RegExp(`^${modelKey}=.*$`, 'm');
      envContent = envContent.replace(regex, modelEntry);
    } else {
      envContent += (envContent.endsWith('
') ? '' : '
') + modelEntry + '
';
    }
  }

  fs.writeFileSync(envFile, envContent);
  logger.info({ provider: parsed.provider }, 'Updated LLM configuration in .env');

  emitStatus('LLM_CONFIG', {
    PROVIDER: parsed.provider,
    MODEL: parsed.model || 'default',
    STATUS: 'success',
  });
}
