import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { JobDataProcessed } from '../../domain/email/email.types.js';

@Injectable()
export class JobsHttpService {
  private readonly logger = new Logger(JobsHttpService.name);
  private readonly baseUrl: string;

  constructor(private configService: ConfigService) {
    const port = this.configService.get<string>('JOBS_API_PORT', '3000');
    this.baseUrl = `http://localhost:${port}`;
  }

  async updateJobMetadata(jobId: string, data: JobDataProcessed): Promise<void> {
    const url = `${this.baseUrl}/jobs/${jobId}/metadata`;
    this.logger.log(`[updateJobMetadata] PATCH ${url} — body=${JSON.stringify(data)}`);
    try {
      await axios.patch(url, data);
      this.logger.log(`[updateJobMetadata] Success — jobId=${jobId} status="${data.status}"`);
    } catch (err: any) {
      this.logger.error(`[updateJobMetadata] Failed — jobId=${jobId} status="${data.status}" error=${err?.message}`);
      throw err;
    }
  }
}
