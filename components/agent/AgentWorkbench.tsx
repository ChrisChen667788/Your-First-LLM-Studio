"use client";

import {
  useEffect,
  useMemo,
  useRef,
} from "react";
import { useAgentChatSessionState } from "@/features/agent/chat-session-state";
import { getAgentWorkbenchCopy } from "@/features/agent/workbench-copy";
import {
  buildAgentConversationSelectors,
  countSelectedCompareLanes,
} from "@/features/agent/conversation-selectors";
import {
  buildAgentSessionSyncLabel,
} from "@/features/agent/session-sync-status";
import { useAgentSessionCommandActions } from "@/features/agent/session-command-actions";
import { useAgentSessionApplyActions } from "@/features/agent/session-apply-actions";
import { useAgentCopyReplayState } from "@/features/agent/copy-replay-state";
import { useAgentRuntimeConnectionComposition } from "@/features/agent/runtime-connection-composition";
import {
  buildRuntimeStatusRailProps,
  buildRuntimeStatusRailText,
} from "@/features/agent/runtime-rail-composition";
import { buildAgentRuntimeViewModel } from "@/features/agent/runtime-view-model";
import {
  useAgentSessionHydration,
  writeRuntimeSwitchHistory,
} from "@/features/agent/session-hydration";
import { useAgentSessionServerSync } from "@/features/agent/session-server-sync";
import { useAgentSessionSidebarSelectors } from "@/features/agent/session-sidebar-selectors";
import { AgentWorkbenchLayout } from "@/features/agent/workbench-layout";
import {
  buildAgentComposerProps,
  buildAgentGetCodeProps,
  buildAgentSecondaryAnalysisProps,
  buildAgentSessionToolsProps,
  buildAgentTargetCatalogProps,
  buildAgentTargetProfileProps,
  buildAgentTranscriptProps,
  buildAgentWorkbenchHeaderProps,
  buildAgentWorkbenchLayoutProps,
  buildAgentWorkbenchPromptStripProps,
  buildAgentWorkbenchStatusBandProps,
} from "@/features/agent/workbench-composition";
import { buildAgentSidebarComposition } from "@/features/agent/sidebar-composition";
import { useAgentWorkbenchShellState } from "@/features/agent/workbench-shell-state";
import { useAgentRuntimeConnectionShellState } from "@/features/agent/runtime-connection-shell";
import { useAgentTranscriptShellState } from "@/features/agent/transcript-shell-state";
import { useAgentWorkspaceFileActions } from "@/features/agent/workspace-file-actions";
import { useAgentTurnLifecycle } from "@/features/agent/turn-lifecycle";
import { buildAgentTurnLifecycleInput } from "@/features/agent/turn-lifecycle-input";
import { useAgentTargetCatalogSync } from "@/features/agent/target-catalog-sync";
import { useAgentLocaleDefaultSync } from "@/features/agent/locale-default-sync";
import { useAgentSessionSyncProjections } from "@/features/agent/session-sync-projections";
import { useAgentTranscriptExportActions } from "@/features/agent/transcript-export";
import { useLocale } from "@/components/layout/LocaleProvider";
import { CompareWorkbenchPortal } from "@/features/compare/CompareWorkbenchPortal";
import { useEmbeddedCompareSessionAdapter } from "@/features/compare/embedded-session-adapter";
import { useEmbeddedCompareWorkbenchAdapter } from "@/features/compare/embedded-workbench-adapter";
import { useCompareWorkbenchStateModel } from "@/features/compare/workbench-state-model";
import { getLocalizedStarterPrompts } from "@/lib/i18n";
import { clampContextWindowForTarget } from "@/lib/agent/metrics";
import { buildReproduceRequestArtifacts } from "@/lib/agent/reproduce-request";
import type {
  AgentCompareIntent,
  AgentCompareLaneProgress,
  AgentCompareProgress,
  AgentCompareOutputShape,
  AgentCompareReviewSummaryDetail,
  AgentCompareReviewSummaryTone,
  AgentCompareResponse,
  AgentCompareSourceSurface,
  AgentConnectionCheckResponse,
  AgentMessage,
  AgentProviderProfile,
  AgentThinkingMode,
  AgentRuntimeStatus,
  AgentWorkbenchMode,
} from "@/lib/agent/types";

type AgentWorkbenchProps = {
  initialMode?: AgentWorkbenchMode;
  forceInitialMode?: boolean;
  compareSurface?: AgentCompareSourceSurface;
};

const CONTEXT_WINDOW_OPTIONS = [4096, 8192, 16384, 32768];
const PROVIDER_PROFILE_OPTIONS: AgentProviderProfile[] = [
  "speed",
  "balanced",
  "tool-first",
];
const THINKING_MODE_OPTIONS: AgentThinkingMode[] = ["standard", "thinking"];
const MAX_COMPARE_LANES = 4;

function clampUiContextWindow(
  targetId: string,
  contextWindow: number,
  enableTools: boolean,
  enableRetrieval: boolean,
) {
  return clampContextWindowForTarget(targetId, contextWindow, {
    enableTools,
    enableRetrieval,
  });
}

function formatContextWindowLabel(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) return "--";
  return value >= 1024 ? `${Math.round(value / 1024)}K` : `${value}`;
}

export function AgentWorkbench({
  initialMode = "chat",
  forceInitialMode = false,
  compareSurface = "agent-embedded",
}: AgentWorkbenchProps = {}) {
  const { locale, dictionary } = useLocale();
  const starterPrompts = useMemo(
    () => getLocalizedStarterPrompts(locale),
    [locale],
  );
  const {
    availableTargets,
    setAvailableTargets,
    sessionId,
    setSessionId,
    savedSessions,
    setSavedSessions,
    selectedTargetId,
    setSelectedTargetId,
    workbenchMode,
    setWorkbenchMode,
    turns,
    setTurns,
    input,
    setInput,
    systemPrompt,
    setSystemPrompt,
    enableTools,
    setEnableTools,
    enableRetrieval,
    setEnableRetrieval,
    contextWindow,
    setContextWindow,
    providerProfile,
    setProviderProfile,
    thinkingMode,
    setThinkingMode,
    pending,
    setPending,
    error,
    setError,
    expandedCitationKey,
    setExpandedCitationKey,
    expandedTraceTurnId,
    setExpandedTraceTurnId,
    expandedReviewFileKey,
    setExpandedReviewFileKey,
    toolDecisionBusyKey,
    setToolDecisionBusyKey,
    toolDecisionStatusByToken,
    setToolDecisionStatusByToken,
    preferencesReady,
    setPreferencesReady,
    serverSessionSyncState,
    setServerSessionSyncState,
    serverSnapshotUpdatedAt,
    setServerSnapshotUpdatedAt,
    sessionSyncConflict,
    setSessionSyncConflict,
  } = useAgentChatSessionState(initialMode);
  const agentTargets = availableTargets;
  const {
    getCodeOpen,
    setGetCodeOpen,
    getCodeLanguage,
    setGetCodeLanguage,
    runtimeRailCollapsed,
    setRuntimeRailCollapsed,
    sessionSearch,
    setSessionSearch,
    sessionTargetFilter,
    setSessionTargetFilter,
    sessionExportScope,
    setSessionExportScope,
  } = useAgentWorkbenchShellState();
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
    setCompareBaseTargetId,
    setCompareReviewSummaryTone,
    setCompareReviewSummaryDetail,
  } = compareRunState;
  const {
    compareBenchmarkUseOutputContract,
    compareBenchmarkPreviewDiffOnly,
    setCompareBenchmarkUseOutputContract,
    setCompareBenchmarkPreviewDiffOnly,
  } = compareBenchmarkState;
  const {
    runtime: runtimeShell,
    connection: connectionShell,
  } = useAgentRuntimeConnectionShellState();
  const {
    runtimeStatus,
    runtimeLastSwitchMsByTarget,
    setRuntimeLastSwitchMsByTarget,
    runtimeLastSwitchAtByTarget,
    setRuntimeLastSwitchAtByTarget,
    prewarmPending,
    prewarmAllPending,
    prewarmMessage,
    setPrewarmMessage,
    runtimeActionPending,
    runtimeLogExcerpt,
    setRuntimeLogExcerpt,
  } = runtimeShell;
  const {
    openWorkspaceFilePath,
    focusedWorkspaceFilePath,
    workspaceFileFocusState,
    workspaceFileViews,
    handleStepWorkspaceFileAnchor,
    handleOpenWorkspaceFile,
  } = useAgentWorkspaceFileActions();
  const {
    transcriptRef,
    transcriptPinnedToBottom,
    setTranscriptPinnedToBottom,
    unseenTranscriptTurns,
    setUnseenTranscriptTurns,
    scrollTranscriptToLatest,
    handleJumpToLatestTranscript,
    handleTranscriptScroll,
  } = useAgentTranscriptShellState({
    turnCount: turns.length,
    pending,
    toolDecisionBusyKey,
    workbenchMode,
    sessionId,
  });
  const composerRef = useRef<HTMLTextAreaElement | null>(null);

  useAgentTargetCatalogSync({
    availableTargets,
    setAvailableTargets,
    selectedTargetId,
    setSelectedTargetId,
  });

  const selectedTarget = useMemo(
    () =>
      agentTargets.find((target) => target.id === selectedTargetId) ||
      agentTargets[0],
    [agentTargets, selectedTargetId],
  );
  const compareLaneCount = useMemo(
    () => countSelectedCompareLanes(agentTargets, compareTargetIds),
    [agentTargets, compareTargetIds],
  );
  const { historyMessages, lastTurn, lastChatTurn, toolRunCount } = useMemo(
    () => buildAgentConversationSelectors(turns, selectedTargetId),
    [selectedTargetId, turns],
  );
  const {
    preferencePort: compareSessionPreferencePort,
    reproduceRequestArtifacts: compareReproduceRequestArtifacts,
  } = useEmbeddedCompareSessionAdapter({
    agentTargets,
    maxCompareLanes: MAX_COMPARE_LANES,
    targetState: compareTargetState,
    promptState: comparePromptState,
    runState: compareRunState,
    benchmarkState: compareBenchmarkState,
    prompt: {
      input,
      historyMessages,
      systemPrompt,
      contextWindow,
      enableTools,
      enableRetrieval,
      providerProfile,
      thinkingMode,
    },
  });
  const reproduceRequestArtifacts = useMemo(() => {
    return workbenchMode === "compare"
      ? compareReproduceRequestArtifacts
      : buildReproduceRequestArtifacts({
          mode: "chat",
          targetId: selectedTargetId,
          input,
          historyMessages,
          systemPrompt,
          contextWindow,
          enableTools,
          enableRetrieval,
          providerProfile,
          thinkingMode,
        });
  }, [
    compareReproduceRequestArtifacts,
    contextWindow,
    enableRetrieval,
    enableTools,
    historyMessages,
    input,
    providerProfile,
    selectedTargetId,
    systemPrompt,
    thinkingMode,
    workbenchMode,
  ]);
  const {
    runtimePhase,
    runtimeStageItems,
    loadedAliasForSelectedTarget,
    gatewayLoadedOtherAlias,
    runtimeGuardrailBlocked,
    runtimeGuardrailCaution,
    selectedTargetLastSwitchMs,
    selectedTargetLastSwitchAt,
  } = useMemo(
    () =>
      buildAgentRuntimeViewModel({
        runtimeStatus,
        locale,
        selectedTargetId,
        lastSwitchMsByTarget: runtimeLastSwitchMsByTarget,
        lastSwitchAtByTarget: runtimeLastSwitchAtByTarget,
      }),
    [
      locale,
      runtimeLastSwitchAtByTarget,
      runtimeLastSwitchMsByTarget,
      runtimeStatus,
      selectedTargetId,
    ],
  );
  const supportsConnectionCheck =
    selectedTarget.execution === "remote" && Boolean(selectedTarget.apiKeyEnv);
  const connectionCheck =
    connectionShell.connectionChecksByTargetId[selectedTargetId] || null;
  const sessionSyncLabel = useMemo(
    () =>
      buildAgentSessionSyncLabel({
        locale,
        state: serverSessionSyncState,
        conflict: sessionSyncConflict,
      }),
    [locale, serverSessionSyncState, sessionSyncConflict],
  );
  const uiText = useMemo(() => getAgentWorkbenchCopy(locale), [locale]);
  const {
    replayTargetMode,
    setReplayTargetMode,
    copyState,
    handleCopy,
  } = useAgentCopyReplayState({
    copyFailedMessage: uiText.copyFailed,
    setError,
  });
  const runtimeConnectionComposition = useAgentRuntimeConnectionComposition({
    runtime: {
      target: {
        agentTargets,
        selectedTarget,
        selectedTargetId,
        thinkingMode,
      },
      pending,
      runtime: runtimeShell,
      labels: {
        runtimeFailed: uiText.runtimeFailed,
        prewarmDone: uiText.prewarmDone,
        prewarmAllDone: uiText.prewarmAllDone,
      },
      setError,
    },
    connection: {
      shell: connectionShell,
      context: {
        locale,
        selectedTarget,
        selectedTargetId,
        pending,
        supportsConnectionCheck,
      },
      mutations: {
        setAvailableTargets,
        setTurns,
      },
      labels: {
        scanFailed: locale.startsWith("en") ? "Scan failed." : "扫描失败。",
        connectionCheckFailed: uiText.connectionCheckFailed,
        attentionNeeded: uiText.attentionNeeded,
        connectionRecord: dictionary.agent.connectionRecord,
        latest: dictionary.common.latest,
        model: dictionary.common.model,
        endpoint: dictionary.common.endpoint,
        ok: dictionary.common.ok,
        failed: dictionary.common.failed,
      },
    },
  });
  const {
    loadRuntimeStatus,
    handlePrewarm,
    handlePrewarmAll,
    handleRuntimeAction,
  } = runtimeConnectionComposition.runtime;
  const {
    connectionChecksByTargetId,
    setConnectionChecksByTargetId,
    connectionCheckPending,
    connectionCheckError,
    setConnectionCheckError,
    scanTargetsPending,
    scanTargetsMessage,
    scanTargetsMessageTone,
    handleScanTargets,
    handleConnectionCheck,
  } = runtimeConnectionComposition.connection;
  const {
    sessionTargetOptions,
    currentSession,
    exportableSessions,
    sessionGroups,
    activeSessionTargetLabel,
  } = useAgentSessionSidebarSelectors({
    savedSessions,
    sessionId,
    agentTargets,
    sessionSearch,
    sessionTargetFilter,
    sessionExportScope,
    allTargetsLabel: uiText.allTargets,
  });

  const sessionApplySetters = useMemo(
    () => ({
      setTranscriptPinnedToBottom,
      setSessionId,
      setSelectedTargetId,
      setEnableTools,
      setEnableRetrieval,
      setContextWindow,
      setProviderProfile,
      setThinkingMode,
      setInput,
      setSystemPrompt,
      setTurns,
      setConnectionChecksByTargetId,
      setError,
      setRuntimeLogExcerpt,
      setToolDecisionBusyKey,
      setToolDecisionStatusByToken,
    }),
    [
      setConnectionChecksByTargetId,
      setContextWindow,
      setEnableRetrieval,
      setEnableTools,
      setError,
      setInput,
      setProviderProfile,
      setRuntimeLogExcerpt,
      setSelectedTargetId,
      setSessionId,
      setSystemPrompt,
      setThinkingMode,
      setToolDecisionBusyKey,
      setToolDecisionStatusByToken,
      setTranscriptPinnedToBottom,
      setTurns,
    ],
  );
  const preferenceApplySetters = useMemo(
    () => ({
      setSelectedTargetId,
      setWorkbenchMode,
      setEnableTools,
      setEnableRetrieval,
      setContextWindow,
      setProviderProfile,
      setThinkingMode,
    }),
    [
      setContextWindow,
      setEnableRetrieval,
      setEnableTools,
      setProviderProfile,
      setSelectedTargetId,
      setThinkingMode,
      setWorkbenchMode,
    ],
  );
  const { restoreSession, applyHydratedWorkbenchPreferences } =
    useAgentSessionApplyActions({
      agentTargets,
      locale,
      forceInitialMode,
      contextWindowOptions: CONTEXT_WINDOW_OPTIONS,
      providerProfileOptions: PROVIDER_PROFILE_OPTIONS,
      thinkingModeOptions: THINKING_MODE_OPTIONS,
      compareSessionPreferencePort,
      sessionSetters: sessionApplySetters,
      preferenceSetters: preferenceApplySetters,
    });

  const {
    handleReloadServerSessionSnapshot,
  } = useAgentSessionHydration({
    savedSessions,
    setSavedSessions,
    applyHydratedWorkbenchPreferences,
    restoreSession,
    setServerSessionSyncState,
    setServerSnapshotUpdatedAt,
    setSessionSyncConflict,
    setRuntimeLastSwitchMsByTarget,
    setRuntimeLastSwitchAtByTarget,
    setPreferencesReady,
  });

  const {
    startNewSession,
    renameSession: handleRenameSession,
    togglePinSession: handleTogglePinSession,
    deleteSession: handleDeleteSession,
    bulkClearSessions: handleBulkClearSessions,
    exportSessions: handleExportSessions,
  } = useAgentSessionCommandActions({
    locale,
    sessionId,
    savedSessions,
    exportableSessions,
    sessionExportScope,
    sessionTargetFilter,
    sessionSearch,
    renamePrompt: uiText.renameSession,
    deleteConfirmation: uiText.deleteSessionConfirm,
    restoreSession,
    setSavedSessions,
    setTranscriptPinnedToBottom,
    setSessionId,
    setTurns,
    setInput,
    setError,
    setRuntimeLogExcerpt,
    setToolDecisionBusyKey,
    setToolDecisionStatusByToken,
    setConnectionChecksByTargetId,
    setSystemPrompt,
    setProviderProfile,
    setThinkingMode,
  });

  useEffect(() => {
    setConnectionCheckError("");
    setPrewarmMessage("");
    setRuntimeLogExcerpt("");
  }, [selectedTargetId]);

  useEffect(() => {
    const next = clampUiContextWindow(
      selectedTargetId,
      contextWindow,
      enableTools,
      enableRetrieval,
    );
    if (next !== contextWindow) {
      setContextWindow(next);
    }
  }, [contextWindow, enableRetrieval, enableTools, selectedTargetId]);

  useAgentLocaleDefaultSync({
    locale,
    starterPrompts,
    setSystemPrompt,
    setInput,
  });

  const {
    preferenceState: agentSessionPreferenceState,
    activeSessionState: agentActiveSessionState,
  } = useAgentSessionSyncProjections({
    preference: {
      selectedTargetId,
      workbenchMode,
      compareSessionPreferencePort,
      enableTools,
      enableRetrieval,
      contextWindow,
      providerProfile,
      thinkingMode,
    },
    active: {
      sessionId,
      input,
      systemPrompt,
      turns,
      connectionChecksByTargetId,
    },
  });

  const {
    handleForceOverwriteServerSessionSnapshot,
  } = useAgentSessionServerSync({
    preferencesReady,
    preferenceState: agentSessionPreferenceState,
    activeSessionState: agentActiveSessionState,
    savedSessions,
    setSavedSessions,
    serverSnapshotUpdatedAt,
    setServerSnapshotUpdatedAt,
    setServerSessionSyncState,
    setSessionSyncConflict,
    newSessionTitle: uiText.newSession,
  });

  useEffect(() => {
    writeRuntimeSwitchHistory({
      runtimeLastSwitchMsByTarget,
      runtimeLastSwitchAtByTarget,
    });
  }, [runtimeLastSwitchAtByTarget, runtimeLastSwitchMsByTarget]);

  const {
    runPrompt,
    handleSubmit,
    handlePrepareReplayTurn,
    handleReplayTurn,
    handleResumeAgent,
    handleComposerKeyDown,
    handleToolDecision,
  } = useAgentTurnLifecycle(buildAgentTurnLifecycleInput({
    locale,
    text: uiText,
    agentTargets,
    selectedTarget,
    selectedTargetId,
    setSelectedTargetId,
    turns,
    setTurns,
    input,
    setInput,
    systemPrompt,
    enableTools,
    enableRetrieval,
    setEnableRetrieval,
    contextWindow,
    providerProfile,
    setProviderProfile,
    thinkingMode,
    setThinkingMode,
    pending,
    setPending,
    setError,
    replayTargetMode,
    composerRef,
    setTranscriptPinnedToBottom,
    toolDecisionBusyKey,
    setToolDecisionBusyKey,
    setToolDecisionStatusByToken,
  }));
  const compareWorkbenchShellProps = useEmbeddedCompareWorkbenchAdapter({
    locale,
    sourceSurface: compareSurface,
    agentTargets,
    historyMessages,
    maxCompareLanes: MAX_COMPARE_LANES,
    pending,
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
    options: {
      contextWindowOptions: CONTEXT_WINDOW_OPTIONS,
      providerProfileOptions: PROVIDER_PROFILE_OPTIONS,
      thinkingModeOptions: THINKING_MODE_OPTIONS,
    },
    copyState,
    copyText: handleCopy,
  });

  const { handleExportTurns } = useAgentTranscriptExportActions({
    turns,
    selectedTargetId,
  });

  const sidebarComposition = buildAgentSidebarComposition({
    shell: dictionary.agent.shell,
    title: dictionary.agent.title,
    subtitle: dictionary.agent.subtitle,
    targets: dictionary.agent.targets,
    model: dictionary.common.model,
    local: dictionary.common.local,
    remote: dictionary.common.remote,
    healthHealthy: dictionary.agent.healthHealthy,
    healthWarning: dictionary.agent.healthWarning,
    healthDegraded: dictionary.agent.healthDegraded,
    healthUnknown: dictionary.agent.healthUnknown,
  });
  const runtimeRailText = buildRuntimeStatusRailText({
    runtimeSerializing: uiText.runtimeSerializing,
    runtimeReady: uiText.runtimeReady,
    runtimeUnavailable: uiText.runtimeUnavailable,
    runtimeCurrentLoaded: uiText.runtimeCurrentLoaded,
    runtimeSwitchingNow: uiText.runtimeSwitchingNow,
    runtimeLastSwitchLoad: uiText.runtimeLastSwitchLoad,
    runtimeLastSwitchAt: uiText.runtimeLastSwitchAt,
    runtimeLoadingElapsed: uiText.runtimeLoadingElapsed,
    runtimeLoadingError: uiText.runtimeLoadingError,
    queueLabel: uiText.queueLabel,
    activeLabel: uiText.activeLabel,
    prewarmingAll: uiText.prewarmingAll,
    prewarmAllModels: uiText.prewarmAllModels,
    prewarming: uiText.prewarming,
    prewarmModel: uiText.prewarmModel,
    releasingModel: uiText.releasingModel,
    releaseModel: uiText.releaseModel,
    restartingGateway: uiText.restartingGateway,
    restartGateway: uiText.restartGateway,
    thinkingModeStandard: uiText.thinkingModeStandard,
    thinkingModeThinking: uiText.thinkingModeThinking,
    supervisor: uiText.supervisor,
    gatewayProcess: uiText.gatewayProcess,
    logExcerpt: uiText.logExcerpt,
    loadingRuntimeLog: uiText.loadingRuntimeLog,
    viewRuntimeLog: uiText.viewRuntimeLog,
    fallbackLaunchHint: uiText.fallbackLaunchHint,
  }, locale);
  const runtimeStatusRailProps = buildRuntimeStatusRailProps({
    locale,
    dictionary,
    uiText: runtimeRailText,
    workbenchMode,
    runtimeRailCollapsed,
    onToggleRuntimeRail: () =>
      setRuntimeRailCollapsed((current) => !current),
    agentTargets,
    selectedTarget,
    selectedTargetId,
    runtimeStatus,
    runtimePhase,
    runtimeStageItems,
    lastTurn,
    loadedAliasForSelectedTarget,
    gatewayLoadedOtherAlias,
    selectedTargetLastSwitchMs,
    selectedTargetLastSwitchAt,
    runtimeGuardrailBlocked,
    runtimeGuardrailCaution,
    pending,
    prewarmAllPending,
    prewarmPending,
    prewarmMessage,
    runtimeActionPending,
    runtimeLogExcerpt,
    systemPrompt,
    onSystemPromptChange: setSystemPrompt,
    supportsConnectionCheck,
    connectionCheckPending,
    connectionCheckError,
    connectionCheck,
    onConnectionCheck: handleConnectionCheck,
    onPrewarmAll: handlePrewarmAll,
    onPrewarm: handlePrewarm,
    onRuntimeAction: handleRuntimeAction,
  });
  const sessionToolsProps = buildAgentSessionToolsProps({
    locale,
    uiText,
    turns,
    savedSessions,
    currentSession,
    sessionSyncLabel,
    sessionSyncConflict,
    sessionSearch,
    sessionTargetFilter,
    sessionTargetOptions,
    sessionExportScope,
    exportableSessions,
    sessionGroups,
    activeSessionTargetLabel,
    onSessionSearchChange: setSessionSearch,
    onSessionTargetFilterChange: setSessionTargetFilter,
    onSessionExportScopeChange: setSessionExportScope,
    onRestoreSession: restoreSession,
    onRenameSession: handleRenameSession,
    onTogglePinSession: handleTogglePinSession,
    onDeleteSession: handleDeleteSession,
    onReloadServerSessionSnapshot: handleReloadServerSessionSnapshot,
    onForceOverwriteServerSessionSnapshot:
      handleForceOverwriteServerSessionSnapshot,
    onExportSessions: handleExportSessions,
    onBulkClearSessions: handleBulkClearSessions,
    onStartNewSession: startNewSession,
  });
  const transcriptProps = buildAgentTranscriptProps({
    locale,
    dictionary,
    uiText,
    turns,
    transcriptRef,
    transcriptPinnedToBottom,
    unseenTranscriptTurns,
    pending,
    pendingTargetLabel: selectedTarget.label,
    onTranscriptScroll: handleTranscriptScroll,
    onJumpToLatestTranscript: handleJumpToLatestTranscript,
    replayTargetMode,
    expandedTraceTurnId,
    expandedCitationKey,
    expandedReviewFileKey,
    workspaceFileViews,
    openWorkspaceFilePath,
    focusedWorkspaceFilePath,
    workspaceFileFocusState,
    copyState,
    toolDecisionBusyKey,
    toolDecisionStatusByToken,
    setReplayTargetMode,
    setExpandedTraceTurnId,
    setExpandedCitationKey,
    setExpandedReviewFileKey,
    onPrepareReplayTurn: handlePrepareReplayTurn,
    onReplayTurn: handleReplayTurn,
    onCopy: handleCopy,
    onOpenWorkspaceFile: handleOpenWorkspaceFile,
    onStepWorkspaceFileAnchor: handleStepWorkspaceFileAnchor,
    onToolDecision: handleToolDecision,
    onResumeAgent: handleResumeAgent,
  });
  const composerProps = buildAgentComposerProps({
    locale,
    dictionary,
    uiText: {
      activeLabel: uiText.activeLabel,
      contextWindow: uiText.contextWindow,
      enableRetrieval: uiText.enableRetrieval,
      enterHint: uiText.enterHint,
      prewarmAllModels: uiText.prewarmAllModels,
      prewarmModel: uiText.prewarmModel,
      prewarming: uiText.prewarming,
      prewarmingAll: uiText.prewarmingAll,
      queueLabel: uiText.queueLabel,
      runtimeCurrentLoaded:
        uiText.runtimeCurrentLoaded ||
        (locale.startsWith("en") ? "Loaded" : "已加载"),
      runtimeDowngradeHint: uiText.runtimeDowngradeHint,
      runtimeLoadingElapsed: uiText.runtimeLoadingElapsed,
      runtimeLoadingError: uiText.runtimeLoadingError,
      runtimeReady: uiText.runtimeReady,
      runtimeSerializing: uiText.runtimeSerializing,
      runtimeSwitchingNow:
        uiText.runtimeSwitchingNow ||
        (locale.startsWith("en") ? "Switching" : "切换中"),
      runtimeUnavailable: uiText.runtimeUnavailable,
      submit: uiText.submit,
      submitting: uiText.submitting,
    },
    composerRef,
    input,
    placeholder: starterPrompts[0],
    pending,
    error,
    turnsLength: turns.length,
    enableTools,
    enableRetrieval,
    contextWindow,
    contextWindowOptions: CONTEXT_WINDOW_OPTIONS,
    agentTargets,
    selectedTarget,
    runtimeStatus,
    runtimePhase,
    loadedAliasForSelectedTarget,
    gatewayLoadedOtherAlias,
    runtimeGuardrailBlocked,
    runtimeGuardrailCaution,
    prewarmAllPending,
    prewarmPending,
    prewarmMessage,
    runtimeActionPending,
    onSubmit: handleSubmit,
    onComposerKeyDown: handleComposerKeyDown,
    onInputChange: setInput,
    onEnableToolsChange: setEnableTools,
    onEnableRetrievalChange: setEnableRetrieval,
    onContextWindowChange: setContextWindow,
    onExportTurns: handleExportTurns,
    onStartNewSession: startNewSession,
    onPrewarmAll: handlePrewarmAll,
    onPrewarm: handlePrewarm,
  });
  const secondaryAnalysisProps = buildAgentSecondaryAnalysisProps({
    locale,
    dictionary,
    systemPrompt,
    setSystemPrompt,
    selectedTarget,
    selectedTargetId,
    runtimeStatus,
    lastTurn,
    supportsConnectionCheck,
    connectionCheckPending,
    connectionCheckError,
    connectionCheck,
    pending,
    fallbackLaunchHint: uiText.fallbackLaunchHint,
    onConnectionCheck: handleConnectionCheck,
  });
  const getCodeProps = buildAgentGetCodeProps({
    locale,
    open: getCodeOpen,
    mode: workbenchMode,
    language: getCodeLanguage,
    summary: reproduceRequestArtifacts.summary as Record<string, unknown>,
    snippets: reproduceRequestArtifacts.snippets,
    copyState,
    onClose: () => setGetCodeOpen(false),
    onLanguageChange: setGetCodeLanguage,
    onCopy: handleCopy,
  });
  const targetCatalogProps = buildAgentTargetCatalogProps({
    locale,
    targets: agentTargets,
    selectedTargetId,
    connectionChecksByTargetId,
    scanTargetsPending,
    scanTargetsMessage,
    scanTargetsMessageTone,
    onScanTargets: handleScanTargets,
    onSelectTarget: setSelectedTargetId,
    labels: sidebarComposition.targetLabels,
  });
  const targetProfileProps = buildAgentTargetProfileProps({
    locale,
    target: selectedTarget,
    runtimeStatus,
    lastChatTurn,
    contextWindow,
    contextWindowOptions: CONTEXT_WINDOW_OPTIONS,
    providerProfile,
    thinkingMode,
    enableRetrieval,
    onContextWindowChange: setContextWindow,
    onProviderProfileChange: setProviderProfile,
    onThinkingModeChange: setThinkingMode,
    text: {
      contextWindow: uiText.contextWindow,
      providerProfile: uiText.providerProfile,
      providerProfileSpeed: uiText.providerProfileSpeed,
      providerProfileBalanced: uiText.providerProfileBalanced,
      providerProfileToolFirst: uiText.providerProfileToolFirst,
      autoSpeedHint: uiText.autoSpeedHint,
      thinkingMode: uiText.thinkingMode,
      thinkingModeStandard: uiText.thinkingModeStandard,
      thinkingModeThinking: uiText.thinkingModeThinking,
      actualResolvedModel: uiText.actualResolvedModel,
      actualProviderProfile: uiText.actualProviderProfile,
      actualThinkingMode: uiText.actualThinkingMode,
      thinkingModelFallback: uiText.thinkingModelFallback,
      enableRetrieval: uiText.enableRetrieval,
      enabled: uiText.enabled,
      disabled: uiText.disabled,
      retrievalHint: uiText.retrievalHint,
    },
  });
  const headerProps = buildAgentWorkbenchHeaderProps({
    locale,
    dictionary,
    target: selectedTarget,
    mode: workbenchMode,
    messageCount: historyMessages.length,
    turnCount: turns.length,
    activityCount:
      workbenchMode === "compare" ? compareLaneCount : toolRunCount,
    onModeChange: setWorkbenchMode,
    onOpenGetCode: () => setGetCodeOpen(true),
  });
  const statusBandProps = buildAgentWorkbenchStatusBandProps({
    locale,
    dictionary,
    text: {
      selectedTargetLabel: uiText.selectedTargetLabel,
      executionMode: uiText.executionMode,
      contextWindow: uiText.contextWindow,
      toolLoopState: uiText.toolLoopState,
      enableRetrieval: uiText.enableRetrieval,
      enabled: uiText.enabled,
      disabled: uiText.disabled,
      loadedAlias: uiText.loadedAlias,
      runtimeCurrentLoaded:
        uiText.runtimeCurrentLoaded ||
        (locale.startsWith("en") ? "Loaded" : "已加载"),
      runtimeBusy: dictionary.agent.runtimeBusy,
      runtimeIdle: dictionary.agent.runtimeIdle,
      runtimeOffline: dictionary.agent.runtimeOffline,
      queueLabel: uiText.queueLabel,
      runtimeSwitchingNow:
        uiText.runtimeSwitchingNow ||
        (locale.startsWith("en") ? "Switching" : "切换中"),
      runtimeLoadingElapsed: uiText.runtimeLoadingElapsed,
      runtimeLastSwitchLoad:
        uiText.runtimeLastSwitchLoad ||
        (locale.startsWith("en") ? "Last load" : "最近加载"),
      runtimeLastSwitchAt:
        uiText.runtimeLastSwitchAt ||
        (locale.startsWith("en") ? "Last switch at" : "最近切换"),
      runtimeLoadingError: uiText.runtimeLoadingError,
      prewarmModel: uiText.prewarmModel,
    },
    mode: workbenchMode,
    target: selectedTarget,
    targets: agentTargets,
    contextWindowLabel: formatContextWindowLabel(contextWindow),
    enableTools,
    enableRetrieval,
    loadedAlias: loadedAliasForSelectedTarget,
    gatewayLoadedOtherAlias,
    compareLaneCount,
    runtimeStatus,
    selectedTargetLastSwitchMs,
    selectedTargetLastSwitchAt,
    prewarmMessage,
  });
  const promptStripProps = buildAgentWorkbenchPromptStripProps({
    locale,
    mode: workbenchMode,
    starterPrompts,
    onSelectPrompt: setInput,
  });
  const workbenchLayoutProps = buildAgentWorkbenchLayoutProps({
    sidebarIdentity: sidebarComposition.identity,
    sidebarContentProps: {
      locale,
      targetCatalogProps,
      targetProfileProps,
      sessionToolsProps,
    },
    mainProps: {
      mode: workbenchMode,
      headerProps,
      statusBandProps,
      promptStripProps,
      modeContentProps: {
        mode: workbenchMode,
        transcriptProps,
        composerProps,
        secondaryAnalysisProps,
        compareContent: (
          <CompareWorkbenchPortal {...compareWorkbenchShellProps} />
        ),
      },
      runtimeRailProps: runtimeStatusRailProps,
    },
    getCodeProps,
  });

  return <AgentWorkbenchLayout {...workbenchLayoutProps} />;
}
