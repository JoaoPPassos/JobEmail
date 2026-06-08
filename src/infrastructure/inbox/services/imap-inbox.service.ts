import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { InboxEmail } from '../../../domain/inbox/inbox.types.js';

const IMAP_HOST_MAP: Record<string, string> = {
  'gmail.com': 'imap.gmail.com',
  'googlemail.com': 'imap.gmail.com',
  'outlook.com': 'imap-mail.outlook.com',
  'hotmail.com': 'imap-mail.outlook.com',
  'live.com': 'imap-mail.outlook.com',
  'yahoo.com': 'imap.mail.yahoo.com',
  'icloud.com': 'imap.mail.me.com',
  'me.com': 'imap.mail.me.com',
  'zoho.com': 'imap.zoho.com',
};

function stripHtml(html: string): string {
  return html
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function resolveImapHost(email: string): string {
  const domain = email.split('@')[1]?.toLowerCase() ?? '';
  return IMAP_HOST_MAP[domain] ?? `imap.${domain}`;
}

@Injectable()
export class ImapInboxService {
  private readonly logger = new Logger(ImapInboxService.name);

  constructor(private readonly configService: ConfigService) {}

  async fetchRecentEmails(
    email: string,
    password: string,
    lookbackMinutes: number,
  ): Promise<InboxEmail[]> {
    const host = resolveImapHost(email);
    const port = this.configService.get<number>('IMAP_PORT', 993);
    this.logger.log(`Connecting to ${host}:${port} for ${email}`);

    const client = new ImapFlow({
      host,
      port,
      secure: true,
      auth: { user: email, pass: password },
      logger: false,
    });

    await client.connect();

    const lock = await client.getMailboxLock('INBOX');
    const emails: InboxEmail[] = [];

    try {
      const since = new Date(Date.now() - lookbackMinutes * 60 * 1000);
      const result = await client.search({ since }, { uid: true });
      const uids = result === false ? [] : result;

      if (uids.length === 0) return emails;

      for await (const msg of client.fetch(
        uids,
        { envelope: true, source: true },
        { uid: true },
      )) {
        const subject = msg.envelope?.subject ?? '';
        const from = msg.envelope?.from?.[0]?.address ?? '';

        const parsed = await simpleParser(msg.source ?? Buffer.alloc(0));
        const body = parsed.text ?? (parsed.html ? stripHtml(parsed.html) : '');

        emails.push({ uid: msg.uid, subject, body, from });
      }
    } finally {
      lock.release();
      await client.logout();
    }

    return emails;
  }
}
