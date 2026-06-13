import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';
import { MongoUserInboxRepository } from '../mongo/repositories/mongo-user-inbox.repository.js';
import { EncryptionService } from '../services/encryption.service.js';

const QUEUES = {
  jobCreated: 'job.created',
  credentialsUpdated: 'user.email.credentials.updated',
} as const;

type JobCreatedPayload = {
  userId: string;
  jobId: string;
  company: string;
  role: string;
};
type CredentialsUpdatedPayload = {
  userId: string;
  email: string;
  password: string;
};

@Injectable()
export class InboxRabbitmqConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(InboxRabbitmqConsumer.name);
  private connection!: amqp.ChannelModel;
  private channel!: amqp.Channel;

  constructor(
    private readonly configService: ConfigService,
    private readonly userInboxRepo: MongoUserInboxRepository,
    private readonly encryptionService: EncryptionService,
  ) {}

  async onModuleInit(): Promise<void> {
    const url = this.configService.getOrThrow<string>('RABBITMQ_URL');
    this.logger.log(`Connecting to RabbitMQ at ${url}`);
    this.connection = await amqp.connect(url);
    this.channel = await this.connection.createChannel();

    for (const queue of Object.values(QUEUES)) {
      await this.channel.assertQueue(queue, { durable: true });
    }

    this.logger.log(
      `Subscribed to queues: ${Object.values(QUEUES).join(', ')}`,
    );

    await this.channel.consume(QUEUES.jobCreated, (msg) => {
      if (!msg) return;
      void (async () => {
        try {
          const payload = JSON.parse(
            msg.content.toString(),
          ) as JobCreatedPayload;
          const { userId, ...job } = payload;
          await this.userInboxRepo.addJob(userId, job);
          this.channel.ack(msg);
          this.logger.log(
            `[job.created] jobId=${job.jobId} processed for userId=${userId}`,
          );
        } catch (err) {
          this.logger.error('[job.created] Failed to process message', err);
          this.channel.nack(msg, false, false);
        }
      })();
    });

    await this.channel.consume(QUEUES.credentialsUpdated, (msg) => {
      if (!msg) return;
      void (async () => {
        try {
          const payload = JSON.parse(
            msg.content.toString(),
          ) as CredentialsUpdatedPayload;
          const encryptedPassword = this.encryptionService.encrypt(
            payload.password,
          );
          await this.userInboxRepo.upsertCredentials(
            payload.userId,
            payload.email,
            encryptedPassword,
          );
          this.channel.ack(msg);
          this.logger.log(`[credentials.updated] userId=${payload.userId}`);
        } catch (err) {
          this.logger.error(
            '[credentials.updated] Failed to process message',
            err,
          );
          this.channel.nack(msg, false, false);
        }
      })();
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.channel?.close();
    await this.connection?.close();
  }
}
