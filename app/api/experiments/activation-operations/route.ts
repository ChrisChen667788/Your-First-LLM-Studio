import { createActivationOperationsHandlers } from "@/features/evidence/activation-operations/application";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const { GET, POST } = createActivationOperationsHandlers();
