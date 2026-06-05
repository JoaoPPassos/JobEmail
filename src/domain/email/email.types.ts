export type SendEmail = {
  html: string;
  to: string;
  subject: string;
};

export type JobStatusMessage = {
  userId: string;
  jobId: string;
  status: string;
  email: string;
};

export type JobDataProcessed = {
  status: string;
};
