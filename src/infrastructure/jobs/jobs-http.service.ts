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
    await axios.patch(url, data);
    this.logger.log(`Job ${jobId} metadata updated with status: ${data.status}`);
  }
}
