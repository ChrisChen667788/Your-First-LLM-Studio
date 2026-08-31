import assert from "node:assert/strict";
import test from "node:test";

import {
  RELEASE_TRAIN_DEVELOPMENT_VERSION,
  RELEASE_TRAIN_MILESTONES,
} from "@/features/experiments/release-train";

test("competitive research is represented as fifteen planned product milestones", () => {
  const planned = RELEASE_TRAIN_MILESTONES.slice(-15);

  assert.deepEqual(
    planned.map((entry) => entry.version),
    [
      "v3.8.0", "v3.8.1", "v3.8.2", "v3.8.3", "v3.8.4",
      "v3.8.5", "v3.8.6", "v3.8.7", "v3.8.8", "v3.8.9",
      "v3.9.0", "v3.9.1", "v3.9.2", "v3.9.3", "v3.9.4",
    ],
  );
  assert.ok(planned.every((entry) => entry.status === "planned"));
  assert.ok(planned.every((entry) => entry.acceptance.length >= 2));
  assert.ok(planned.every((entry) => entry.evidence.length >= 2));
  assert.equal(RELEASE_TRAIN_MILESTONES.length, 200);
  assert.equal(
    RELEASE_TRAIN_DEVELOPMENT_VERSION,
    "v1.7.0-v3.7.4 source; v3.8.0-v3.9.4 planned",
  );
});
