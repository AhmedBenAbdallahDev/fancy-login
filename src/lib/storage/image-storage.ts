// Image Storage Abstraction Layer
// Easily swap between Cloudinary, S3, Minio, etc.

import { v2 as cloudinary } from "cloudinary";

// ============================================================================
// TYPES
// ============================================================================

export interface UploadResult {
  url: string;
  publicId: string;
  width?: number;
  height?: number;
  format?: string;
  bytes?: number;
}

export interface UploadOptions {
  folder?: string;
  transformation?: {
    width?: number;
    height?: number;
    crop?: "fill" | "fit" | "scale" | "thumb";
    quality?: "auto" | number;
  };
  resourceType?: "image" | "video" | "raw" | "auto";
}

export interface ImageStorageProvider {
  upload(file: Buffer | string, options?: UploadOptions): Promise<UploadResult>;
  delete(publicId: string): Promise<void>;
  getUrl(publicId: string, options?: UploadOptions): string;
}

// ============================================================================
// CLOUDINARY PROVIDER
// ============================================================================

class CloudinaryProvider implements ImageStorageProvider {
  constructor() {
    // Configure Cloudinary from environment
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });
  }

  async upload(
    file: Buffer | string,
    options: UploadOptions = {},
  ): Promise<UploadResult> {
    const uploadOptions: any = {
      folder: options.folder || "anvil-chat",
      resource_type: options.resourceType || "auto",
    };

    // Add transformation if specified
    if (options.transformation) {
      uploadOptions.transformation = {
        width: options.transformation.width,
        height: options.transformation.height,
        crop: options.transformation.crop || "fill",
        quality: options.transformation.quality || "auto",
      };
    }

    // Handle Buffer (from file upload) or base64 string
    let uploadSource: string;
    if (Buffer.isBuffer(file)) {
      uploadSource = `data:image/png;base64,${file.toString("base64")}`;
    } else if (file.startsWith("data:")) {
      uploadSource = file;
    } else {
      // Assume it's a URL
      uploadSource = file;
    }

    const result = await cloudinary.uploader.upload(
      uploadSource,
      uploadOptions,
    );

    return {
      url: result.secure_url,
      publicId: result.public_id,
      width: result.width,
      height: result.height,
      format: result.format,
      bytes: result.bytes,
    };
  }

  async delete(publicId: string): Promise<void> {
    await cloudinary.uploader.destroy(publicId);
  }

  getUrl(publicId: string, options: UploadOptions = {}): string {
    const transformation = options.transformation || {};
    return cloudinary.url(publicId, {
      secure: true,
      transformation: {
        width: transformation.width,
        height: transformation.height,
        crop: transformation.crop || "fill",
        quality: transformation.quality || "auto",
        fetch_format: "auto",
      },
    });
  }
}

// ============================================================================
// S3-COMPATIBLE PROVIDER (for future use with AWS S3, Minio, Backblaze, etc.)
// ============================================================================

// Uncomment and configure when switching to S3
/*
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

class S3Provider implements ImageStorageProvider {
  private client: S3Client;
  private bucket: string;
  private publicUrl: string;

  constructor() {
    this.client = new S3Client({
      region: process.env.S3_REGION || "us-east-1",
      endpoint: process.env.S3_ENDPOINT, // For Minio: "http://localhost:9000"
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY!,
        secretAccessKey: process.env.S3_SECRET_KEY!,
      },
      forcePathStyle: !!process.env.S3_ENDPOINT, // Required for Minio
    });
    this.bucket = process.env.S3_BUCKET || "anvil-chat";
    this.publicUrl = process.env.S3_PUBLIC_URL || `https://${this.bucket}.s3.amazonaws.com`;
  }

  async upload(file: Buffer | string, options: UploadOptions = {}): Promise<UploadResult> {
    const key = `${options.folder || "uploads"}/${Date.now()}-${Math.random().toString(36).slice(2)}`;
    
    let body: Buffer;
    if (Buffer.isBuffer(file)) {
      body = file;
    } else if (file.startsWith("data:")) {
      const base64Data = file.split(",")[1];
      body = Buffer.from(base64Data, "base64");
    } else {
      throw new Error("URL uploads not supported for S3 provider");
    }

    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: body,
      ContentType: "image/png",
      ACL: "public-read",
    }));

    return {
      url: `${this.publicUrl}/${key}`,
      publicId: key,
    };
  }

  async delete(publicId: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: publicId,
    }));
  }

  getUrl(publicId: string): string {
    return `${this.publicUrl}/${publicId}`;
  }
}
*/

// ============================================================================
// FACTORY - Easily switch providers
// ============================================================================

type ProviderType = "cloudinary" | "s3";

function createImageStorage(
  provider: ProviderType = "cloudinary",
): ImageStorageProvider {
  switch (provider) {
    case "cloudinary":
      return new CloudinaryProvider();
    // case "s3":
    //   return new S3Provider();
    default:
      return new CloudinaryProvider();
  }
}

// Export singleton instance
// Change the provider here to switch storage backends
export const imageStorage = createImageStorage(
  (process.env.IMAGE_STORAGE_PROVIDER as ProviderType) || "cloudinary",
);
