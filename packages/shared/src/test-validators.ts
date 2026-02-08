import { emailAttachmentSchema } from './types/email';
import { emailSendSchema } from './validators';

console.log('Testing Email Attachment Schema Validations\n');
console.log('='.repeat(60));

// Test 1: Valid attachment schema
console.log('\n1. Testing emailAttachmentSchema with valid data:');
const validAttachment = {
  filename: 'document.pdf',
  contentType: 'application/pdf',
  size: 1024,
  content: 'SGVsbG8gV29ybGQ=', // base64 encoded "Hello World"
};
try {
  const result = emailAttachmentSchema.parse(validAttachment);
  console.log('✓ Valid attachment parsed successfully:', result);
} catch (error) {
  console.log('✗ Failed to parse valid attachment:', error);
}

// Test 2: Invalid attachment (missing filename)
console.log('\n2. Testing emailAttachmentSchema with missing filename:');
const invalidAttachment1 = {
  contentType: 'application/pdf',
  size: 1024,
  content: 'SGVsbG8gV29ybGQ=',
};
try {
  emailAttachmentSchema.parse(invalidAttachment1);
  console.log('✗ Should have failed validation');
} catch (error) {
  console.log('✓ Correctly rejected missing filename');
}

// Test 3: Invalid attachment (negative size)
console.log('\n3. Testing emailAttachmentSchema with negative size:');
const invalidAttachment2 = {
  filename: 'document.pdf',
  contentType: 'application/pdf',
  size: -100,
  content: 'SGVsbG8gV29ybGQ=',
};
try {
  emailAttachmentSchema.parse(invalidAttachment2);
  console.log('✗ Should have failed validation');
} catch (error) {
  console.log('✓ Correctly rejected negative size');
}

// Test 4: emailSendSchema with valid attachments
console.log('\n4. Testing emailSendSchema with valid attachments:');
const validEmailWithAttachments = {
  from: 'sender@example.com',
  to: ['recipient@example.com'],
  subject: 'Email with attachments',
  body: 'This email has attachments',
  attachments: [
    {
      filename: 'document.pdf',
      contentType: 'application/pdf',
      size: 1024,
      content: 'SGVsbG8gV29ybGQ=',
    },
    {
      filename: 'image.png',
      contentType: 'image/png',
      size: 2048,
      content: 'aGVsbG8=',
    },
  ],
};
try {
  const result = emailSendSchema.parse(validEmailWithAttachments);
  console.log('✓ Valid email with attachments parsed successfully');
  console.log('  Attachments count:', result.attachments?.length);
} catch (error) {
  console.log('✗ Failed to parse valid email:', error);
}

// Test 5: emailSendSchema with empty attachments array (should fail)
console.log('\n5. Testing emailSendSchema with empty attachments array:');
const emailWithEmptyAttachments = {
  from: 'sender@example.com',
  to: ['recipient@example.com'],
  subject: 'Email with empty attachments',
  body: 'This email has an empty attachments array',
  attachments: [],
};
try {
  emailSendSchema.parse(emailWithEmptyAttachments);
  console.log('✗ Should have failed validation');
} catch (error) {
  console.log('✓ Correctly rejected empty attachments array');
}

// Test 6: emailSendSchema without attachments field (should pass)
console.log('\n6. Testing emailSendSchema without attachments field:');
const emailWithoutAttachments = {
  from: 'sender@example.com',
  to: ['recipient@example.com'],
  subject: 'Email without attachments',
  body: 'This email has no attachments',
};
try {
  const result = emailSendSchema.parse(emailWithoutAttachments);
  console.log('✓ Valid email without attachments parsed successfully');
  console.log('  Attachments:', result.attachments);
} catch (error) {
  console.log('✗ Failed to parse valid email:', error);
}

// Test 7: emailSendSchema with invalid attachment in array
console.log('\n7. Testing emailSendSchema with invalid attachment in array:');
const emailWithInvalidAttachment = {
  from: 'sender@example.com',
  to: ['recipient@example.com'],
  subject: 'Email with invalid attachment',
  body: 'This email has an invalid attachment',
  attachments: [
    {
      filename: 'document.pdf',
      contentType: 'application/pdf',
      size: 1024,
      content: 'SGVsbG8gV29ybGQ=',
    },
    {
      filename: '',
      contentType: 'image/png',
      size: 2048,
      content: 'aGVsbG8=',
    },
  ],
};
try {
  emailSendSchema.parse(emailWithInvalidAttachment);
  console.log('✗ Should have failed validation');
} catch (error) {
  console.log('✓ Correctly rejected invalid attachment in array');
}

console.log('\n' + '='.repeat(60));
console.log('All tests completed!\n');
