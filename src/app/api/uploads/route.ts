import { handleImageUploadRequest } from '@/composition/services';

// The browser's upload client asks here for each photo's presigned URL, then uploads it to Blob.
export const POST = handleImageUploadRequest;
