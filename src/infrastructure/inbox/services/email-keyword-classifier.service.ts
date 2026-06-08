import { Injectable, Logger } from '@nestjs/common';
import { ApplicationStatus } from '../../../domain/email/application-status.enum.js';

const KEYWORD_MAP: Array<{ keywords: string[]; status: ApplicationStatus }> = [
  {
    keywords: ['interview', 'meet', 'schedule a call', 'phone screen', 'video call'],
    status: ApplicationStatus.interview,
  },
  {
    keywords: ['offer', 'congratulations', 'pleased to inform', 'we would like to extend'],
    status: ApplicationStatus.offer,
  },
  {
    keywords: ['rejected', 'rejection', 'unfortunately', 'regret to inform', 'not moving forward', 'decided to pursue other'],
    status: ApplicationStatus.rejected,
  },
  {
    keywords: ['withdrawn', 'withdraw'],
    status: ApplicationStatus.withdrawn,
  },
  {
    keywords: ['reviewing', 'in review', 'under review', 'being reviewed', 'application received'],
    status: ApplicationStatus.in_review,
  },
];

@Injectable()
export class EmailKeywordClassifier {
  private readonly logger = new Logger(EmailKeywordClassifier.name);

  classify(subject: string, body: string): ApplicationStatus | null {
    const text = `${subject} ${body}`.toLowerCase();
    for (const { keywords, status } of KEYWORD_MAP) {
      const matched = keywords.find((kw) => text.includes(kw));
      if (matched) {
        this.logger.log(`[classify] Keyword "${matched}" → status="${status}" (subject="${subject}")`);
        return status;
      }
    }
    this.logger.log(`[classify] No keyword matched — subject="${subject}"`);
    return null;
  }
}
