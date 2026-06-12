import type {
  ComparePreferenceInput,
  ComparePreferenceSnapshotInput,
} from "@/features/compare/preferences";

export type CompareSessionPreferencePort = {
  snapshot: ComparePreferenceSnapshotInput;
  apply: (input: ComparePreferenceInput | null | undefined) => void;
};
