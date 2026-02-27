import { Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';
import { Channel, OnInboundMessage, OnChatMetadata, RegisteredGroup, NewMessage } from '../types.js';
import { logger } from '../logger.js';

export interface TelegramChannelOpts {
  onMessage: OnInboundMessage;
  onChatMetadata: OnChatMetadata;
  registeredGroups: () => Record<string, RegisteredGroup>;
  token: string;
}

export class TelegramChannel implements Channel {
  name = 'telegram';
  type = 'telegram';
  private bot: Telegraf;
  private connected = false;
  private opts: TelegramChannelOpts;

  constructor(opts: TelegramChannelOpts) {
    this.opts = opts;
    this.bot = new Telegraf(opts.token);
  }

  async connect(): Promise<void> {
    this.bot.on(message('text'), async (ctx) => {
      const chatJid = ctx.chat.id.toString();
      const isGroup = ctx.chat.type === 'group' || ctx.chat.type === 'supergroup';
      const timestamp = new Date().toISOString();

      this.opts.onChatMetadata(chatJid, timestamp, (ctx.chat as any).title || ctx.from.first_name, 'telegram', isGroup);

      const groups = this.opts.registeredGroups();
      const chatKey = `${chatJid}|telegram`;

      if (groups[chatKey]) {
        const msg: NewMessage = {
          id: ctx.message.message_id.toString(),
          chat_jid: chatJid,
          channel: 'telegram',
          sender: ctx.from.id.toString(),
          sender_name: ctx.from.first_name,
          content: ctx.message.text,
          timestamp,
          is_from_me: false,
        };
        this.opts.onMessage(chatJid, msg);
      }
    });

    this.bot.launch();
    this.connected = true;
    logger.info('Connected to Telegram');
  }

  async sendMessage(jid: string, text: string): Promise<void> {
    await this.bot.telegram.sendMessage(jid, text);
  }

  isConnected(): boolean {
    return this.connected;
  }

  ownsJid(jid: string): boolean {
    // Telegram IDs are typically numeric strings
    return /^-?\d+$/.test(jid);
  }

  async disconnect(): Promise<void> {
    this.bot.stop();
    this.connected = false;
  }

  async setTyping(jid: string, isTyping: boolean): Promise<void> {
    if (isTyping) {
      await this.bot.telegram.sendChatAction(jid, 'typing');
    }
  }
}
