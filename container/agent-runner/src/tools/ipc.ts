import fs from 'fs';
import path from 'path';

export const IPC_DIR = '/workspace/ipc';
export const MESSAGES_DIR = path.join(IPC_DIR, 'messages');
export const TASKS_DIR = path.join(IPC_DIR, 'tasks');

export function writeIpcFile(dir: string, data: object): string {
  fs.mkdirSync(dir, { recursive: true });

  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`;
  const filepath = path.join(dir, filename);

  // Atomic write: temp file then rename
  const tempPath = `${filepath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2));
  fs.renameSync(tempPath, filepath);

  return filename;
}
