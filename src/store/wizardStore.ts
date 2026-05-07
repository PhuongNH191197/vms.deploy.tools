import { create } from "zustand";

// TODO: Setup wizard state store
interface WizardStore {
  currentStep: number;
}

export const useWizardStore = create<WizardStore>(() => ({
  currentStep: 1,
}));
