import net from 'node:net';
import readline from 'node:readline';
import {
  Channel,
  OnInboundMessage,
  OnChatMetadata,
  RegisteredGroup,
  NewMessage,
} from '../types.js';
import { logger } from '../logger.js';

export interface SignalChannelOpts {
  onMessage: OnInboundMessage;
  onChatMetadata: OnChatMetadata;
  registeredGroups: () => Record<string, RegisteredGroup>;
  port?: number;
  host?: string;
}

export class SignalChannel implements Channel {
  name = 'signal';
  type = 'signal';
  private opts: SignalChannelOpts;
  private socket: net.Socket | null = null;
  private rl: readline.Interface | null = null;
  private pendingRequests = new Map<
    string,
    { resolve: (val: any) => void; reject: (err: any) => void }
  >();
  private requestId = 0;
  private connected = false;

  constructor(opts: SignalChannelOpts) {
    this.opts = opts;
  }

  async connect(): Promise<void> {
    const port = this.opts.port || 7583;
    const host = this.opts.host || '127.0.0.1';

    return new Promise((resolve, reject) => {
      this.socket = net.connect(port, host, () => {
        logger.info({ port, host }, 'Connected to signal-cli daemon');
        this.connected = true;
        resolve();
      });

      this.rl = readline.createInterface({ input: this.socket });
      this.rl.on('line', (line) => this.handleLine(line));

      this.socket.on('error', (err) => {
        logger.error({ err }, 'Signal socket error');
        if (!this.connected) reject(err);
      });

      this.socket.on('close', () => {
        this.connected = false;
        logger.warn('Signal daemon connection closed');
      });
    });
  }

  private handleLine(line: string) {
    try {
      const data = JSON.parse(line);

      // Handle notifications (incoming messages)
      if (data.method === 'receive') {
        this.handleInboundEnvelope(data.params.envelope);
        return;
      }

      // Handle response to requests
      if (data.id && this.pendingRequests.has(data.id)) {
        const { resolve, reject } = this.pendingRequests.get(data.id)!;
        this.pendingRequests.delete(data.id);
        if (data.error) {
          reject(data.error);
        } else {
          resolve(data.result);
        }
      }
    } catch (err) {
      logger.error({ err, line }, 'Failed to parse Signal JSON-RPC line');
    }
  }

  private handleInboundEnvelope(envelope: any) {
    const sender = envelope.sourceNumber || envelope.sourceUuid;
    const message = envelope.dataMessage;
    if (!message || !message.message) return;

    // Determine if it's a group or direct message
    const chatJid = message.groupInfo ? message.groupInfo.groupId : sender;
    const isGroup = !!message.groupInfo;
    const timestamp = new Date().toISOString();

    // Signal-cli doesn't always provide group names in the envelope
    // We might need to listGroups to fetch names if needed.
    this.opts.onChatMetadata(
      chatJid,
      timestamp,
      isGroup ? 'Signal Group' : sender,
      'signal',
      isGroup,
    );

    const groups = this.opts.registeredGroups();
    const chatKey = `${chatJid}|signal`;

    if (groups[chatKey]) {
      const msg: NewMessage = {
        id: envelope.timestamp.toString(),
        chat_jid: chatJid,
        channel: 'signal',
        sender,
        sender_name: sender,
        content: message.message,
        timestamp,
        is_from_me: false,
      };
      this.opts.onMessage(chatJid, msg);
    }
  }

  async request(method: string, params: any = {}): Promise<any> {
    if (!this.socket || !this.connected) {
      throw new Error('Signal channel not connected');
    }

    const id = `req-${++this.requestId}`;
    const payload = JSON.stringify({ jsonrpc: '2.0', method, params, id });

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.socket!.write(payload + '\n');
    });
  }

  async sendMessage(jid: string, text: string): Promise<void> {
    // Determine if recipient is a group (base64 ID) or a phone number
    const isGroup = jid.includes('=') || jid.length > 20; // Heuristic for group IDs in signal-cli

    const params: any = { message: text };
    if (isGroup) {
      params.groupId = jid;
    } else {
      params.recipient = [jid];
    }

    await this.request('send', params);
  }

  isConnected(): boolean {
    return this.connected;
  }

  ownsJid(jid: string): boolean {
    // Signal JIDs are either phone numbers (+...) or base64 group IDs
    return (
      jid.startsWith('+') ||
      jid.includes('=') ||
      /^[a-zA-Z0-9+/=]{20,}$/.test(jid)
    );
  }

  async disconnect(): Promise<void> {
    if (this.socket) {
      this.socket.destroy();
      this.connected = false;
    }
  }
}
