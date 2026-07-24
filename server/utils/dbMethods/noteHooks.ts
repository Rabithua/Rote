import { notifyPublicNoteCreated } from '../adminHooks';
import { trackBackgroundTask } from '../backgroundTask';
import {
  createRote as createBaseRote,
  editRoteWithState as editBaseRoteWithState,
  type EditRoteWithStateResult,
  findRoteById,
} from './note';

type EditRoteOperation = (data: any) => Promise<EditRoteWithStateResult>;

interface PublicTransitionEditResult {
  becamePublic: boolean;
  note: any;
}

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

export async function editRoteWithPublicTransition(
  data: any,
  edit: EditRoteOperation = editBaseRoteWithState
): Promise<PublicTransitionEditResult> {
  const result = await edit(data);
  return {
    becamePublic: becamePublic(result.previousState, result.nextState),
    note: result.note,
  };
}

export async function editRote(data: any): Promise<any> {
  const result = await editRoteWithPublicTransition(data);

  if (result.becamePublic) {
    await notifyPublicNote(result.note);
  }

  return result.note;
}
