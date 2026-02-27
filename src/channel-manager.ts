import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { logger } from './logger.js';
import { Channel, OnInboundMessage, OnChatMetadata, RegisteredGroup } from './types.js';
import { WhatsAppChannel } from './channels/whatsapp.js';
import { TelegramChannel } from './channels/telegram.js';
import { SignalChannel } from './channels/signal.js';

const ChannelConfigSchema = z.object({
  type: z.string(),
  enabled: z.boolean(),
  options: z.record(z.any()).optional(),
});

export type ChannelConfig = z.infer<typeof ChannelConfigSchema>;

export class ChannelManager {
  private channels: Map<string, Channel> = new Map();
  private configDir: string;

  constructor(configDir: string = path.join(process.cwd(), 'config', 'channels')) {
    this.configDir = configDir;
  }

  async loadChannels(opts: {
    onMessage: OnInboundMessage;
    onChatMetadata: OnChatMetadata;
    registeredGroups: () => Record<string, RegisteredGroup>;
  }): Promise<Channel[]> {
    if (!fs.existsSync(this.configDir)) {
      logger.info({ configDir: this.configDir }, 'Config directory not found, creating it');
      fs.mkdirSync(this.configDir, { recursive: true });
      
      // Create default WhatsApp config if it doesn't exist
      const defaultWA: ChannelConfig = { type: 'whatsapp', enabled: true };
      fs.writeFileSync(path.join(this.configDir, 'whatsapp.json'), JSON.stringify(defaultWA, null, 2));
    }

    const files = fs.readdirSync(this.configDir).filter(f => f.endsWith('.json'));
    
    for (const file of files) {
      try {
        const rawConfig = JSON.parse(fs.readFileSync(path.join(this.configDir, file), 'utf-8'));
        const config = ChannelConfigSchema.parse(rawConfig);
        if (!config.enabled) continue;

        let channel: Channel | undefined;
        switch (config.type) {
          case 'whatsapp':
            channel = new WhatsAppChannel(opts);
            break;
          case 'telegram':
            channel = new TelegramChannel({ ...opts, token: config.options?.token });
            break;
          case 'signal':
            channel = new SignalChannel({
              ...opts,
              port: config.options?.port ? parseInt(config.options.port) : undefined,
              host: config.options?.host,
            });
            break;
          default:
            logger.warn({ type: config.type }, 'Unknown channel type');
        }

        if (channel) {
          this.channels.set(config.type, channel);
          logger.info({ type: config.type }, 'Channel loaded');
        }
      } catch (err) {
        logger.error({ file, err }, 'Failed to load channel config');
      }
    }

    // Fallback: if no configs found, always try to load WhatsApp if it's the only one
    if (this.channels.size === 0) {
      logger.info('No channels configured, falling back to default WhatsApp');
      const wa = new WhatsAppChannel(opts);
      this.channels.set('whatsapp', wa);
    }

    return Array.from(this.channels.values());
  }

  getChannel(type: string): Channel | undefined {
    return this.channels.get(type);
  }

  getAllChannels(): Channel[] {
    return Array.from(this.channels.values());
  }

  async connectAll(): Promise<void> {
    for (const channel of this.channels.values()) {
      try {
        await channel.connect();
      } catch (err) {
        logger.error({ channel: channel.name, err }, 'Failed to connect channel');
      }
    }
  }

  async disconnectAll(): Promise<void> {
    for (const channel of this.channels.values()) {
      await channel.disconnect();
    }
  }
}
