import { AgentOutputStructure } from '@/app/types';

// Text Generator output structure
export const textGeneratorOutputStructure: AgentOutputStructure = {
  type: 'text',
  description: 'Plain text output from the text generation model',
  fields: [
    {
      name: 'text',
      type: 'string',
      description: 'The generated text content',
      required: true
    }
  ]
};

// Gmail Reader output structure
export const gmailReaderOutputStructure: AgentOutputStructure = {
  type: 'email_messages',
  description: 'Email messages retrieved from Gmail',
  fields: [
    {
      name: 'messages',
      type: 'array',
      description: 'Array of email messages',
      required: true
    },
    {
      name: 'message.id',
      type: 'string',
      description: 'Unique identifier for the email',
      required: true
    },
    {
      name: 'message.threadId',
      type: 'string',
      description: 'Thread identifier for the email',
      required: true
    },
    {
      name: 'message.subject',
      type: 'string',
      description: 'Email subject line',
      required: true
    },
    {
      name: 'message.from',
      type: 'string',
      description: 'Sender email address',
      required: true
    },
    {
      name: 'message.date',
      type: 'string',
      description: 'Date the email was sent',
      required: true
    },
    {
      name: 'message.body',
      type: 'string',
      description: 'Email body content',
      required: true
    },
    {
      name: 'message.snippet',
      type: 'string',
      description: 'Short preview of the email content',
      required: true
    }
  ]
};