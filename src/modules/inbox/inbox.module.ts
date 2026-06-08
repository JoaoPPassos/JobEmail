import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { InboxScannerService } from './inbox-scanner.service.js';
import { ImapInboxService } from '../../infrastructure/inbox/services/imap-inbox.service.js';
import { EmailKeywordClassifier } from '../../infrastructure/inbox/services/email-keyword-classifier.service.js';
import { EncryptionService } from '../../infrastructure/inbox/services/encryption.service.js';
import { MongoUserInboxRepository } from '../../infrastructure/inbox/mongo/repositories/mongo-user-inbox.repository.js';
import { MongoProcessedEmailRepository } from '../../infrastructure/inbox/mongo/repositories/mongo-processed-email.repository.js';
import { MongoRawEmailRepository } from '../../infrastructure/inbox/mongo/repositories/mongo-raw-email.repository.js';
import { InboxRabbitmqConsumer } from '../../infrastructure/inbox/rabbitmq/inbox-rabbitmq.consumer.js';
import { JobsHttpService } from '../../infrastructure/jobs/jobs-http.service.js';
import { UserInboxEntity, UserInboxSchema } from '../../infrastructure/inbox/mongo/schemas/user-inbox.schema.js';
import { ProcessedEmailEntity, ProcessedEmailSchema } from '../../infrastructure/inbox/mongo/schemas/processed-email.schema.js';
import {
  RawEmailEntity,
  RawEmailSchema,
} from '../../infrastructure/inbox/mongo/schemas/raw-email.schema.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UserInboxEntity.name, schema: UserInboxSchema },
      { name: ProcessedEmailEntity.name, schema: ProcessedEmailSchema },
      { name: RawEmailEntity.name, schema: RawEmailSchema },
    ]),
  ],
  providers: [
    InboxScannerService,
    ImapInboxService,
    EmailKeywordClassifier,
    EncryptionService,
    MongoUserInboxRepository,
    MongoProcessedEmailRepository,
    MongoRawEmailRepository,
    InboxRabbitmqConsumer,
    JobsHttpService,
  ],
})
export class InboxModule {}
