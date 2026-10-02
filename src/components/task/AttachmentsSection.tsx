import { ImagePlus, Loader2, X } from 'lucide-react';
import { useEffect, useRef, useState, type DragEvent } from 'react';
import { ATTACHMENT_ACCEPT, attachmentKind, MAX_ATTACHMENTS_PER_TASK } from '@/domain/attachments';
import type { Attachment, ID } from '@/domain/types';
import { cn } from '@/lib/cn';
import { IconButton } from '../ui/Button';
import { Skeleton } from '../ui/Skeleton';
import { Button } from '../ui/Button';

/** 1.2 MB, 340 KB. */
function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * Images and videos on a task, shown under the description. Files are added with
 * the button or by dropping them on the section. Props only: the parent does the
 * saving and supplies `loadBlob`, which already enforces who may see the file.
 */
export function AttachmentsSection({
  items,
  onAdd,
  onRemove,
  loadBlob,
}: {
  items: Attachment[];
  /** Resolves once every file has been handled; the store reports any rejected file as a toast. */
  onAdd: (files: File[]) => Promise<void>;
  onRemove: (id: ID) => void;
  loadBlob: (id: ID) => Promise<Blob | null>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const full = items.length >= MAX_ATTACHMENTS_PER_TASK;

  const add = async (files: File[]) => {
    if (files.length === 0 || busy) return;
    setBusy(true);
    try {
      await onAdd(files);
    } finally {
      setBusy(false);
    }
  };

  const dragsFiles = (e: DragEvent) => Array.from(e.dataTransfer.types).includes('Files');

  return (
    <div
      onDragOver={(e) => {
        if (!dragsFiles(e)) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false);
      }}
      onDrop={(e) => {
        if (!dragsFiles(e)) return;
        e.preventDefault();
        setOver(false);
        void add(Array.from(e.dataTransfer.files));
      }}
      className={cn(
        'mt-2 rounded-card transition-colors',
        over && 'bg-brand-50 outline-dashed outline-2 outline-offset-2 outline-brand-300',
      )}
    >
      <input
        ref={input}
        type="file"
        multiple
        accept={ATTACHMENT_ACCEPT}
        aria-label="Add images or videos"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          void add(Array.from(e.target.files ?? []));
          e.target.value = ''; // so picking the same file again still fires
        }}
      />
      <div className="flex items-center gap-2">
        <Button size="sm" variant="ghost" disabled={busy || full} onClick={() => input.current?.click()}>
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <ImagePlus className="h-3.5 w-3.5" aria-hidden />
          )}
          {busy ? 'Adding…' : 'Add image or video'}
        </Button>
        <span className="text-2xs text-ink-subtle">
          {full ? `Limit of ${MAX_ATTACHMENTS_PER_TASK} reached` : 'or drop files here'}
        </span>
      </div>

      {items.length > 0 && (
        <ul aria-label="Attachments" className="mt-2 grid grid-cols-2 gap-2">
          {items.map((item) => (
            <Tile key={item.id} item={item} loadBlob={loadBlob} onRemove={() => onRemove(item.id)} />
          ))}
        </ul>
      )}
    </div>
  );
}

/** One preview. The file is read from storage on mount and shown through a short-lived object URL. */
function Tile({
  item,
  loadBlob,
  onRemove,
}: {
  item: Attachment;
  loadBlob: (id: ID) => Promise<Blob | null>;
  onRemove: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const kind = attachmentKind(item.mime);

  useEffect(() => {
    let alive = true;
    let objectUrl: string | null = null;
    void loadBlob(item.id).then((blob) => {
      if (!alive) return;
      if (!blob) return setMissing(true);
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    });
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [item.id, loadBlob]);

  return (
    <li className="group relative overflow-hidden rounded-card bg-surface-muted ring-1 ring-inset ring-line">
      {missing ? (
        <div className="flex h-28 items-center justify-center px-3 text-center text-xs text-ink-subtle">
          File not available in this browser
        </div>
      ) : !url ? (
        <Skeleton className="h-28 w-full rounded-none" />
      ) : kind === 'video' ? (
        <video
          src={url}
          controls
          preload="metadata"
          aria-label={item.name}
          className="h-28 w-full bg-ink object-contain"
        />
      ) : (
        <a href={url} target="_blank" rel="noreferrer" title="Open full size">
          <img src={url} alt={item.name} className="h-28 w-full object-cover" />
        </a>
      )}
      <p className="flex items-center gap-1.5 px-2 py-1 text-2xs text-ink-subtle">
        <span className="min-w-0 flex-1 truncate font-medium text-ink-muted">{item.name}</span>
        <span className="shrink-0 tabular-nums">{formatBytes(item.size)}</span>
      </p>
      <IconButton
        label={`Remove ${item.name}`}
        onClick={onRemove}
        className="absolute right-1 top-1 bg-surface/90 opacity-0 shadow-card focus-visible:opacity-100 group-hover:opacity-100"
      >
        <X className="h-3.5 w-3.5" />
      </IconButton>
    </li>
  );
}
