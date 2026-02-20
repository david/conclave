import React, { useState, useRef, useCallback, useEffect } from "react";
import type { ImageAttachment } from "../../server/types.ts";

type PendingImage = {
  id: string;
  data: string;
  mimeType: string;
  objectUrl: string;
};

type InputBarProps = {
  onSubmit: (text: string, images?: ImageAttachment[]) => void;
  onCancel: () => void;
  isProcessing: boolean;
  placeholder?: string;
};

const MAX_DIMENSION = 1568;

function resizeImage(file: File): Promise<{ data: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          const scale = MAX_DIMENSION / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, width, height);

        const mimeType = file.type === "image/png" ? "image/png" : "image/jpeg";
        const quality = mimeType === "image/jpeg" ? 0.85 : undefined;
        const dataUrl = canvas.toDataURL(mimeType, quality);
        const base64 = dataUrl.split(",")[1];
        resolve({ data: base64, mimeType });
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

let imageIdCounter = 0;

export function InputBar({ onSubmit, onCancel, isProcessing, placeholder: placeholderProp }: InputBarProps) {
  const [text, setText] = useState("");
  const [images, setImages] = useState<PendingImage[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const autoResize = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${ta.scrollHeight}px`;
  }, []);

  useEffect(() => {
    autoResize();
  }, [text, autoResize]);

  // Revoke object URLs on unmount
  useEffect(() => {
    return () => {
      images.forEach((img) => URL.revokeObjectURL(img.objectUrl));
    };
  }, []);

  const addImages = useCallback(async (files: File[]) => {
    const newImages: PendingImage[] = [];
    for (const file of files) {
      try {
        const { data, mimeType } = await resizeImage(file);
        const objectUrl = URL.createObjectURL(file);
        newImages.push({
          id: `img-${++imageIdCounter}`,
          data,
          mimeType,
          objectUrl,
        });
      } catch {
        // Skip files that fail to process
      }
    }
    if (newImages.length > 0) {
      setImages((prev) => [...prev, ...newImages]);
    }
  }, []);

  const removeImage = useCallback((id: string) => {
    setImages((prev) => {
      const img = prev.find((i) => i.id === id);
      if (img) URL.revokeObjectURL(img.objectUrl);
      return prev.filter((i) => i.id !== id);
    });
  }, []);

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      if (isProcessing) return;
      const items = e.clipboardData?.items;
      if (!items) return;

      const imageFiles: File[] = [];
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) imageFiles.push(file);
        }
      }

      if (imageFiles.length > 0) {
        e.preventDefault();
        addImages(imageFiles);
      }
    },
    [isProcessing, addImages],
  );

  const handleSubmit = useCallback(() => {
    const trimmed = text.trim();
    const hasContent = trimmed || images.length > 0;
    if (!hasContent || isProcessing) return;

    const attachments = images.length > 0
      ? images.map(({ data, mimeType }) => ({ data, mimeType }))
      : undefined;

    onSubmit(trimmed, attachments);
    setText("");
    // Revoke object URLs and clear images
    images.forEach((img) => URL.revokeObjectURL(img.objectUrl));
    setImages([]);
  }, [text, images, isProcessing, onSubmit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  const hasContent = text.trim() || images.length > 0;

  return (
    <div className="input-bar">
      {images.length > 0 && (
        <div className="input-bar__images">
          {images.map((img) => (
            <div key={img.id} className="input-bar__thumb">
              <img src={img.objectUrl} className="input-bar__thumb-img" alt="" />
              <button
                className="input-bar__thumb-remove"
                onClick={() => removeImage(img.id)}
                type="button"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="input-bar__row">
        <textarea
          ref={textareaRef}
          className="textarea-base input-bar__textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={isProcessing ? "Waiting for response..." : (placeholderProp || "Type a message...")}
          disabled={isProcessing}
          rows={1}
        />
        {isProcessing ? (
          <button className="input-bar__btn input-bar__btn--cancel" onClick={onCancel}>
            Stop
          </button>
        ) : (
          <button
            className="input-bar__btn input-bar__btn--send"
            onClick={handleSubmit}
            disabled={!hasContent}
          >
            Send
          </button>
        )}
      </div>
    </div>
  );
}
