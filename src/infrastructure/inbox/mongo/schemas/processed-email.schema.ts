import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ProcessedEmailDoc = HydratedDocument<ProcessedEmailEntity>;

export type ProcessedEmailReason = 'updated' | 'no_keyword' | 'no_job_match';

@Schema({ collection: 'processed_emails' })
export class ProcessedEmailEntity {
  @Prop({ required: true, unique: true })
  uid: string;

  @Prop({ required: true })
  processedAt: Date;

  @Prop()
  from!: string;

  @Prop()
  subject!: string;

  @Prop({ type: String, default: null })
  status!: string | null;

  @Prop({ type: String, default: null })
  matchedJobId!: string | null;

  @Prop({ required: true })
  reason!: ProcessedEmailReason;
}

export const ProcessedEmailSchema = SchemaFactory.createForClass(ProcessedEmailEntity);
