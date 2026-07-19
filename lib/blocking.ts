import { COLLECTIVE_REHEARSAL_NOTE_PREFIX } from "@/lib/constants";

export function buildCollectiveRehearsalNote(title: string) {
  return `${COLLECTIVE_REHEARSAL_NOTE_PREFIX}${title.trim()}`;
}

export function getCollectiveRehearsalTitle(reviewNote: string | null) {
  if (!reviewNote?.startsWith(COLLECTIVE_REHEARSAL_NOTE_PREFIX)) {
    return null;
  }

  return reviewNote.slice(COLLECTIVE_REHEARSAL_NOTE_PREFIX.length).trim() || null;
}
