import { create } from 'zustand';

interface UiState {
  dismissedProposals: Set<string>;
  dismissProposal(id: string): void;
}

function load(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem('lq_dismissed') ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}

export const useUi = create<UiState>((set, get) => ({
  dismissedProposals: load(),
  dismissProposal(id) {
    const next = new Set(get().dismissedProposals);
    next.add(id);
    try {
      localStorage.setItem('lq_dismissed', JSON.stringify([...next].slice(-100)));
    } catch {
      /* ignore */
    }
    set({ dismissedProposals: next });
  },
}));
