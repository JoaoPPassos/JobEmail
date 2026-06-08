import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserInboxDoc = HydratedDocument<UserInboxEntity>;

@Schema({ collection: 'user_inboxes' })
export class UserInboxEntity {
  @Prop({ required: true, unique: true })
  userId: string;

  @Prop({ required: true })
  email: string;

  @Prop({ required: true })
  encryptedPassword: string;

  @Prop({
    type: [
      {
        jobId: String,
        company: String,
        role: String,
        status: { type: String, default: 'applied' },
        lastStatusChangedAt: { type: Date, default: Date.now },
      },
    ],
    default: [],
  })
  jobs: Array<{
    jobId: string;
    company: string;
    role: string;
    status: string;
    lastStatusChangedAt: Date;
  }>;
}

export const UserInboxSchema = SchemaFactory.createForClass(UserInboxEntity);
