/** The one-time Ambient room question: should the landscapes move gently, or stay still? */

import { SUPABASE_ANON_KEY, SUPABASE_URL, hasSupabase } from '@/lib/presence/config';
import { newId } from '@/lib/presence/session-id';
import { readStored, writeStored } from '@/lib/storage';

export type PollChoice = 'moving' | 'still';

/** `unsent` holds a vote the server hasn't confirmed yet, so it can be retried on a later visit. */
interface PollState {
  status: 'unasked' | 'dismissed' | 'unsent' | 'sent';
  choice?: PollChoice;
  scene?: string;
  voter?: string;
}

const KEY = 'ambient-poll';

function parse(raw: string): PollState | null {
  try {
    const value = JSON.parse(raw) as PollState;
    return typeof value?.status === 'string' ? value : null;
  } catch {
    return null;
  }
}

export function readPoll(): PollState {
  return readStored<PollState>(KEY, parse, { status: 'unasked' });
}

function writePoll(state: PollState): void {
  writeStored(KEY, JSON.stringify(state));
}

export function shouldAsk(): boolean {
  return readPoll().status === 'unasked';
}

/** Closing the card counts as answering it: it is asked once, not again later. */
export function dismissPoll(): void {
  writePoll({ status: 'dismissed' });
}

export async function castVote(choice: PollChoice, scene: string): Promise<void> {
  const state: PollState = { status: 'unsent', choice, scene, voter: readPoll().voter ?? newId() };
  writePoll(state);
  await send(state);
}

/** A vote that didn't reach the server last time goes again, quietly. */
export async function retryUnsentVote(): Promise<void> {
  const state = readPoll();
  if (state.status === 'unsent') await send(state);
}

async function send(state: PollState): Promise<void> {
  if (!hasSupabase() || !state.choice || !state.voter) return;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/cast_ambient_vote`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_voter: state.voter, p_choice: state.choice, p_scene: state.scene ?? null }),
      keepalive: true,
    });
    if (res.ok) writePoll({ ...state, status: 'sent' });
  } catch {
    // Offline or blocked: stays `unsent` for next time.
  }
}
