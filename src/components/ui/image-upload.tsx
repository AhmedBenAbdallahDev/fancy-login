"use client";

import { useState, useCallback, useRef } from "react";
import { cn } from "lib/utils";
import { Button } from "ui/button";
import { Input } from "ui/input";
import {
  Upload,
  X,
  Loader2,
  Image as ImageIcon,
  Link as LinkIcon,
} from "lucide-react";
import NextImage from "next/image";
import { toast } from "sonner";

interface ImageUploadProps {
  value?: string;
  onChange: (url: string | undefined) => void;
  folder?: string;
  maxWidth?: number;
  maxHeight?: number;
  aspectRatio?: "square" | "banner" | "free";
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function ImageUpload({
  value,
  onChange,
  folder = "images",
  maxWidth,
  maxHeight,
  aspectRatio = "free",
  placeholder = "Click to upload or drag and drop",
  className,
  disabled,
}: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        toast.error("Please select an image file");
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image must be less than 5MB");
        return;
      }

      setIsUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("folder", folder);
        if (maxWidth) formData.append("maxWidth", maxWidth.toString());
        if (maxHeight) formData.append("maxHeight", maxHeight.toString());

        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Upload failed");
        }

        const result = await response.json();
        onChange(result.url);
        toast.success("Image uploaded");
      } catch (error: any) {
        toast.error(error.message || "Failed to upload image");
      } finally {
        setIsUploading(false);
      }
    },
    [folder, maxWidth, maxHeight, onChange],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleUpload(file);
      }
    },
    [handleUpload],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) {
        handleUpload(file);
      }
    },
    [handleUpload],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleUrlSubmit = useCallback(() => {
    if (urlInput.trim()) {
      // Basic URL validation
      try {
        new URL(urlInput);
        onChange(urlInput.trim());
        setUrlInput("");
        setShowUrlInput(false);
        toast.success("Image URL saved");
      } catch {
        toast.error("Please enter a valid URL");
      }
    }
  }, [urlInput, onChange]);

  const handleRemove = useCallback(() => {
    onChange(undefined);
  }, [onChange]);

  const aspectRatioClass = {
    square: "aspect-square",
    banner: "aspect-[3/1]",
    free: "aspect-video",
  }[aspectRatio];

  return (
    <div className={cn("space-y-2", className)}>
      {value ? (
        // Show preview
        <div
          className={cn(
            "relative rounded-lg overflow-hidden border",
            aspectRatioClass,
          )}
        >
          <NextImage
            src={value}
            alt="Uploaded"
            fill
            className="object-cover"
            unoptimized
          />
          {!disabled && (
            <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => inputRef.current?.click()}
                disabled={isUploading}
              >
                {isUploading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Upload className="size-4" />
                )}
                Replace
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={handleRemove}
              >
                <X className="size-4" />
                Remove
              </Button>
            </div>
          )}
        </div>
      ) : (
        // Show upload area
        <div
          className={cn(
            "relative rounded-lg border-2 border-dashed transition-colors",
            aspectRatioClass,
            isDragging
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-muted-foreground/50",
            disabled && "opacity-50 cursor-not-allowed",
          )}
          onDrop={disabled ? undefined : handleDrop}
          onDragOver={disabled ? undefined : handleDragOver}
          onDragLeave={disabled ? undefined : handleDragLeave}
          onClick={disabled ? undefined : () => inputRef.current?.click()}
        >
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4">
            {isUploading ? (
              <>
                <Loader2 className="size-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Uploading...</p>
              </>
            ) : (
              <>
                <ImageIcon className="size-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground text-center">
                  {placeholder}
                </p>
                <p className="text-xs text-muted-foreground">
                  PNG, JPG, GIF, WEBP up to 5MB
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
        disabled={disabled || isUploading}
      />

      {/* URL input toggle */}
      {!disabled && (
        <div className="flex items-center gap-2">
          {showUrlInput ? (
            <div className="flex-1 flex gap-2">
              <Input
                placeholder="https://example.com/image.png"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleUrlSubmit()}
                className="flex-1"
              />
              <Button type="button" size="sm" onClick={handleUrlSubmit}>
                Save
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setShowUrlInput(false)}
              >
                <X className="size-4" />
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowUrlInput(true)}
              className="text-xs text-muted-foreground"
            >
              <LinkIcon className="size-3 mr-1" />
              Or paste image URL
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
