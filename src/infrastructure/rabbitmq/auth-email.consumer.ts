import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';
import { EmailService } from '../../modules/email/service/email.service.js';
import { SendEmail } from '../../domain/email/email.types.js';

const QUEUE_NAME = 'auth.email';

@Injectable()
export class AuthEmailConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AuthEmailConsumer.name);
  private connection: amqp.ChannelModel;
  private channel: amqp.Channel;

  constructor(
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  async onModuleInit(): Promise<void> {
    const url = this.configService.getOrThrow<string>('RABBITMQ_URL');
    this.connection = await amqp.connect(url);
    this.channel = await this.connection.createChannel();
    await this.channel.assertQueue(QUEUE_NAME, { durable: true });

    this.logger.log(`Subscribed to queue: ${QUEUE_NAME}`);

    await this.channel.consume(QUEUE_NAME, async (msg) => {
      if (!msg) return;
      try {
        const payload: SendEmail = JSON.parse(msg.content.toString());
        await this.emailService.sendEmail(payload);
        this.channel.ack(msg);
        this.logger.log(`Auth email sent to ${payload.to}`);
      } catch (err) {
        this.logger.error('Failed to send auth email', err);
        this.channel.nack(msg, false, false);
      }
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.channel?.close();
    await this.connection?.close();
  }
}
