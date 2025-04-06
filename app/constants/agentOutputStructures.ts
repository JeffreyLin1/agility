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

export const githubReaderOutputStructure: AgentOutputStructure = {
  description: "Data from GitHub repository commits and changes.",
  fields: [
    {
      name: "repoName",
      type: "string",
      description: "The name of the GitHub repository in format 'owner/repo'",
      required: true
    },
    {
      name: "branch",
      type: "string",
      description: "The branch name that was monitored",
      required: true
    },
    {
      name: "commits",
      type: "array",
      description: "Array of commit objects with details about each commit",
      required: true
    },
    {
      name: "commits[].id",
      type: "string",
      description: "The commit SHA identifier",
      required: true
    },
    {
      name: "commits[].message",
      type: "string",
      description: "The commit message",
      required: true
    },
    {
      name: "commits[].author",
      type: "string",
      description: "The author of the commit",
      required: true
    },
    {
      name: "commits[].timestamp",
      type: "string",
      description: "The timestamp when the commit was made",
      required: true
    },
    {
      name: "commits[].url",
      type: "string",
      description: "URL to view the commit on GitHub",
      required: true
    },
    {
      name: "commits[].files",
      type: "array",
      description: "Array of files changed in the commit",
      required: false
    },
    {
      name: "commits[].files[].filename",
      type: "string",
      description: "Name of the file that was changed",
      required: false
    },
    {
      name: "commits[].files[].status",
      type: "string",
      description: "Status of the change (added, modified, removed)",
      required: false
    },
    {
      name: "commits[].files[].additions",
      type: "number",
      description: "Number of lines added",
      required: false
    },
    {
      name: "commits[].files[].deletions",
      type: "number",
      description: "Number of lines deleted",
      required: false
    },
    {
      name: "summary",
      type: "string",
      description: "A summary of the changes in the repository",
      required: false
    },
    {
      name: "pusher",
      type: "string",
      description: "The GitHub username of the person who pushed the changes",
      required: false
    }
  ]
}; 