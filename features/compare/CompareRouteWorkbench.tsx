"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocale } from "@/components/layout/LocaleProvider";
import { agentTargets as builtinAgentTargets } from "@/lib/agent/catalog";
import {
  getDefaultSystemPromptForLocale,
  getLocalizedStarterPrompts,
} from "@/lib/i18n";
import { useComparePreferencePersistenceModel } from "@/features/compare/preference-persistence-model";
import { CompareWorkbenchShell } from "@/features/compare/CompareWorkbenchShell";
import { useCompareWorkbenchOrchestrationModel } from "@/features/compare/workbench-orchestration-model";
import { useCompareWorkbenchShellProps } from "@/features/compare/workbench-shell-props";
import { useCompareWorkbenchStateModel } from "@/features/compare/workbench-state-model";
import type {
  AgentCompareIntent,
  AgentCompareOutputShape,
  AgentCompareReviewSummaryDetail,
  AgentCompareReviewSummaryTone,
  AgentCompareSourceSurface,
  AgentMessage,
  AgentProviderProfile,
  AgentTarget,
  AgentThinkingMode,
  AgentWorkbenchMode,
} from "@/lib/agent/types";

const CONTEXT_WINDOW_OPTIONS = [4096, 8192, 16384, 32768];
const PROVIDER_PROFILE_OPTIONS: AgentProviderProfile[] = [
  "speed",
  "balanced",
  "tool-first",
];
const THINKING_MODE_OPTIONS: AgentThinkingMode[] = ["standard", "thinking"];
const MAX_COMPARE_LANES = 4;
const COMPARE_ROUTE_PREFERENCES_STORAGE_KEY = "compare-studio:v1";

type CompareRoutePreferences = {
  selectedTargetId?: string;
  enableTools?: boolean;
  enableRetrieval?: boolean;
  contextWindow?: number;
  providerProfile?: AgentProviderProfile;
  thinkingMode?: AgentThinkingMode;
  compareTargetIds?: string[];
  compareBaseTargetId?: string;
  compareReviewSummaryTone?: AgentCompareReviewSummaryTone;
  compareReviewSummaryDetail?: AgentCompareReviewSummaryDetail;
  compareBenchmarkUseOutputContract?: boolean;
  compareBenchmarkPreviewDiffOnly?: boolean;
  compareIntent?: AgentCompareIntent;
  compareOutputShape?: AgentCompareOutputShape;
};

type AgentTargetsResponse = {
  targets?: AgentTarget[];
};

function getInitialTargetId() {
  return (
    builtinAgentTargets.find((target) => target.id === "anthropic-claude")?.id ||
    builtinAgentTargets[0]?.id ||
    ""
  );
}

function readCompareRoutePreferences(): CompareRoutePreferences | null {
  try {
    const raw = window.localStorage.getItem(COMPARE_ROUTE_PREFERENCES_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CompareRoutePreferences) : null;
  } catch {
    return null;
  }
}

function isProviderProfile(value: unknown): value is AgentProviderProfile {
  return PROVIDER_PROFILE_OPTIONS.includes(value as AgentProviderProfile);
}

function isThinkingMode(value: unknown): value is AgentThinkingMode {
  return THINKING_MODE_OPTIONS.includes(value as AgentThinkingMode);
}

export function CompareRouteWorkbench({
  sourceSurface = "compare-studio",
}: {
  sourceSurface?: AgentCompareSourceSurface;
}) {
  const { locale } = useLocale();
  const [availableTargets, setAvailableTargets] =
    useState<AgentTarget[]>(builtinAgentTargets);
  const agentTargets = availableTargets;
  const [selectedTargetId, setSelectedTargetId] = useState(getInitialTargetId);
  const [, setWorkbenchMode] = useState<AgentWorkbenchMode>("compare");
  const [input, setInput] = useState(
    () => getLocalizedStarterPrompts(locale)[0] || "",
  );
  const [systemPrompt, setSystemPrompt] = useState(() =>
    getDefaultSystemPromptForLocale(locale),
  );
  const [enableTools, setEnableTools] = useState(true);
  const [enableRetrieval, setEnableRetrieval] = useState(false);
  const [contextWindow, setContextWindow] = useState(32768);
  const [providerProfile, setProviderProfile] =
    useState<AgentProviderProfile>("balanced");
  const [thinkingMode, setThinkingMode] =
    useState<AgentThinkingMode>("standard");
  const [copyState, setCopyState] = useState("");
  const preferencesHydratedRef = useRef(false);
  const historyMessages = useMemo<AgentMessage[]>(() => [], []);

  const {
    targetState: compareTargetState,
    promptState: comparePromptState,
    runState: compareRunState,
    recoveryState: compareRecoveryState,
    benchmarkState: compareBenchmarkState,
    recipeState: compareRecipeState,
  } = useCompareWorkbenchStateModel({ locale });

  const {
    compareTargetIds,
    setCompareTargetIds,
  } = compareTargetState;
  const {
    compareIntent,
    compareOutputShape,
    setCompareIntent,
    setCompareOutputShape,
  } = comparePromptState;
  const {
    comparePending,
    compareError,
    compareResult,
    compareBaseTargetId,
    compareReviewSummaryTone,
    compareReviewSummaryDetail,
    compareRuntimeByTargetId,
    compareProgressByTargetId,
    setCompareBaseTargetId,
    setCompareReviewSummaryTone,
    setCompareReviewSummaryDetail,
  } = compareRunState;
  const {
    compareRecoveryPendingTargetId,
    compareRecoveryConfirmTargetId,
    compareRecoveryCooldownByTargetId,
    compareRecoveryNotice,
  } = compareRecoveryState;
  const {
    compareBenchmarkUseOutputContract,
    compareBenchmarkPreviewDiffOnly,
    benchmarkPending,
    benchmarkError,
    benchmarkResult,
    setCompareBenchmarkUseOutputContract,
    setCompareBenchmarkPreviewDiffOnly,
  } = compareBenchmarkState;
  const {
    recipes,
    recipesPending,
    recipesError,
    activeRecipeId,
    recipeDraftLabel,
    recipeDraftDescription,
    setRecipeDraftLabel,
    setRecipeDraftDescription,
    loadStudioRecipes,
    saveCurrentStudioRecipe,
    deleteStudioRecipe,
    exportStudioRecipesJson,
    importStudioRecipesJson,
  } = compareRecipeState;

  const validTargetIds = useMemo(
    () => agentTargets.map((target) => target.id),
    [agentTargets],
  );
  const {
    buildStoredPreferenceSlice,
    applyStoredPreferenceInput,
  } = useComparePreferencePersistenceModel({
    targetState: compareTargetState,
    promptState: comparePromptState,
    runState: compareRunState,
    benchmarkState: compareBenchmarkState,
    validTargetIds,
    maxCompareLanes: MAX_COMPARE_LANES,
  });

  const loadAvailableTargets = useCallback(async () => {
    try {
      const response = await fetch("/api/agent/targets", { cache: "no-store" });
      const payload = (await response.json()) as AgentTargetsResponse;
      if (
        !response.ok ||
        !Array.isArray(payload.targets) ||
        !payload.targets.length
      ) {
        return;
      }
      setAvailableTargets(payload.targets);
    } catch {
      // Keep the builtin catalog when the foreground target sync is unavailable.
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadAvailableTargets();
    const timer = window.setInterval(() => {
      if (!cancelled) {
        void loadAvailableTargets();
      }
    }, 30000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [loadAvailableTargets]);

  useEffect(() => {
    void loadStudioRecipes();
  }, [loadStudioRecipes]);

  useEffect(() => {
    if (!agentTargets.length) return;
    if (!agentTargets.some((target) => target.id === selectedTargetId)) {
      setSelectedTargetId(agentTargets[0].id);
    }
    setCompareTargetIds((current) =>
      current.filter((targetId) =>
        agentTargets.some((target) => target.id === targetId),
      ),
    );
  }, [agentTargets, selectedTargetId, setCompareTargetIds]);

  useEffect(() => {
    if (preferencesHydratedRef.current || !validTargetIds.length) return;
    const preferences = readCompareRoutePreferences();
    preferencesHydratedRef.current = true;
    if (!preferences) return;

    if (
      typeof preferences.selectedTargetId === "string" &&
      validTargetIds.includes(preferences.selectedTargetId)
    ) {
      setSelectedTargetId(preferences.selectedTargetId);
    }

    applyStoredPreferenceInput(preferences);
    if (typeof preferences.enableTools === "boolean") {
      setEnableTools(preferences.enableTools);
    }
    if (typeof preferences.enableRetrieval === "boolean") {
      setEnableRetrieval(preferences.enableRetrieval);
    }
    if (
      typeof preferences.contextWindow === "number" &&
      CONTEXT_WINDOW_OPTIONS.includes(preferences.contextWindow)
    ) {
      setContextWindow(preferences.contextWindow);
    }
    if (isProviderProfile(preferences.providerProfile)) {
      setProviderProfile(preferences.providerProfile);
    }
    if (isThinkingMode(preferences.thinkingMode)) {
      setThinkingMode(preferences.thinkingMode);
    }
  }, [
    applyStoredPreferenceInput,
    validTargetIds,
  ]);

  useEffect(() => {
    if (!preferencesHydratedRef.current) return;
    const preferences = {
      selectedTargetId,
      enableTools,
      enableRetrieval,
      contextWindow,
      providerProfile,
      thinkingMode,
      ...buildStoredPreferenceSlice(),
    };
    window.localStorage.setItem(
      COMPARE_ROUTE_PREFERENCES_STORAGE_KEY,
      JSON.stringify(preferences),
    );
  }, [
    buildStoredPreferenceSlice,
    contextWindow,
    enableRetrieval,
    enableTools,
    providerProfile,
    selectedTargetId,
    thinkingMode,
  ]);

  useEffect(() => {
    if (!copyState) return;
    const timer = window.setTimeout(() => setCopyState(""), 1200);
    return () => window.clearTimeout(timer);
  }, [copyState]);

  const handleToggleCompareTarget = useCallback(
    (targetId: string) => {
      if (targetId === selectedTargetId) {
        return;
      }
      setCompareTargetIds((current) => {
        const deduped = Array.from(new Set(current));
        if (deduped.includes(targetId)) {
          return deduped.filter((id) => id !== targetId);
        }
        if (deduped.length >= MAX_COMPARE_LANES) {
          return deduped;
        }
        return [...deduped, targetId];
      });
    },
    [selectedTargetId, setCompareTargetIds],
  );

  const handleCopy = useCallback(async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyState(key);
    } catch {
      setCopyState("");
    }
  }, []);

  const handleCreateStudioRecipe = useCallback(
    () =>
      saveCurrentStudioRecipe({
        workbenchMode: "compare",
        compareOutputShape,
        enableTools,
        enableRetrieval,
        targetIds: compareTargetIds,
        input,
        systemPrompt,
        compareIntent,
        contextWindow,
        providerProfile,
        thinkingMode,
      }),
    [
      compareIntent,
      compareOutputShape,
      compareTargetIds,
      contextWindow,
      enableRetrieval,
      enableTools,
      input,
      providerProfile,
      saveCurrentStudioRecipe,
      systemPrompt,
      thinkingMode,
    ],
  );

  const {
    handleRunCompare,
    handleRerunCompareLane,
    handleSendCompareToBenchmark,
    requestRetryCompareLaneRecovery,
    handleExportCompareMarkdown,
    handleExportCompareLaneMarkdown,
    handleCopyCompareMarkdown,
    handleCopyCompareLaneMarkdown,
    handleCopyCompareLaneReviewSummary,
    handlePreviewCompareLaneMarkdown,
    applyStudioRecipe: handleApplyStudioRecipe,
    runStudioRecipeCompare: handleRunStudioRecipeCompare,
    runStudioRecipeBenchmark: handleRunStudioRecipeBenchmark,
  } = useCompareWorkbenchOrchestrationModel({
    locale,
    sourceSurface,
    agentTargets,
    historyMessages,
    maxCompareLanes: MAX_COMPARE_LANES,
    targetState: compareTargetState,
    promptState: comparePromptState,
    runState: compareRunState,
    recoveryState: compareRecoveryState,
    benchmarkState: compareBenchmarkState,
    recipeState: compareRecipeState,
    prompt: {
      input,
      setInput,
      systemPrompt,
      setSystemPrompt,
      contextWindow,
      setContextWindow,
      enableTools,
      setEnableTools,
      enableRetrieval,
      setEnableRetrieval,
      providerProfile,
      setProviderProfile,
      thinkingMode,
      setThinkingMode,
    },
    workbench: {
      selectedTargetId,
      setSelectedTargetId,
      setWorkbenchMode,
    },
    copyText: handleCopy,
  });

  const compareWorkbenchShellProps = useCompareWorkbenchShellProps({
    locale,
    target: {
      targets: agentTargets,
      selectedTargetId,
      compareTargetIds,
    },
    prompt: {
      compareIntent,
      compareOutputShape,
      input,
      systemPrompt,
      enableTools,
      enableRetrieval,
      contextWindow,
      providerProfile,
      thinkingMode,
    },
    run: {
      pending: false,
      comparePending,
      compareError,
      compareResult,
      compareBaseTargetId,
      compareReviewSummaryTone,
      compareReviewSummaryDetail,
      compareRuntimeByTargetId,
      compareProgressByTargetId,
    },
    recovery: {
      compareRecoveryPendingTargetId,
      compareRecoveryConfirmTargetId,
      compareRecoveryCooldownByTargetId,
      compareRecoveryNotice,
    },
    benchmark: {
      compareBenchmarkUseOutputContract,
      compareBenchmarkPreviewDiffOnly,
      benchmarkPending,
      benchmarkError,
      benchmarkResult,
    },
    recipe: {
      recipes,
      recipesPending,
      recipesError,
      activeRecipeId,
      recipeDraftLabel,
      recipeDraftDescription,
    },
    options: {
      contextWindowOptions: CONTEXT_WINDOW_OPTIONS,
      providerProfileOptions: PROVIDER_PROFILE_OPTIONS,
      thinkingModeOptions: THINKING_MODE_OPTIONS,
    },
    actions: {
      onToggleCompareTarget: handleToggleCompareTarget,
      onCompareIntentChange: setCompareIntent,
      onCompareOutputShapeChange: setCompareOutputShape,
      onInputChange: setInput,
      onSystemPromptChange: setSystemPrompt,
      onEnableToolsChange: setEnableTools,
      onEnableRetrievalChange: setEnableRetrieval,
      onContextWindowChange: setContextWindow,
      onProviderProfileChange: setProviderProfile,
      onThinkingModeChange: setThinkingMode,
      onRunCompare: handleRunCompare,
      onRerunLane: handleRerunCompareLane,
      onSetBaseLane: setCompareBaseTargetId,
      onCompareReviewSummaryToneChange: setCompareReviewSummaryTone,
      onCompareReviewSummaryDetailChange: setCompareReviewSummaryDetail,
      onSendToBenchmark: handleSendCompareToBenchmark,
      onExportMarkdown: handleExportCompareMarkdown,
      onCompareBenchmarkUseOutputContractChange:
        setCompareBenchmarkUseOutputContract,
      onCompareBenchmarkPreviewDiffOnlyChange:
        setCompareBenchmarkPreviewDiffOnly,
      onRetryLocalRecovery: requestRetryCompareLaneRecovery,
      onExportLaneMarkdown: handleExportCompareLaneMarkdown,
      onCopyMarkdown: handleCopyCompareMarkdown,
      onCopyLaneMarkdown: handleCopyCompareLaneMarkdown,
      onCopyLaneReviewSummary: handleCopyCompareLaneReviewSummary,
      onPreviewLaneMarkdown: handlePreviewCompareLaneMarkdown,
      onRecipeDraftLabelChange: setRecipeDraftLabel,
      onRecipeDraftDescriptionChange: setRecipeDraftDescription,
      onRefreshRecipes: loadStudioRecipes,
      onApplyRecipe: handleApplyStudioRecipe,
      onRunRecipeCompare: handleRunStudioRecipeCompare,
      onRunRecipeBenchmark: handleRunStudioRecipeBenchmark,
      onDeleteRecipe: deleteStudioRecipe,
      onSaveCurrentRecipe: handleCreateStudioRecipe,
      onExportRecipesJson: exportStudioRecipesJson,
      onImportRecipesJson: importStudioRecipesJson,
      onCopy: handleCopy,
    },
    copyState,
  });

  return <CompareWorkbenchShell {...compareWorkbenchShellProps} />;
}
