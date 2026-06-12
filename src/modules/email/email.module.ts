import { Module } from '@nestjs/common';
import { EmailService } from './service/email.service';
import { NodemailerService } from '../../infrastructure/email/nodemailer.service.js';
import { JobsHttpService } from '../../infrastructure/jobs/jobs-http.service.js';
import { RabbitmqConsumer } from '../../infrastructure/rabbitmq/rabbitmq.consumer.js';
import { AuthEmailConsumer } from '../../infrastructure/rabbitmq/auth-email.consumer.js';

@Module({
  providers: [
    EmailService,
    NodemailerService,
    JobsHttpService,
    RabbitmqConsumer,
    AuthEmailConsumer,
  ],
  exports: [EmailService],
})
export class EmailModule {}
