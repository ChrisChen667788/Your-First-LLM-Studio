import assert from "node:assert/strict";
import test from "node:test";

import {
  RELEASE_TRAIN_DEVELOPMENT_VERSION,
  RELEASE_TRAIN_MILESTONES,
} from "@/features/experiments/release-train";

test("competitive and evidence operations trains remain source-complete and evidence-gated", () => {
  const competitiveMilestones = RELEASE_TRAIN_MILESTONES.filter((entry) =>
    /^v3\.(?:8|9)\./u.test(entry.version),
  );
  const evidenceMilestones = RELEASE_TRAIN_MILESTONES.filter((entry) =>
    /^v4\.(?:0|1)\./u.test(entry.version),
  );

  assert.deepEqual(
    competitiveMilestones.map((entry) => entry.version),
    [
      "v3.8.0", "v3.8.1", "v3.8.2", "v3.8.3", "v3.8.4",
      "v3.8.5", "v3.8.6", "v3.8.7", "v3.8.8", "v3.8.9",
      "v3.9.0", "v3.9.1", "v3.9.2", "v3.9.3", "v3.9.4",
    ],
  );
  assert.deepEqual(
    evidenceMilestones.map((entry) => entry.version),
    [
      "v4.0.0", "v4.0.1", "v4.0.2", "v4.0.3", "v4.0.4",
      "v4.0.5", "v4.0.6", "v4.0.7", "v4.0.8", "v4.0.9",
      "v4.1.0", "v4.1.1", "v4.1.2", "v4.1.3", "v4.1.4",
    ],
  );
  const milestones = [...competitiveMilestones, ...evidenceMilestones];
  assert.ok(milestones.every((entry) => entry.status === "evidence-needed"));
  assert.ok(milestones.every((entry) => entry.acceptance.length >= 2));
  assert.ok(milestones.every((entry) => entry.evidence.length >= 2));
  assert.equal(RELEASE_TRAIN_MILESTONES.length, 350);
  assert.equal(
    RELEASE_TRAIN_DEVELOPMENT_VERSION,
    "v1.7.0-v5.9.4 source",
  );
});
