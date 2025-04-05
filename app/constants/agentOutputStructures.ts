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
  type: 'email',
  description: "Access email data from the Gmail Reader agent",
  fields: [
    {
      name: "messages",
      type: "array",
      description: "Array of email messages retrieved from Gmail",
      required: true
    },
    {
      name: "emailBody",
      type: "string",
      description: "Body content of the first email message",
      required: true
    },
    {
      name: "emailSubject",
      type: "string",
      description: "Subject line of the first email message",
      required: true
    },
    {
      name: "emailFrom",
      type: "string",
      description: "Sender of the first email message",
      required: true
    },
    {
      name: "emailTo",
      type: "string",
      description: "Recipient of the first email message",
      required: true
    },
    {
      name: "emailDate",
      type: "string",
      description: "Date the first email was sent",
      required: true
    },
    {
      name: "email",
      type: "string",
      description: "Formatted representation of the first email including headers and body",
      required: true
    }
  ]
};

// Discord Messenger output structure
export const discordMessengerOutputStructure: AgentOutputStructure = {
  type: 'discord',
  description: "Access data from the Discord Messenger agent",
  fields: [
    {
      name: "success",
      type: "boolean",
      description: "Whether the message was sent successfully",
      required: true
    },
    {
      name: "messageId",
      type: "string",
      description: "ID of the sent Discord message",
      required: false
    },
    {
      name: "timestamp",
      type: "string",
      description: "Timestamp when the message was sent",
      required: true
    }
  ]
};