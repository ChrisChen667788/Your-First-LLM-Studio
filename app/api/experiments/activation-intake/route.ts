import { createIntakeHandlers } from "@/features/evidence/activation-intake/application";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const { GET, POST } = createIntakeHandlers();
