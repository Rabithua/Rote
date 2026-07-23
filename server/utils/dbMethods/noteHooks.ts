import { notifyPublicNoteCreated } from '../adminHooks';
import { trackBackgroundTask } from '../backgroundTask';
import { createRote as createBaseRote, editRote as editBaseRote, findRoteById } from './note';

export function becamePublic(previousState: unknown, nextState: unknown): boolean {
  return previousState !== 'public' && nextState === 'public';
}

async function notifyPublicNote(note: any) {
  const noteWithRelations = (await findRoteById(note.id)) || note;
  trackBackgroundTask(notifyPublicNoteCreated(noteWithRelations), 'admin_hook_public_note_failed');
}

export async function createRote(data: any): Promise<any> {
  const rote = await createBaseRote(data);
  if (becamePublic(undefined, rote?.state)) {
    await notifyPublicNote(rote);
  }
  return rote;
}

export async function editRote(data: any): Promise<any> {
  const previousNote = data?.state === 'public' ? await findRoteById(data.id) : null;
  const rote = await editBaseRote(data);

  if (becamePublic(previousNote?.state, rote?.state)) {
    await notifyPublicNote(rote);
  }

  return rote;
}
