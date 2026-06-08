import { ApplicationStatus } from '../email/application-status.enum.js';

export type WatchedJob = {
  jobId: string;
  company: string;
  role: string;
  status: ApplicationStatus;
  lastStatusChangedAt: Date;
};

export type UserInbox = {
  userId: string;
  email: string;
  encryptedPassword: string;
  jobs: WatchedJob[];
};

export type InboxEmail = {
  uid: number;
  subject: string;
  body: string;
  from: string;
};
