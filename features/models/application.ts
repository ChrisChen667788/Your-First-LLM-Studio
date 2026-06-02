import { NextResponse } from "next/server";
import {
  cleanCommunityModelInstallDirectory,
  openCommunityModelInstallDirectory,
  readCommunityModelDiscoverySummary,
  retryCommunityModelInstall,
  scanCommunityModels,
  startCommunityModelInstall,
  verifyCommunityModelInstall,
} from "@/lib/community/model-discovery";

export type ModelDiscoveryRequest =
  | {
      action?: "scan";
      query?: string;
    }
  | {
      action: "install";
      candidateId?: string;
    }
  | {
      action: "verify-install";
      jobId?: string;
    }
  | {
      action: "retry-install" | "clean-install-dir" | "open-install-dir";
      jobId?: string;
    };

export function getRequiredModelDiscoveryId(
  value: string | undefined,
  fieldName: string,
) {
  const id = value?.trim();
  if (!id) {
    throw new Error(`${fieldName} is required.`);
  }
  return id;
}

export async function readModelDiscoverySummary() {
  return readCommunityModelDiscoverySummary();
}

export async function runModelDiscoveryAction(body: ModelDiscoveryRequest) {
  if (body.action === "install") {
    const candidateId = getRequiredModelDiscoveryId(
      body.candidateId,
      "candidateId",
    );
    const job = startCommunityModelInstall({ candidateId });
    const summary = await readCommunityModelDiscoverySummary();
    return { ok: true as const, job, summary };
  }

  if (body.action === "verify-install") {
    const jobId = getRequiredModelDiscoveryId(body.jobId, "jobId");
    const job = await verifyCommunityModelInstall({ jobId });
    const summary = await readCommunityModelDiscoverySummary();
    return { ok: true as const, job, summary };
  }

  if (body.action === "retry-install") {
    const jobId = getRequiredModelDiscoveryId(body.jobId, "jobId");
    const job = retryCommunityModelInstall({ jobId });
    const summary = await readCommunityModelDiscoverySummary();
    return { ok: true as const, job, summary };
  }

  if (body.action === "clean-install-dir") {
    const jobId = getRequiredModelDiscoveryId(body.jobId, "jobId");
    const job = await cleanCommunityModelInstallDirectory({ jobId });
    const summary = await readCommunityModelDiscoverySummary();
    return { ok: true as const, job, summary };
  }

  if (body.action === "open-install-dir") {
    const jobId = getRequiredModelDiscoveryId(body.jobId, "jobId");
    const opened = openCommunityModelInstallDirectory({ jobId });
    const summary = await readCommunityModelDiscoverySummary();
    return { ok: true as const, opened, summary };
  }

  const summary = await scanCommunityModels(
    body.action === "scan" || typeof body.action === "undefined"
      ? body.query
      : undefined,
  );
  return { ok: true as const, summary };
}

export async function GET() {
  try {
    const summary = await readModelDiscoverySummary();
    return NextResponse.json({
      ok: true,
      summary,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to load community model summary.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ModelDiscoveryRequest;
    return NextResponse.json(await runModelDiscoveryAction(body));
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to run community model action.";
    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: message.endsWith("is required.") ? 400 : 500 },
    );
  }
}
