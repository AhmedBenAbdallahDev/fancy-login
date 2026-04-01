import { getSession } from "auth/server";
import { imageStorage } from "lib/storage/image-storage";
import { cookies } from "next/headers";

// Max file size: 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Allowed MIME types
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

// Helper to get current user ID (works for both online and offline users)
async function getCurrentUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const offlineUserStr = cookieStore.get("diffchat_offline_user")?.value;

  if (offlineUserStr) {
    try {
      const offlineUser = JSON.parse(offlineUserStr);
      return offlineUser.id;
    } catch {
      // Fall through
    }
  }

  const session = await getSession();
  return session?.user?.id ?? null;
}

// POST /api/upload - Upload an image
export async function POST(request: Request) {
  const userId = await getCurrentUserId();

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const folder = (formData.get("folder") as string) || "uploads";
    const maxWidth = parseInt(formData.get("maxWidth") as string) || undefined;
    const maxHeight =
      parseInt(formData.get("maxHeight") as string) || undefined;

    if (!file) {
      return Response.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return Response.json(
        { error: `Invalid file type. Allowed: ${ALLOWED_TYPES.join(", ")}` },
        { status: 400 },
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return Response.json(
        { error: `File too large. Max size: ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 },
      );
    }

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to storage provider
    const result = await imageStorage.upload(buffer, {
      folder: `anvil-chat/${folder}/${userId.slice(0, 8)}`,
      transformation:
        maxWidth || maxHeight
          ? {
              width: maxWidth,
              height: maxHeight,
              crop: "fit",
              quality: "auto",
            }
          : undefined,
    });

    return Response.json({
      url: result.url,
      publicId: result.publicId,
      width: result.width,
      height: result.height,
    });
  } catch (error: any) {
    console.error("Upload failed:", error);
    return Response.json(
      { error: error.message || "Upload failed" },
      { status: 500 },
    );
  }
}

// DELETE /api/upload - Delete an image
export async function DELETE(request: Request) {
  const userId = await getCurrentUserId();

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { publicId } = await request.json();

    if (!publicId) {
      return Response.json({ error: "No publicId provided" }, { status: 400 });
    }

    // Security: Only allow deleting images in user's folder
    if (!publicId.includes(userId.slice(0, 8))) {
      return Response.json(
        { error: "Not authorized to delete this image" },
        { status: 403 },
      );
    }

    await imageStorage.delete(publicId);

    return Response.json({ success: true });
  } catch (error: any) {
    console.error("Delete failed:", error);
    return Response.json(
      { error: error.message || "Delete failed" },
      { status: 500 },
    );
  }
}
