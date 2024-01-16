// business-message.interface.ts
export interface BusinessMessage {
    // Basic message properties
    type: 'text' | 'image' | 'document' | 'template' | 'location'; // Adjust based on supported types
    recipient: {
      id: string;
    };
    // Adjust based on the message type
    text?: string;
    image?: {
      url: string;
    };
    document?: {
      url: string;
      filename: string;
    };
    location?: {
      latitude: number;
      longitude: number;
    };
    // Adjust based on the template type
    template?: {
      template_type: string;
      elements: any[]; // Adjust based on the template structure
    };
  
    // Additional properties based on your requirements
    // ...
  }
  