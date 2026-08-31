import { readOwnerWorkloadAdmissionTrain } from "@/features/experiments/owner-workload-admission-train";
import { validateOwnerWorkloadReceipt } from "@/features/experiments/owner-workload-protocol";

export function readOwnerWorkloadAdmissionApplication() {
  return readOwnerWorkloadAdmissionTrain();
}

export function validateOwnerWorkloadReceiptApplication(receipt: unknown) {
  const state = readOwnerWorkloadAdmissionTrain();
  return validateOwnerWorkloadReceipt({
    receipt,
    protocol: state.ownerWorkloadProtocol,
  });
}
