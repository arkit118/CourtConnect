import { supabase } from './supabase';

// Client-side downscale + re-encode before upload. Avatars in particular
// were reported as "slow to upload" - the actual bottleneck is almost
// always a multi-megabyte phone-camera photo being sent over the wire
// unmodified, not the Storage API itself. Capping the longest edge and
// re-encoding as JPEG at a reasonable quality typically takes a
// multi-MB photo down to a few hundred KB with no visible quality loss
// at avatar display sizes, which is a bigger win than anything that can
// be done on the network/server side. Falls back to the original file
// untouched if canvas decoding fails for any reason (e.g. an
// unsupported format) - never blocks the upload on this optimization.
export async function compressImageForUpload(
  file: File,
  maxDimension = 800,
  quality = 0.85
): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') {
    // Animated GIFs would lose their animation through a canvas re-encode.
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', quality)
    );
    if (!blob || blob.size >= file.size) return file;

    const newName = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], newName, { type: 'image/jpeg', lastModified: Date.now() });
  } catch (err) {
    console.error('[storage] Client-side image compression failed, uploading original file:', err);
    return file;
  }
}

export async function uploadImage(
  bucket: 'avatars' | 'event-images' | 'gear-images',
  file: File,
  userId: string
): Promise<string> {
  // Generate unique filename
  const fileExt = file.name.split('.').pop();
  const fileName = `${userId}/${Date.now()}.${fileExt}`;

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) {
    throw uploadError;
  }

  // Get public URL
  const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);

  return data.publicUrl;
}

export async function deleteImage(
  bucket: 'avatars' | 'event-images' | 'gear-images',
  url: string
): Promise<void> {
  // Extract filename from URL
  const urlParts = url.split('/');
  const bucketIndex = urlParts.findIndex(part => part === bucket);
  if (bucketIndex === -1) return;

  const filePath = urlParts.slice(bucketIndex + 1).join('/');

  await supabase.storage.from(bucket).remove([filePath]);
}

export function validateImageFile(file: File): { valid: boolean; error?: string } {
  const maxSize = 5 * 1024 * 1024; // 5MB
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: 'Please upload a JPEG, PNG, WebP, or GIF image' };
  }

  if (file.size > maxSize) {
    return { valid: false, error: 'Image must be less than 5MB' };
  }

  return { valid: true };
}
