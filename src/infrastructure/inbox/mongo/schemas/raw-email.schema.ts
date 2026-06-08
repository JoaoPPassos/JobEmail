import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type RawEmailDoc = HydratedDocument<RawEmailEntity>;

@Schema({ collection: 'raw_emails' })
export class RawEmailEntity {
  @Prop({ required: true })
  userId!: string;

  @Prop({ required: true })
  uid!: string;

  @Prop()
  from!: string;

  @Prop()
  subject!: string;

  @Prop()
  body!: string;

  @Prop({ required: true })
  fetchedAt!: Date;
}

export const RawEmailSchema = SchemaFactory.createForClass(RawEmailEntity);
