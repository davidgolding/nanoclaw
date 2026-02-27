/**
 * Step: channel-config — Enable/disable and configure communication channels.
 */
import fs from 'fs';
import path from 'path';
import { logger } from '../src/logger.js';
import { emitStatus } from './status.js';

interface ChannelConfigArgs {
  channel: string;
  enabled: boolean;
  options?: Record<string, string>;
}

function parseArgs(args: string[]): ChannelConfigArgs {
  const result: ChannelConfigArgs = {
    channel: '',
    enabled: true,
    options: {},
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--channel':
        result.channel = args[++i] || '';
        break;
      case '--disable':
        result.enabled = false;
        break;
      case '--opt':
        const opt = args[++i] || '';
        const [key, value] = opt.split('=');
        if (key && value && result.options) {
          result.options[key] = value;
        }
        break;
    }
  }

  return result;
}

export async function run(args: string[]): Promise<void> {
  const projectRoot = process.cwd();
  const parsed = parseArgs(args);

  if (!parsed.channel) {
    emitStatus('CHANNEL_CONFIG', {
      STATUS: 'failed',
      ERROR: 'missing_channel_name',
    });
    process.exit(4);
  }

  const configDir = path.join(projectRoot, 'config', 'channels');
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  const configFile = path.join(configDir, `${parsed.channel}.json`);
  const config = {
    type: parsed.channel,
    enabled: parsed.enabled,
    options: parsed.options,
  };

  fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
  logger.info({ channel: parsed.channel, enabled: parsed.enabled }, 'Updated channel configuration');

  emitStatus('CHANNEL_CONFIG', {
    CHANNEL: parsed.channel,
    ENABLED: parsed.enabled,
    STATUS: 'success',
  });
}
