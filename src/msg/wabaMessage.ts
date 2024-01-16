// interface Message {
//     type: string; // text, image, audio, document, template, hsm, etc.
//     to: string; // ID of the WhatsApp recipient
//     ttl?: string; // Time to Live (optional)
//     recipient_type?: string; // Optional: individual
//     template?: Template; // Required for template messages
//     hsm?: HSM; // Required for HSM (Highly Structured Messages)
  
//     // Other optional parameters
//     caption?: string; // Media asset caption
//     filename?: string; // Filename for document media
//     provider?: string; // Provider for media when link is not directly accessible
  
//     // ... other parameters
  
//     // Object for contacts
//     contacts?: Contact[];
  
//     // Object for location
//     location?: Location;
  
//     // Object for interactive messages
//     interactive?: Interactive;
  
//     // ... other fields
//   }
  
//   interface Template {
//     namespace: string;
//     name: string;
//     language: string;
//     components?: Component[];
//   }
  
//   interface HSM {
//     namespace: string;
//     element_name: string;
//     language: string;
//     localizable_params: string[];
//   }
  
//   interface Contact {
//     addresses?: Address[];
//     birthday?: string;
//     emails?: Email[];
//     name: {
//       formatted_name: string;
//       first_name?: string;
//       last_name?: string;
//       middle_name?: string;
//       suffix?: string;
//       prefix?: string;
//     };
//     org?: Organization;
//     phones?: Phone[];
//     urls?: URL[];
//   }
  
//   interface Address {
//     street?: string;
//     city?: string;
//     state?: string;
//     zip?: string;
//     country?: string;
//     country_code?: string;
//     type?: string;
//   }
  
//   interface Email {
//     email: string;
//     type?: string;
//   }
  
//   interface Organization {
//     company?: string;
//     department?: string;
//     title?: string;
//   }
  
//   interface Phone {
//     phone: string;
//     type?: string;
//     wa_id?: string;
//   }
  
//   interface URL {
//     url: string;
//     type?: string;
//   }
  
//   interface Location {
//     longitude: string;
//     latitude: string;
//     name: string;
//     address: string;
//   }
  
//   interface Interactive {
//     type: string; // list, button, product, product_list, catalog_message, flow
//     header?: Header;
//     body?: { text: string }; // Object with the body of the message
//     footer?: { text: string }; // Object with the footer of the message
//     action: Action;
//   }
  
//   interface Header {
//     text?: string; // Text for the header
//     type: string; // text, video, image, document
//     // ... other fields
//   }
  
//   interface Action {
//     button?: string; // Button content for List Messages
//     buttons?: Button[]; // Button object for Reply Button Messages
//     sections?: Section[]; // Array of section objects for List Messages and Multi-Product Messages
//     catalog_id?: string; // Required for Single-Product Messages and Multi-Product Messages
//     // ... other fields
//   }
  
//   interface Button {
//     sub_type: string; // quick_reply, url, copy_code
//     index: number; // Index of the button
//     parameters: { type: string; payload?: string; text?: string; coupon_code?: string }[];
//   }
  
//   interface Section {
//     title: string;
//     rows?: Row[];
//     product_items?: Product[];
//   }
  
//   interface Row {
//     title: string;
//     ID: string;
//     description?: string;
//   }
  
//   interface Product {
//     product_retailer_id: string;
//     // ... other fields
//   }
  
//   // Add other interfaces as needed for your specific use case
  