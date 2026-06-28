"use client";

// Reference-image attach for chat-style inputs: a paperclip button (triggers an image picker)
// and a thumbnail strip with remove. Controlled — the parent owns the list so it can attach the
// images to a message / idea. Previews use object URLs (client-side; no upload backend yet).

import { useRef } from "react";
import styles from "./ImageAttach.module.css";

export type AttachedImage = { id: string; name: string; url: string };

let counter = 0;
export function filesToImages(files: FileList): AttachedImage[] {
  return Array.from(files)
    .filter((f) => f.type.startsWith("image/"))
    .map((f) => ({ id: `att-${counter++}`, name: f.name, url: URL.createObjectURL(f) }));
}

function Clip() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21.44 11.05 12.25 20.24a6 6 0 0 1-8.49-8.49l9.2-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

export function AttachButton({
  onPick,
  className,
}: {
  onPick: (images: AttachedImage[]) => void;
  className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        type="button"
        className={className ?? styles.clip}
        onClick={() => ref.current?.click()}
        aria-label="Attach a reference image"
        title="Attach a reference image"
      >
        <Clip />
      </button>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files?.length) onPick(filesToImages(e.target.files));
          e.target.value = "";
        }}
      />
    </>
  );
}

export function Thumbs({
  images,
  onRemove,
}: {
  images: AttachedImage[];
  onRemove: (id: string) => void;
}) {
  if (!images.length) return null;
  return (
    <div className={styles.thumbs}>
      {images.map((im) => (
        <div key={im.id} className={styles.thumb}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={im.url} alt={im.name} />
          <button type="button" onClick={() => onRemove(im.id)} aria-label={`Remove ${im.name}`}>
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
