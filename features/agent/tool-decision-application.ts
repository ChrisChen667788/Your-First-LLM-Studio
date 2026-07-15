import { getServerAgentTarget } from "@/lib/agent/server-targets";
import {
  cancelWorkspaceConfirmation,
  runWorkspaceTool,
} from "@/lib/agent/server-tools";
import type {
  AgentToolDecisionRequest,
  AgentToolDecisionResponse,
} from "@/lib/agent/types";
import { loadAgentLocalEnv, readAgentEnv } from "./runtime-target-resolution";

export class AgentToolDecisionApplicationError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
  }
}

function validateToolDecision(
  input: Partial<AgentToolDecisionRequest>,
): AgentToolDecisionRequest {
  if (!input.targetId || typeof input.targetId !== "string") throw new AgentToolDecisionApplicationError("targetId is required.");
  if (!input.toolName || typeof input.toolName !== "string") throw new AgentToolDecisionApplicationError("toolName is required.");
  if (!input.input || typeof input.input !== "object" || Array.isArray(input.input)) throw new AgentToolDecisionApplicationError("input must be a tool argument object.");
  if (!input.confirmationToken || typeof input.confirmationToken !== "string") throw new AgentToolDecisionApplicationError("confirmationToken is required.");
  if (input.action !== "approve" && input.action !== "reject") throw new AgentToolDecisionApplicationError("action must be approve or reject.");
  return input as AgentToolDecisionRequest;
}

export async function runAgentToolDecision(
  input: Partial<AgentToolDecisionRequest>,
): Promise<AgentToolDecisionResponse> {
  const body = validateToolDecision(input);
  const target = getServerAgentTarget(body.targetId);
  if (!target) {
    throw new AgentToolDecisionApplicationError(`Unknown target: ${body.targetId}`, 404);
  }
  if (target.execution === "local") {
    const localEnv = loadAgentLocalEnv();
    const resolvedBaseUrl = readAgentEnv(
      localEnv,
      target.baseUrlEnv,
      target.baseUrlDefault,
    ).replace(/\/$/, "");
    const gatewayBaseUrl = resolvedBaseUrl.replace(/\/v1$/, "");
    const endpoint = body.action === "approve"
      ? `${gatewayBaseUrl}/v1/tools/run`
      : `${gatewayBaseUrl}/v1/tools/confirmations/reject`;
    const payload = body.action === "approve"
      ? {
          tool_name: body.toolName,
          arguments: {
            ...body.input,
            confirmationToken: body.confirmationToken,
          },
        }
      : { confirmation_token: body.confirmationToken };
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new AgentToolDecisionApplicationError(
        `Local tool decision failed (${response.status}): ${await response.text()}`,
        502,
      );
    }
    const data = (await response.json()) as AgentToolDecisionResponse["toolRun"];
    return {
      toolRun: body.action === "approve"
        ? data
        : {
            name: body.toolName,
            input: {
              ...body.input,
              confirmationToken: body.confirmationToken,
              userDecision: "reject",
            },
            output: data.output,
          },
    };
  }
  if (body.action === "reject") {
    const cancelled = cancelWorkspaceConfirmation(body.confirmationToken);
    return {
      toolRun: {
        name: body.toolName,
        input: {
          ...body.input,
          confirmationToken: body.confirmationToken,
          userDecision: "reject",
        },
        output: JSON.stringify({
          status: "rejected_by_user",
          confirmationToken: body.confirmationToken,
          cancelled,
          message: "Pending confirmation was rejected and will not be executed.",
        }, null, 2),
      },
    };
  }
  return {
    toolRun: await runWorkspaceTool(body.toolName, {
      ...body.input,
      confirmationToken: body.confirmationToken,
    }),
  };
}
