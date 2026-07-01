"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AgentGetCodePanel } from "@/components/agent/AgentGetCodePanel";
import {
  agentTargets as builtinAgentTargets,
  agentToolSpecs,
} from "@/lib/agent/catalog";
import {
  buildSessionExportEnvelope,
  flattenTurns,
  MAX_STORED_SESSIONS,
  serializeSessionsAsMarkdown,
  serializeTurnsAsMarkdown,
  sortSessions,
  type AgentTurn,
  type StoredAgentSession,
} from "@/features/agent/session-model";
import { AgentComposerForm } from "@/features/agent/agent-composer-form";
import { AgentSecondaryAnalysisPanel } from "@/features/agent/secondary-analysis-panel";
import { AgentSessionToolsPanel } from "@/features/agent/session-tools-panel";
import { AgentTranscriptPanel } from "@/features/agent/agent-transcript-panel";
import { writeLocalAgentSessions } from "@/features/agent/session-persistence";
import {
  applyStoredAgentSession,
  applyStoredAgentWorkbenchPreferences,
} from "@/features/agent/session-apply";
import { useAgentConnectionActions } from "@/features/agent/connection-actions";
import { useAgentConnectionShellState } from "@/features/agent/connection-shell-state";
import { useAgentCopyReplayState } from "@/features/agent/copy-replay-state";
import { useAgentRuntimeActions } from "@/features/agent/runtime-actions";
import { RuntimeStatusRail } from "@/features/agent/runtime-status-rail";
import {
  describeRuntimeAlias,
  formatRuntimeDuration,
  formatRuntimeTimestamp,
} from "@/features/agent/runtime-formatters";
import { buildAgentRuntimeViewModel } from "@/features/agent/runtime-view-model";
import {
  useAgentSessionHydration,
  writeRuntimeSwitchHistory,
} from "@/features/agent/session-hydration";
import { useAgentSessionServerSync } from "@/features/agent/session-server-sync";
import { useAgentSessionSidebarSelectors } from "@/features/agent/session-sidebar-selectors";
import { TargetCatalogPanel } from "@/features/agent/target-catalog-panel";
import { useAgentWorkbenchShellState } from "@/features/agent/workbench-shell-state";
import { useAgentRuntimeShellState } from "@/features/agent/runtime-shell-state";
import { useAgentTranscriptShellState } from "@/features/agent/transcript-shell-state";
import { useAgentWorkspaceFileActions } from "@/features/agent/workspace-file-actions";
import { useAgentTurnLifecycle } from "@/features/agent/turn-lifecycle";
import { useLocale } from "@/components/layout/LocaleProvider";
import { CompareWorkbenchPortal } from "@/features/compare/CompareWorkbenchPortal";
import { useEmbeddedCompareSessionAdapter } from "@/features/compare/embedded-session-adapter";
import { useEmbeddedCompareWorkbenchAdapter } from "@/features/compare/embedded-workbench-adapter";
import { useCompareWorkbenchStateModel } from "@/features/compare/workbench-state-model";
import {
  getDefaultSystemPromptForLocale,
  getLocalizedStarterPrompts,
  getLocalizedToolDescription,
} from "@/lib/i18n";
import { clampContextWindowForTarget } from "@/lib/agent/metrics";
import { sanitizeDisplayPath } from "@/lib/agent/path-display";
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
  AgentTarget,
  AgentWorkbenchMode,
  AgentWorkbenchSessionConflict,
  AgentWorkbenchStoredPreferences,
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
  const [availableTargets, setAvailableTargets] =
    useState<AgentTarget[]>(builtinAgentTargets);
  const agentTargets = availableTargets;
  const [sessionId, setSessionId] = useState<string>(() => crypto.randomUUID());
  const [savedSessions, setSavedSessions] = useState<StoredAgentSession[]>([]);
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
  const [selectedTargetId, setSelectedTargetId] = useState("anthropic-claude");
  const [workbenchMode, setWorkbenchMode] =
    useState<AgentWorkbenchMode>(initialMode);
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
  const [turns, setTurns] = useState<AgentTurn[]>([]);
  const [input, setInput] = useState(
    () => getLocalizedStarterPrompts("zh-CN")[0],
  );
  const [systemPrompt, setSystemPrompt] = useState(() =>
    getDefaultSystemPromptForLocale("zh-CN"),
  );
  const [enableTools, setEnableTools] = useState(true);
  const [enableRetrieval, setEnableRetrieval] = useState(false);
  const [contextWindow, setContextWindow] = useState(32768);
  const [providerProfile, setProviderProfile] =
    useState<AgentProviderProfile>("balanced");
  const [thinkingMode, setThinkingMode] =
    useState<AgentThinkingMode>("standard");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const {
    runtimeStatus,
    setRuntimeStatus,
    runtimeLastSwitchMsByTarget,
    setRuntimeLastSwitchMsByTarget,
    runtimeLastSwitchAtByTarget,
    setRuntimeLastSwitchAtByTarget,
    prewarmPending,
    setPrewarmPending,
    prewarmAllPending,
    setPrewarmAllPending,
    prewarmMessage,
    setPrewarmMessage,
    runtimeActionPending,
    setRuntimeActionPending,
    runtimeLogExcerpt,
    setRuntimeLogExcerpt,
    runtimeRequestInFlightRef,
  } = useAgentRuntimeShellState();
  const [expandedCitationKey, setExpandedCitationKey] = useState("");
  const [expandedTraceTurnId, setExpandedTraceTurnId] = useState("");
  const [expandedReviewFileKey, setExpandedReviewFileKey] = useState("");
  const {
    openWorkspaceFilePath,
    focusedWorkspaceFilePath,
    workspaceFileFocusState,
    workspaceFileViews,
    handleStepWorkspaceFileAnchor,
    handleOpenWorkspaceFile,
  } = useAgentWorkspaceFileActions();
  const [toolDecisionBusyKey, setToolDecisionBusyKey] = useState("");
  const [toolDecisionStatusByToken, setToolDecisionStatusByToken] = useState<
    Record<string, "approved" | "rejected">
  >({});
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
  const {
    connectionChecksByTargetId,
    setConnectionChecksByTargetId,
    connectionCheckPending,
    setConnectionCheckPending,
    connectionCheckError,
    setConnectionCheckError,
    scanTargetsPending,
    setScanTargetsPending,
    scanTargetsMessage,
    setScanTargetsMessage,
    scanTargetsMessageTone,
    setScanTargetsMessageTone,
  } = useAgentConnectionShellState();
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [serverSessionSyncState, setServerSessionSyncState] = useState<
    "" | "syncing" | "synced" | "error"
  >("");
  const [serverSnapshotUpdatedAt, setServerSnapshotUpdatedAt] = useState<
    string | null
  >(null);
  const [sessionSyncConflict, setSessionSyncConflict] =
    useState<AgentWorkbenchSessionConflict | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);

  const loadAvailableTargets = useCallback(async () => {
    try {
      const response = await fetch("/api/agent/targets", { cache: "no-store" });
      const payload = (await response.json()) as { targets?: AgentTarget[] };
      if (
        !response.ok ||
        !Array.isArray(payload.targets) ||
        !payload.targets.length
      )
        return;
      setAvailableTargets(payload.targets);
    } catch {
      // keep builtin targets when sync fails
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

  const selectedTarget = useMemo(
    () =>
      agentTargets.find((target) => target.id === selectedTargetId) ||
      agentTargets[0],
    [agentTargets, selectedTargetId],
  );
  useEffect(() => {
    if (!agentTargets.length) return;
    if (!agentTargets.some((target) => target.id === selectedTargetId)) {
      setSelectedTargetId(agentTargets[0].id);
    }
  }, [agentTargets, selectedTargetId]);
  const compareLaneCount = useMemo(
    () =>
      agentTargets.filter((target) => compareTargetIds.includes(target.id))
        .length,
    [agentTargets, compareTargetIds],
  );
  const historyMessages = useMemo(() => flattenTurns(turns), [turns]);
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
  const lastChatTurn = useMemo(
    () =>
      [...turns]
        .reverse()
        .find(
          (turn) => turn.kind !== "check" && turn.targetId === selectedTargetId,
        ),
    [selectedTargetId, turns],
  );
  const lastTurn = turns[turns.length - 1];
  const supportsConnectionCheck =
    selectedTarget.execution === "remote" && Boolean(selectedTarget.apiKeyEnv);
  const connectionCheck = connectionChecksByTargetId[selectedTargetId] || null;
  const previousLocaleRef = useRef(locale);
  const sessionSyncLabel = useMemo(() => {
    if (sessionSyncConflict) {
      return locale.startsWith("en")
        ? "Server snapshot conflict detected"
        : "检测到服务端快照冲突";
    }
    if (serverSessionSyncState === "syncing") {
      return locale.startsWith("en")
        ? "Syncing server copy"
        : "同步服务端快照中";
    }
    if (serverSessionSyncState === "synced") {
      return locale.startsWith("en")
        ? "Server snapshot synced"
        : "服务端快照已同步";
    }
    if (serverSessionSyncState === "error") {
      return locale.startsWith("en")
        ? "Server snapshot unavailable"
        : "服务端快照暂不可用";
    }
    return locale.startsWith("en")
      ? "Local-first session storage"
      : "本地优先会话存储";
  }, [locale, serverSessionSyncState, sessionSyncConflict]);
  const uiText = useMemo(() => {
    switch (locale) {
      case "zh-TW":
        return {
          requestFailed: "請求失敗。",
          runtimeFailed: "載入執行時狀態失敗。",
          toolDecisionFailed: "工具決策失敗。",
          connectionCheckFailed: "連線自檢失敗。",
          copyFailed: "複製失敗。",
          resumeFailed: "續跑失敗。",
          noAssistantContent:
            "提供方未返回可見助手內容，請檢查目標配置後再試。",
          attentionNeeded: "一個或多個自檢階段需要注意。",
          remoteNoQueue: "遠端目標，不提供本地執行佇列。",
          runtimeSerializing: "本地執行時正在串行處理請求。",
          runtimeReady: "本地執行時已就緒。",
          runtimeUnavailable: "本地執行時不可用。",
          approve: "批准",
          approving: "批准中...",
          reject: "拒絕",
          rejecting: "拒絕中...",
          approved: "已批准",
          rejected: "已拒絕",
          confirmationRequired: "需要確認",
          token: "令牌",
          expires: "過期時間",
          resumeAgent: "續跑 Agent",
          diffPreview: "Diff 預覽",
          contentPreview: "內容預覽",
          verification: "校驗",
          repairPatch: "修復補丁",
          rejectArtifacts: "拒絕產物",
          initialFailure: "初始失敗",
          repairAttempt: "修復嘗試",
          standardOutput: "標準輸出",
          standardError: "標準錯誤",
          step: "步驟",
          verified: "已驗證",
          unverified: "未驗證",
          confirmationApproved: "此確認令牌已經批准。",
          confirmationRejected: "此確認令牌已被拒絕。",
          loadedAlias: "已載入別名",
          runtimeMessage: "執行時訊息",
          enterHint: "Enter 送出，Shift+Enter 換行",
          submit: "送出",
          submitting: "處理中...",
          queueLabel: "佇列",
          activeLabel: "活躍",
          fallbackLaunchHint: "遠端目標，不需要本地啟動命令。",
          contextWindow: "上下文體量",
          selectedTargetLabel: "目標",
          executionMode: "執行模式",
          toolLoopState: "工具迴圈",
          enableRetrieval: "檢索增強",
          retrievalHint:
            "把知識庫命中結果注入系統提示詞，要求回答盡量基於證據並附引用。",
          retrievalGrounding: "檢索證據",
          retrievalHits: "命中數",
          retrievalLowConfidence: "檢索信心偏低，回答應明確標註不確定性。",
          retrievalNoEvidence: "目前沒有可用檢索證據。",
          groundedVerification: "證據校驗",
          groundedVerdict: "校驗結論",
          groundedVerdictGrounded: "已基於證據",
          groundedVerdictWeak: "部分基於證據",
          groundedVerdictUnsupported: "證據不足",
          groundedVerdictNotApplicable: "未啟用",
          groundedFallbackApplied: "已套用保守回退",
          groundedFallbackReason: "回退原因",
          groundedCitations: "引用標籤",
          groundedUnsupportedCitations: "無效引用",
          groundedLexicalScore: "證據重合度",
          groundedNotes: "校驗說明",
          groundedReasonNoEvidence: "沒有檢索到可用證據",
          groundedReasonLowConfidence: "檢索信心偏低",
          groundedReasonMissingCitations: "回答缺少引用",
          groundedReasonUnsupportedClaims: "回答與證據不匹配",
          groundedNoteRetrievalDisabled: "本輪未啟用檢索增強。",
          groundedNoteNoEvidence: "本輪沒有檢索到可用證據。",
          groundedNoteUnsupportedCitations: "回答使用了無效引用標籤。",
          groundedNoteMissingCitations: "回答沒有引用檢索證據。",
          groundedNoteLowConfidence: "檢索信心偏低。",
          groundedNoteWeakOverlap: "回答與證據的詞面重合度偏弱。",
          enabled: "開啟",
          disabled: "關閉",
          runtimeSnapshot: "執行狀態快照",
          prewarmModel: "預熱模型",
          prewarmAllModels: "全部預熱",
          prewarmingAll: "全部預熱中...",
          prewarmAllDone: "全部本地模型預熱已完成。",
          prewarming: "預熱中...",
          prewarmDone: "模型預熱已完成。",
          releaseModel: "釋放模型",
          releasingModel: "釋放中...",
          restartGateway: "重啟網關",
          restartingGateway: "重啟中...",
          viewRuntimeLog: "查看日誌",
          loadingRuntimeLog: "讀取中...",
          supervisor: "守護程序",
          gatewayProcess: "網關程序",
          logExcerpt: "執行日誌",
          runtimeActions: "執行時操作",
          sessions: "會話歷史",
          newSession: "新建會話",
          restoreSession: "恢復會話",
          currentSession: "當前會話",
          sessionSaved: "已自動保存",
          noSessions: "尚無已保存會話",
          renameSession: "重命名",
          deleteSession: "刪除",
          pinSession: "固定",
          unpinSession: "取消固定",
          pinned: "已固定",
          deleteSessionConfirm: "確定刪除此會話？",
          sessionSearch: "搜索会话",
          clearAllSessions: "清空全部",
          clearUnpinnedSessions: "清空未固定",
          targetGroup: "目标分组",
          sessionTargetFilter: "会话目标过滤",
          allTargets: "全部目标",
          exportSessionsMarkdown: "导出会话 Markdown",
          exportSessionsJson: "导出会话 JSON",
          sessionExportScope: "导出范围",
          exportVisibleSessions: "仅当前筛选可见项",
          exportPinnedSessions: "仅固定项",
          providerProfile: "远端提供方档位",
          providerProfileSpeed: "极速",
          providerProfileBalanced: "平衡",
          providerProfileToolFirst: "工具优先",
          autoSpeedHint:
            "短问答且无工具意图时，会自动降到 speed 以压首字延时。",
          thinkingMode: "思考模式",
          thinkingModeStandard: "标准",
          thinkingModeThinking: "Thinking / 满血版",
          actualResolvedModel: "当前实际解析模型",
          actualProviderProfile: "本次实际采用档位",
          actualThinkingMode: "本次实际采用思考模式",
          fallbackBadge: "已回退",
          thinkingModelFallback:
            "未配置专用 Thinking 模型，当前回退到标准模型。",
          latencySplit: "上游首字 vs 应用总耗时",
          appOverhead: "应用层额外耗时",
          runtimeLoading: "运行中加载",
          runtimeLoadingElapsed: "已等待",
          runtimeLoadingError: "加载错误",
          runtimeCurrentLoaded: "当前已加载",
          runtimeSwitchingNow: "正在切模",
          runtimeLastSwitchLoad: "最近切换耗时",
          runtimeLastSwitchAt: "最近切模时间",
          runtimeDowngradeHint:
            "本地 4B 仍在冷加载时，简单问答会自动降到 0.6B 以先给出结果。",
          localFallbackUsed: "本地自动降级",
          localFallbackTarget: "降级目标",
          localFallbackReason: "降级原因",
          localFallbackReasonLoading: "本地 4B 仍在加载",
          localFallbackReasonHealth: "本地 4B 运行时告警",
          localFallbackReasonEmpty: "本地 4B 返回空可见答案",
          localFallbackReasonFailure: "本地 4B 请求失败",
          localFallbackReasonSimple: "简单问答优先走已预热 0.6B",
        };
      case "ko":
        return {
          requestFailed: "요청에 실패했습니다.",
          runtimeFailed: "런타임 상태를 불러오지 못했습니다.",
          toolDecisionFailed: "도구 결정에 실패했습니다.",
          connectionCheckFailed: "연결 점검에 실패했습니다.",
          copyFailed: "복사에 실패했습니다.",
          resumeFailed: "이어 실행에 실패했습니다.",
          noAssistantContent:
            "표시 가능한 응답이 없습니다. 대상 설정을 확인하세요.",
          attentionNeeded: "하나 이상의 자가 진단 단계에 주의가 필요합니다.",
          remoteNoQueue: "원격 대상이므로 로컬 실행 대기열이 없습니다.",
          runtimeSerializing: "로컬 런타임이 요청을 직렬 처리 중입니다.",
          runtimeReady: "로컬 런타임이 준비되었습니다.",
          runtimeUnavailable: "로컬 런타임을 사용할 수 없습니다.",
          approve: "승인",
          approving: "승인 중...",
          reject: "거부",
          rejecting: "거부 중...",
          approved: "승인됨",
          rejected: "거부됨",
          confirmationRequired: "확인 필요",
          token: "토큰",
          expires: "만료 시각",
          resumeAgent: "Agent 이어 실행",
          diffPreview: "Diff 미리보기",
          contentPreview: "내용 미리보기",
          verification: "검증",
          repairPatch: "복구 패치",
          rejectArtifacts: "거부 산출물",
          initialFailure: "초기 실패",
          repairAttempt: "복구 시도",
          standardOutput: "표준 출력",
          standardError: "표준 오류",
          step: "단계",
          verified: "검증됨",
          unverified: "미검증",
          confirmationApproved: "이 확인 토큰은 이미 승인되었습니다.",
          confirmationRejected: "이 확인 토큰은 거부되었습니다.",
          loadedAlias: "로드된 별칭",
          runtimeMessage: "런타임 메시지",
          enterHint: "Enter 전송, Shift+Enter 줄바꿈",
          submit: "전송",
          submitting: "처리 중...",
          queueLabel: "대기열",
          activeLabel: "활성",
          fallbackLaunchHint:
            "원격 대상이므로 로컬 부트스트랩 명령이 필요하지 않습니다.",
          contextWindow: "컨텍스트 크기",
          selectedTargetLabel: "대상",
          executionMode: "실행 모드",
          toolLoopState: "도구 루프",
          enableRetrieval: "검색 증강",
          retrievalHint:
            "지식 베이스 검색 결과를 시스템 프롬프트에 주입해 근거 중심 응답과 인용을 유도합니다.",
          retrievalGrounding: "검색 근거",
          retrievalHits: "히트 수",
          retrievalLowConfidence:
            "검색 신뢰도가 낮습니다. 답변에서 불확실성을 분명히 밝혀야 합니다.",
          retrievalNoEvidence: "사용 가능한 검색 근거가 없습니다.",
          groundedVerification: "근거 검증",
          groundedVerdict: "검증 결과",
          groundedVerdictGrounded: "근거 기반",
          groundedVerdictWeak: "부분 근거 기반",
          groundedVerdictUnsupported: "근거 부족",
          groundedVerdictNotApplicable: "적용 안 됨",
          groundedFallbackApplied: "보수적 폴백 적용됨",
          groundedFallbackReason: "폴백 사유",
          groundedCitations: "인용 라벨",
          groundedUnsupportedCitations: "유효하지 않은 인용",
          groundedLexicalScore: "근거 중복도",
          groundedNotes: "검증 메모",
          groundedReasonNoEvidence: "사용 가능한 검색 근거 없음",
          groundedReasonLowConfidence: "검색 신뢰도 낮음",
          groundedReasonMissingCitations: "응답에 인용 없음",
          groundedReasonUnsupportedClaims: "응답이 근거와 맞지 않음",
          groundedNoteRetrievalDisabled:
            "이 턴에서는 검색 증강이 비활성화되었습니다.",
          groundedNoteNoEvidence: "이 턴에서는 검색 근거가 없었습니다.",
          groundedNoteUnsupportedCitations:
            "응답에 유효하지 않은 인용 라벨이 있습니다.",
          groundedNoteMissingCitations: "응답에 검색 근거 인용이 없습니다.",
          groundedNoteLowConfidence: "검색 신뢰도가 낮았습니다.",
          groundedNoteWeakOverlap: "응답과 근거의 어휘 중복이 약합니다.",
          enabled: "켜짐",
          disabled: "꺼짐",
          runtimeSnapshot: "런타임 상태 요약",
          prewarmModel: "모델 예열",
          prewarmAllModels: "전체 예열",
          prewarmingAll: "전체 예열 중...",
          prewarmAllDone: "모든 로컬 모델 예열이 완료되었습니다.",
          prewarming: "예열 중...",
          prewarmDone: "모델 예열이 완료되었습니다.",
          releaseModel: "모델 해제",
          releasingModel: "해제 중...",
          restartGateway: "게이트웨이 재시작",
          restartingGateway: "재시작 중...",
          viewRuntimeLog: "로그 보기",
          loadingRuntimeLog: "불러오는 중...",
          supervisor: "슈퍼바이저",
          gatewayProcess: "게이트웨이 프로세스",
          logExcerpt: "실행 로그",
          runtimeActions: "런타임 작업",
          sessions: "세션 기록",
          newSession: "새 세션",
          restoreSession: "세션 복원",
          currentSession: "현재 세션",
          sessionSaved: "자동 저장됨",
          noSessions: "저장된 세션이 없습니다",
          renameSession: "이름 변경",
          deleteSession: "삭제",
          pinSession: "고정",
          unpinSession: "고정 해제",
          pinned: "고정됨",
          deleteSessionConfirm: "이 세션을 삭제하시겠습니까?",
          sessionSearch: "세션 검색",
          clearAllSessions: "전체 삭제",
          clearUnpinnedSessions: "고정 해제 항목 삭제",
          targetGroup: "대상 그룹",
          sessionTargetFilter: "세션 대상 필터",
          allTargets: "전체 대상",
          exportSessionsMarkdown: "세션 Markdown 내보내기",
          exportSessionsJson: "세션 JSON 내보내기",
          sessionExportScope: "내보내기 범위",
          exportVisibleSessions: "현재 필터 결과만",
          exportPinnedSessions: "고정 항목만",
          providerProfile: "원격 제공자 프로필",
          providerProfileSpeed: "속도 우선",
          providerProfileBalanced: "균형",
          providerProfileToolFirst: "도구 우선",
          autoSpeedHint:
            "짧은 질의이고 도구 의도가 없으면 첫 토큰 지연을 줄이기 위해 자동으로 speed로 내려갑니다.",
          thinkingMode: "사고 모드",
          thinkingModeStandard: "표준",
          thinkingModeThinking: "Thinking / 풀 버전",
          actualResolvedModel: "현재 실제 해석 모델",
          actualProviderProfile: "이번 요청의 실제 프로필",
          actualThinkingMode: "이번 요청의 실제 사고 모드",
          fallbackBadge: "폴백",
          thinkingModelFallback:
            "전용 Thinking 모델이 없어 현재 표준 모델로 대체됩니다.",
          latencySplit: "업스트림 첫 토큰 vs 앱 총 지연",
          appOverhead: "앱 추가 지연",
          runtimeLoading: "로딩 중",
          runtimeLoadingElapsed: "대기 시간",
          runtimeLoadingError: "로딩 오류",
          runtimeCurrentLoaded: "현재 로드됨",
          runtimeSwitchingNow: "전환 중",
          runtimeLastSwitchLoad: "최근 전환 시간",
          runtimeLastSwitchAt: "최근 전환 시각",
          runtimeDowngradeHint:
            "로컬 4B가 아직 콜드 로딩 중이면 간단한 질문은 0.6B로 자동 낮춰 먼저 응답합니다.",
          localFallbackUsed: "로컬 자동 강등",
          localFallbackTarget: "강등 대상",
          localFallbackReason: "강등 사유",
          localFallbackReasonLoading: "로컬 4B가 아직 로딩 중",
          localFallbackReasonHealth: "로컬 4B 런타임 경고",
          localFallbackReasonEmpty: "로컬 4B가 빈 가시 응답을 반환",
          localFallbackReasonFailure: "로컬 4B 요청 실패",
          localFallbackReasonSimple: "간단한 질문을 위해 미리 예열된 0.6B 사용",
        };
      case "ja":
        return {
          requestFailed: "リクエストに失敗しました。",
          runtimeFailed: "ランタイム状態の取得に失敗しました。",
          toolDecisionFailed: "ツール判断に失敗しました。",
          connectionCheckFailed: "接続チェックに失敗しました。",
          copyFailed: "コピーに失敗しました。",
          resumeFailed: "再開に失敗しました。",
          noAssistantContent:
            "表示可能な応答がありません。ターゲット設定を確認してください。",
          attentionNeeded: "セルフチェックの一部ステージに注意が必要です。",
          remoteNoQueue:
            "リモートターゲットのため、ローカル実行キューはありません。",
          runtimeSerializing:
            "ローカル実行環境がリクエストを直列処理しています。",
          runtimeReady: "ローカル実行環境は準備完了です。",
          runtimeUnavailable: "ローカル実行環境は利用できません。",
          approve: "承認",
          approving: "承認中...",
          reject: "拒否",
          rejecting: "拒否中...",
          approved: "承認済み",
          rejected: "拒否済み",
          confirmationRequired: "確認が必要",
          token: "トークン",
          expires: "有効期限",
          resumeAgent: "Agent を再開",
          diffPreview: "Diff プレビュー",
          contentPreview: "内容プレビュー",
          verification: "検証",
          repairPatch: "修復パッチ",
          rejectArtifacts: "拒否成果物",
          initialFailure: "初回失敗",
          repairAttempt: "修復試行",
          standardOutput: "標準出力",
          standardError: "標準エラー",
          step: "ステップ",
          verified: "検証済み",
          unverified: "未検証",
          confirmationApproved: "この確認トークンはすでに承認されています。",
          confirmationRejected: "この確認トークンは拒否されています。",
          loadedAlias: "読み込み済み別名",
          runtimeMessage: "ランタイムメッセージ",
          enterHint: "Enter で送信、Shift+Enter で改行",
          submit: "送信",
          submitting: "処理中...",
          queueLabel: "キュー",
          activeLabel: "アクティブ",
          fallbackLaunchHint:
            "リモートターゲットのため、ローカル起動コマンドは不要です。",
          contextWindow: "コンテキスト量",
          selectedTargetLabel: "ターゲット",
          executionMode: "実行モード",
          toolLoopState: "ツールループ",
          enableRetrieval: "検索拡張",
          retrievalHint:
            "ナレッジベースの検索結果をシステムプロンプトに注入し、根拠付き回答と引用を促します。",
          retrievalGrounding: "検索エビデンス",
          retrievalHits: "ヒット数",
          retrievalLowConfidence:
            "検索信頼度が低いため、不確実性を明示する必要があります。",
          retrievalNoEvidence: "利用可能な検索エビデンスがありません。",
          groundedVerification: "根拠検証",
          groundedVerdict: "検証結果",
          groundedVerdictGrounded: "根拠あり",
          groundedVerdictWeak: "一部根拠あり",
          groundedVerdictUnsupported: "根拠不足",
          groundedVerdictNotApplicable: "未適用",
          groundedFallbackApplied: "保守的フォールバック適用済み",
          groundedFallbackReason: "フォールバック理由",
          groundedCitations: "引用ラベル",
          groundedUnsupportedCitations: "無効な引用",
          groundedLexicalScore: "根拠一致度",
          groundedNotes: "検証メモ",
          groundedReasonNoEvidence: "利用可能な検索根拠なし",
          groundedReasonLowConfidence: "検索信頼度が低い",
          groundedReasonMissingCitations: "回答に引用がない",
          groundedReasonUnsupportedClaims: "回答が根拠と一致しない",
          groundedNoteRetrievalDisabled: "このターンでは検索拡張が無効でした。",
          groundedNoteNoEvidence: "このターンでは検索根拠がありませんでした。",
          groundedNoteUnsupportedCitations:
            "回答に無効な引用ラベルがあります。",
          groundedNoteMissingCitations: "回答に検索根拠の引用がありません。",
          groundedNoteLowConfidence: "検索信頼度が低い状態でした。",
          groundedNoteWeakOverlap: "回答と根拠の語彙的重なりが弱いです。",
          enabled: "有効",
          disabled: "無効",
          runtimeSnapshot: "ランタイム状態サマリー",
          prewarmModel: "モデルを予熱",
          prewarmAllModels: "すべて予熱",
          prewarmingAll: "一括予熱中...",
          prewarmAllDone: "すべてのローカルモデルの予熱が完了しました。",
          prewarming: "予熱中...",
          prewarmDone: "モデルの予熱が完了しました。",
          releaseModel: "モデルを解放",
          releasingModel: "解放中...",
          restartGateway: "ゲートウェイ再起動",
          restartingGateway: "再起動中...",
          viewRuntimeLog: "ログを表示",
          loadingRuntimeLog: "読込中...",
          supervisor: "スーパーバイザー",
          gatewayProcess: "ゲートウェイプロセス",
          logExcerpt: "実行ログ",
          runtimeActions: "ランタイム操作",
          sessions: "セッション履歴",
          newSession: "新規セッション",
          restoreSession: "セッションを復元",
          currentSession: "現在のセッション",
          sessionSaved: "自動保存済み",
          noSessions: "保存されたセッションはありません",
          renameSession: "名前変更",
          deleteSession: "削除",
          pinSession: "固定",
          unpinSession: "固定解除",
          pinned: "固定済み",
          deleteSessionConfirm: "このセッションを削除しますか？",
          sessionSearch: "セッション検索",
          clearAllSessions: "すべて削除",
          clearUnpinnedSessions: "未固定を削除",
          targetGroup: "ターゲット別",
          sessionTargetFilter: "セッション対象フィルター",
          allTargets: "すべての対象",
          exportSessionsMarkdown: "セッションを Markdown で出力",
          exportSessionsJson: "セッションを JSON で出力",
          sessionExportScope: "出力範囲",
          exportVisibleSessions: "現在のフィルター結果のみ",
          exportPinnedSessions: "固定済みのみ",
          providerProfile: "リモートプロバイダープロファイル",
          providerProfileSpeed: "高速",
          providerProfileBalanced: "バランス",
          providerProfileToolFirst: "ツール優先",
          autoSpeedHint:
            "短い質問でツール意図がない場合、初回トークン遅延を抑えるため自動で speed に落とします。",
          thinkingMode: "Thinking モード",
          thinkingModeStandard: "標準",
          thinkingModeThinking: "Thinking / フル版",
          actualResolvedModel: "現在の実解決モデル",
          actualProviderProfile: "今回実際に使われたプロファイル",
          actualThinkingMode: "今回実際に使われた Thinking モード",
          fallbackBadge: "フォールバック",
          thinkingModelFallback:
            "専用 Thinking モデルが未設定のため、現在は標準モデルにフォールバックしています。",
          latencySplit: "上流の初回トークン vs アプリ総遅延",
          appOverhead: "アプリ追加遅延",
          runtimeLoading: "読み込み中",
          runtimeLoadingElapsed: "経過",
          runtimeLoadingError: "読み込みエラー",
          runtimeCurrentLoaded: "現在読み込み済み",
          runtimeSwitchingNow: "切り替え中",
          runtimeLastSwitchLoad: "直近切替時間",
          runtimeLastSwitchAt: "直近切替時刻",
          runtimeDowngradeHint:
            "ローカル 4B のコールドロード中は、簡単な質問を 0.6B に自動で落として先に応答します。",
          localFallbackUsed: "ローカル自動フォールバック",
          localFallbackTarget: "フォールバック先",
          localFallbackReason: "フォールバック理由",
          localFallbackReasonLoading: "ローカル 4B がまだ読み込み中",
          localFallbackReasonHealth: "ローカル 4B のランタイム警告",
          localFallbackReasonEmpty: "ローカル 4B が可視回答を返さなかった",
          localFallbackReasonFailure: "ローカル 4B リクエスト失敗",
          localFallbackReasonSimple: "簡単な質問は予熱済み 0.6B を優先",
        };
      case "en":
        return {
          requestFailed: "Request failed.",
          runtimeFailed: "Failed to load runtime status.",
          toolDecisionFailed: "Tool decision failed.",
          connectionCheckFailed: "Connection check failed.",
          copyFailed: "Copy failed.",
          resumeFailed: "Resume request failed.",
          noAssistantContent:
            "The provider returned no visible assistant content. Check the target configuration and try again.",
          attentionNeeded: "One or more self-check stages need attention.",
          remoteNoQueue: "Remote target. No local runtime queue.",
          runtimeSerializing: "The local runtime is serializing requests.",
          runtimeReady: "The local runtime is ready.",
          runtimeUnavailable: "The local runtime is unavailable.",
          approve: "Approve",
          approving: "Approving...",
          reject: "Reject",
          rejecting: "Rejecting...",
          approved: "Approved",
          rejected: "Rejected",
          confirmationRequired: "Confirmation Required",
          token: "Token",
          expires: "Expires",
          resumeAgent: "Resume Agent",
          diffPreview: "Diff Preview",
          contentPreview: "Content Preview",
          verification: "Verification",
          repairPatch: "Repair Patch",
          rejectArtifacts: "Reject Artifacts",
          initialFailure: "Initial Failure",
          repairAttempt: "Repair Attempt",
          standardOutput: "stdout",
          standardError: "stderr",
          step: "Step",
          verified: "Verified",
          unverified: "Unverified",
          confirmationApproved:
            "This confirmation token has already been approved.",
          confirmationRejected: "This confirmation token has been rejected.",
          loadedAlias: "Loaded Alias",
          runtimeMessage: "Message",
          enterHint: "Press Enter to send, Shift+Enter for a new line",
          submit: "Send",
          submitting: "Processing...",
          queueLabel: "Queue",
          activeLabel: "Active",
          fallbackLaunchHint:
            "Remote target. No local bootstrap command required.",
          contextWindow: "Context window",
          selectedTargetLabel: "Target",
          executionMode: "Execution mode",
          toolLoopState: "Tool loop",
          enableRetrieval: "Retrieval grounding",
          retrievalHint:
            "Inject knowledge-base hits into the system prompt and push the answer toward evidence-backed claims with citations.",
          retrievalGrounding: "Retrieved evidence",
          retrievalHits: "Hits",
          retrievalLowConfidence:
            "Retrieval confidence is low. The answer should state uncertainty explicitly.",
          retrievalNoEvidence:
            "No retrieval evidence is available for this turn.",
          groundedVerification: "Grounded verification",
          groundedVerdict: "Verification verdict",
          groundedVerdictGrounded: "Grounded",
          groundedVerdictWeak: "Weakly grounded",
          groundedVerdictUnsupported: "Unsupported",
          groundedVerdictNotApplicable: "Not applicable",
          groundedFallbackApplied: "Conservative fallback applied",
          groundedFallbackReason: "Fallback reason",
          groundedCitations: "Citation labels",
          groundedUnsupportedCitations: "Unsupported citations",
          groundedLexicalScore: "Lexical grounding score",
          groundedNotes: "Verification notes",
          groundedReasonNoEvidence: "No supporting evidence",
          groundedReasonLowConfidence: "Retrieval confidence is low",
          groundedReasonMissingCitations: "The answer is missing citations",
          groundedReasonUnsupportedClaims:
            "The answer does not match the evidence",
          groundedNoteRetrievalDisabled:
            "Retrieval grounding was disabled for this turn.",
          groundedNoteNoEvidence:
            "No retrieval evidence was available for this turn.",
          groundedNoteUnsupportedCitations:
            "The answer used unsupported citation labels.",
          groundedNoteMissingCitations:
            "The answer did not cite retrieved evidence.",
          groundedNoteLowConfidence: "Retrieval confidence was low.",
          groundedNoteWeakOverlap:
            "Lexical overlap between the answer and evidence was weak.",
          enabled: "Enabled",
          disabled: "Disabled",
          runtimeSnapshot: "Runtime snapshot",
          prewarmModel: "Prewarm model",
          prewarmAllModels: "Prewarm all",
          prewarmingAll: "Prewarming all...",
          prewarmAllDone: "All local models finished prewarming.",
          prewarming: "Prewarming...",
          prewarmDone: "Model prewarm finished.",
          releaseModel: "Release model",
          releasingModel: "Releasing...",
          restartGateway: "Restart gateway",
          restartingGateway: "Restarting...",
          viewRuntimeLog: "View log",
          loadingRuntimeLog: "Loading...",
          supervisor: "Supervisor",
          gatewayProcess: "Gateway process",
          logExcerpt: "Runtime log",
          runtimeActions: "Runtime actions",
          sessions: "Session history",
          newSession: "New session",
          restoreSession: "Restore session",
          currentSession: "Current session",
          sessionSaved: "Auto-saved",
          noSessions: "No saved sessions yet",
          renameSession: "Rename",
          deleteSession: "Delete",
          pinSession: "Pin",
          unpinSession: "Unpin",
          pinned: "Pinned",
          deleteSessionConfirm: "Delete this session?",
          sessionSearch: "Search sessions",
          clearAllSessions: "Clear all",
          clearUnpinnedSessions: "Clear unpinned",
          targetGroup: "Target groups",
          sessionTargetFilter: "Session target filter",
          allTargets: "All targets",
          exportSessionsMarkdown: "Export sessions Markdown",
          exportSessionsJson: "Export sessions JSON",
          sessionExportScope: "Export scope",
          exportVisibleSessions: "Visible filtered sessions",
          exportPinnedSessions: "Pinned only",
          providerProfile: "Remote provider profile",
          providerProfileSpeed: "Speed",
          providerProfileBalanced: "Balanced",
          providerProfileToolFirst: "Tool-first",
          autoSpeedHint:
            "Short Q&A without tool intent automatically falls back to speed to reduce first-token latency.",
          thinkingMode: "Thinking mode",
          thinkingModeStandard: "Standard",
          thinkingModeThinking: "Thinking / full model",
          actualResolvedModel: "Actual resolved model",
          actualProviderProfile: "Actual provider profile used",
          actualThinkingMode: "Actual thinking mode used",
          fallbackBadge: "Fallback",
          thinkingModelFallback:
            "No dedicated thinking model is configured. Falling back to the standard model.",
          latencySplit: "Upstream first token vs app total latency",
          appOverhead: "App overhead",
          runtimeLoading: "Loading",
          runtimeLoadingElapsed: "Elapsed",
          runtimeLoadingError: "Loading error",
          runtimeCurrentLoaded: "Currently loaded",
          runtimeSwitchingNow: "Switching now",
          runtimeLastSwitchLoad: "Last switch time",
          runtimeLastSwitchAt: "Last switch at",
          runtimeDowngradeHint:
            "If local 4B is still cold-loading, simple questions automatically downgrade to 0.6B so we can answer sooner.",
          localFallbackUsed: "Local auto-fallback",
          localFallbackTarget: "Fallback target",
          localFallbackReason: "Fallback reason",
          localFallbackReasonLoading: "Local 4B is still loading",
          localFallbackReasonHealth: "Local 4B runtime warning",
          localFallbackReasonEmpty: "Local 4B returned no visible answer",
          localFallbackReasonFailure: "Local 4B request failed",
          localFallbackReasonSimple: "Simple Q&A routed to prewarmed 0.6B",
        };
      case "zh-CN":
      default:
        return {
          requestFailed: "请求失败。",
          runtimeFailed: "加载运行时状态失败。",
          toolDecisionFailed: "工具决策失败。",
          connectionCheckFailed: "连接自检失败。",
          copyFailed: "复制失败。",
          resumeFailed: "续跑失败。",
          noAssistantContent:
            "提供方未返回可见助手内容，请检查目标配置后重试。",
          attentionNeeded: "一个或多个自检阶段需要关注。",
          remoteNoQueue: "远端目标，不提供本地运行队列。",
          runtimeSerializing: "本地运行时正在串行处理请求。",
          runtimeReady: "本地运行时已就绪。",
          runtimeUnavailable: "本地运行时不可用。",
          approve: "批准",
          approving: "批准中...",
          reject: "拒绝",
          rejecting: "拒绝中...",
          approved: "已批准",
          rejected: "已拒绝",
          confirmationRequired: "需要确认",
          token: "令牌",
          expires: "过期时间",
          resumeAgent: "续跑 Agent",
          diffPreview: "Diff 预览",
          contentPreview: "内容预览",
          verification: "校验",
          repairPatch: "修复补丁",
          rejectArtifacts: "拒绝产物",
          initialFailure: "初始失败",
          repairAttempt: "修复尝试",
          standardOutput: "标准输出",
          standardError: "标准错误",
          step: "步骤",
          verified: "已验证",
          unverified: "未验证",
          confirmationApproved: "该确认令牌已经批准。",
          confirmationRejected: "该确认令牌已被拒绝。",
          loadedAlias: "已加载别名",
          runtimeMessage: "运行时消息",
          enterHint: "Enter 发送，Shift+Enter 换行",
          submit: "发送",
          submitting: "处理中...",
          queueLabel: "队列",
          activeLabel: "活跃",
          fallbackLaunchHint: "远端目标，不需要本地启动命令。",
          contextWindow: "上下文体量",
          selectedTargetLabel: "目标",
          executionMode: "执行模式",
          toolLoopState: "工具循环",
          enableRetrieval: "检索增强",
          retrievalHint:
            "把知识库命中结果注入系统提示词，要求回答尽量基于证据并附引用。",
          retrievalGrounding: "检索证据",
          retrievalHits: "命中数",
          retrievalLowConfidence: "检索信心偏低，回答应明确标注不确定性。",
          retrievalNoEvidence: "当前没有可用检索证据。",
          groundedVerification: "证据校验",
          groundedVerdict: "校验结论",
          groundedVerdictGrounded: "已基于证据",
          groundedVerdictWeak: "部分基于证据",
          groundedVerdictUnsupported: "证据不足",
          groundedVerdictNotApplicable: "未启用",
          groundedFallbackApplied: "已应用保守回退",
          groundedFallbackReason: "回退原因",
          groundedCitations: "引用标签",
          groundedUnsupportedCitations: "无效引用",
          groundedLexicalScore: "证据重合度",
          groundedNotes: "校验说明",
          groundedReasonNoEvidence: "没有检索到可用证据",
          groundedReasonLowConfidence: "检索信心偏低",
          groundedReasonMissingCitations: "回答缺少引用",
          groundedReasonUnsupportedClaims: "回答与证据不匹配",
          groundedNoteRetrievalDisabled: "本轮未启用检索增强。",
          groundedNoteNoEvidence: "本轮没有检索到可用证据。",
          groundedNoteUnsupportedCitations: "回答使用了无效引用标签。",
          groundedNoteMissingCitations: "回答没有引用检索证据。",
          groundedNoteLowConfidence: "检索信心偏低。",
          groundedNoteWeakOverlap: "回答与证据的词面重合度偏弱。",
          enabled: "开启",
          disabled: "关闭",
          runtimeSnapshot: "运行状态快照",
          prewarmModel: "预热模型",
          prewarmAllModels: "全部预热",
          prewarmingAll: "全部预热中...",
          prewarmAllDone: "全部本地模型预热已完成。",
          prewarming: "预热中...",
          prewarmDone: "模型预热已完成。",
          releaseModel: "释放模型",
          releasingModel: "释放中...",
          restartGateway: "重启网关",
          restartingGateway: "重启中...",
          viewRuntimeLog: "查看日志",
          loadingRuntimeLog: "读取中...",
          supervisor: "守护进程",
          gatewayProcess: "网关进程",
          logExcerpt: "运行日志",
          runtimeActions: "运行时操作",
          sessions: "会话历史",
          newSession: "新建会话",
          restoreSession: "恢复会话",
          currentSession: "当前会话",
          sessionSaved: "已自动保存",
          noSessions: "还没有已保存会话",
          renameSession: "重命名",
          deleteSession: "删除",
          pinSession: "固定",
          unpinSession: "取消固定",
          pinned: "已固定",
          deleteSessionConfirm: "确定删除这个会话？",
          sessionSearch: "搜索会话",
          clearAllSessions: "清空全部",
          clearUnpinnedSessions: "清空未固定",
          targetGroup: "目标分组",
          sessionTargetFilter: "会话目标过滤",
          allTargets: "全部目标",
          exportSessionsMarkdown: "导出会话 Markdown",
          exportSessionsJson: "导出会话 JSON",
          sessionExportScope: "导出范围",
          exportVisibleSessions: "仅当前筛选可见项",
          exportPinnedSessions: "仅固定项",
          providerProfile: "远端提供方档位",
          providerProfileSpeed: "极速",
          providerProfileBalanced: "平衡",
          providerProfileToolFirst: "工具优先",
          autoSpeedHint:
            "短问答且无工具意图时，会自动降到 speed 以压首字延时。",
          thinkingMode: "思考模式",
          thinkingModeStandard: "标准",
          thinkingModeThinking: "Thinking / 满血版",
          actualResolvedModel: "当前实际解析模型",
          actualProviderProfile: "本次实际采用档位",
          actualThinkingMode: "本次实际采用思考模式",
          fallbackBadge: "已回退",
          thinkingModelFallback:
            "未配置专用 Thinking 模型，当前回退到标准模型。",
          latencySplit: "上游首字 vs 应用总耗时",
          appOverhead: "应用层额外耗时",
          runtimeLoading: "运行中加载",
          runtimeLoadingElapsed: "已等待",
          runtimeLoadingError: "加载错误",
          runtimeDowngradeHint:
            "本地 4B 仍在冷加载时，简单问答会自动降到 0.6B 以先给出结果。",
          localFallbackUsed: "本地自动降级",
          localFallbackTarget: "降级目标",
          localFallbackReason: "降级原因",
          localFallbackReasonLoading: "本地 4B 仍在加载",
          localFallbackReasonHealth: "本地 4B 运行时告警",
          localFallbackReasonEmpty: "本地 4B 返回空可见答案",
          localFallbackReasonFailure: "本地 4B 请求失败",
          localFallbackReasonSimple: "简单问答优先走已预热 0.6B",
        };
    }
  }, [locale]);
  const {
    replayTargetMode,
    setReplayTargetMode,
    copyState,
    handleCopy,
  } = useAgentCopyReplayState({
    copyFailedMessage: uiText.copyFailed,
    setError,
  });
  const {
    loadRuntimeStatus,
    handlePrewarm,
    handlePrewarmAll,
    handleRuntimeAction,
  } = useAgentRuntimeActions({
    target: {
      agentTargets,
      selectedTarget,
      selectedTargetId,
      thinkingMode,
    },
    state: {
      pending,
      runtimeStatus,
      runtimeRequestInFlightRef,
      prewarmPending,
      prewarmAllPending,
      runtimeActionPending,
    },
    mutations: {
      setRuntimeStatus,
      setPrewarmPending,
      setPrewarmAllPending,
      setPrewarmMessage,
      setRuntimeActionPending,
      setRuntimeLogExcerpt,
      setRuntimeLastSwitchMsByTarget,
      setRuntimeLastSwitchAtByTarget,
      setError,
    },
    labels: {
      runtimeFailed: uiText.runtimeFailed,
      prewarmDone: uiText.prewarmDone,
      prewarmAllDone: uiText.prewarmAllDone,
    },
  });
  const { handleScanTargets, handleConnectionCheck } =
    useAgentConnectionActions({
      context: {
        locale,
        selectedTarget,
        selectedTargetId,
        pending,
        supportsConnectionCheck,
      },
      state: {
        scanTargetsPending,
        connectionCheckPending,
      },
      mutations: {
        setScanTargetsPending,
        setScanTargetsMessage,
        setScanTargetsMessageTone,
        setConnectionCheckPending,
        setConnectionCheckError,
        setConnectionChecksByTargetId,
        setAvailableTargets,
        setTurns,
        loadRuntimeStatus,
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
    });
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

  const restoreSession = useCallback(
    (session: StoredAgentSession) => {
      applyStoredAgentSession({
        session,
        agentTargets,
        locale,
        contextWindowOptions: CONTEXT_WINDOW_OPTIONS,
        providerProfileOptions: PROVIDER_PROFILE_OPTIONS,
        thinkingModeOptions: THINKING_MODE_OPTIONS,
        setters: {
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
        },
      });
    },
    [agentTargets, locale],
  );

  const applyHydratedWorkbenchPreferences = useCallback(
    (preferences: AgentWorkbenchStoredPreferences | null) => {
      applyStoredAgentWorkbenchPreferences({
        preferences,
        agentTargets,
        forceInitialMode,
        contextWindowOptions: CONTEXT_WINDOW_OPTIONS,
        providerProfileOptions: PROVIDER_PROFILE_OPTIONS,
        thinkingModeOptions: THINKING_MODE_OPTIONS,
        compareSessionPreferencePort,
        setters: {
          setSelectedTargetId,
          setWorkbenchMode,
          setEnableTools,
          setEnableRetrieval,
          setContextWindow,
          setProviderProfile,
          setThinkingMode,
        },
      });
    },
    [
      agentTargets,
      compareSessionPreferencePort,
      forceInitialMode,
    ],
  );

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

  function updateSessions(
    updater: (current: StoredAgentSession[]) => StoredAgentSession[],
  ) {
    setSavedSessions((current) => {
      const next = sortSessions(updater(current)).slice(0, MAX_STORED_SESSIONS);
      writeLocalAgentSessions(next);
      return next;
    });
  }

  function startNewSession() {
    setTranscriptPinnedToBottom(true);
    setSessionId(crypto.randomUUID());
    setTurns([]);
    setInput("");
    setError("");
    setRuntimeLogExcerpt("");
    setToolDecisionBusyKey("");
    setToolDecisionStatusByToken({});
    setConnectionChecksByTargetId({});
    setSystemPrompt(getDefaultSystemPromptForLocale(locale));
    setProviderProfile("balanced");
    setThinkingMode("standard");
  }

  function handleRenameSession(targetSessionId: string) {
    const session = savedSessions.find((item) => item.id === targetSessionId);
    if (!session) return;
    const nextTitle = window
      .prompt(uiText.renameSession, session.title)
      ?.trim();
    if (!nextTitle) return;
    updateSessions((current) =>
      current.map((item) =>
        item.id === targetSessionId
          ? {
              ...item,
              title: nextTitle,
              updatedAt: new Date().toISOString(),
            }
          : item,
      ),
    );
  }

  function handleTogglePinSession(targetSessionId: string) {
    updateSessions((current) =>
      current.map((item) =>
        item.id === targetSessionId
          ? {
              ...item,
              pinned: !item.pinned,
              updatedAt: new Date().toISOString(),
            }
          : item,
      ),
    );
  }

  function handleDeleteSession(targetSessionId: string) {
    const session = savedSessions.find((item) => item.id === targetSessionId);
    if (!session) return;
    if (!window.confirm(uiText.deleteSessionConfirm)) return;

    const remaining = savedSessions.filter(
      (item) => item.id !== targetSessionId,
    );
    const nextSessions = writeLocalAgentSessions(remaining);
    setSavedSessions(nextSessions);

    if (targetSessionId === sessionId) {
      if (nextSessions.length) {
        restoreSession(nextSessions[0]);
      } else {
        startNewSession();
      }
    }
  }

  function handleBulkClearSessions(mode: "all" | "unpinned") {
    const nextSessions =
      mode === "all" ? [] : savedSessions.filter((session) => session.pinned);

    const persistedSessions = writeLocalAgentSessions(nextSessions);
    setSavedSessions(persistedSessions);

    if (!persistedSessions.some((session) => session.id === sessionId)) {
      if (persistedSessions.length) {
        restoreSession(persistedSessions[0]);
      } else {
        startNewSession();
      }
    }
  }

  function handleExportSessions(format: "markdown" | "json") {
    const sessions = exportableSessions;
    if (!sessions.length) return;

    const content =
      format === "markdown"
        ? serializeSessionsAsMarkdown(sessions)
        : JSON.stringify(
            buildSessionExportEnvelope(sessions, {
              scope: sessionExportScope,
              sessionTargetFilter,
              sessionSearch,
            }),
            null,
            2,
          );

    const blob = new Blob([content], {
      type:
        format === "markdown"
          ? "text/markdown;charset=utf-8"
          : "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `agent-sessions-${sessionTargetFilter}-${Date.now()}.${format === "markdown" ? "md" : "json"}`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

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

  useEffect(() => {
    const previousLocale = previousLocaleRef.current;
    const previousDefaultPrompt =
      getDefaultSystemPromptForLocale(previousLocale);
    const nextDefaultPrompt = getDefaultSystemPromptForLocale(locale);
    setSystemPrompt((current) =>
      current === previousDefaultPrompt ? nextDefaultPrompt : current,
    );

    const previousPrompts = getLocalizedStarterPrompts(previousLocale);
    setInput((current) =>
      previousPrompts.includes(current) ? starterPrompts[0] : current,
    );
    previousLocaleRef.current = locale;
  }, [locale, starterPrompts]);

  const agentSessionPreferenceState = useMemo(
    () => ({
      selectedTargetId,
      workbenchMode,
      compareSessionPreferencePort,
      enableTools,
      enableRetrieval,
      contextWindow,
      providerProfile,
      thinkingMode,
    }),
    [
      compareSessionPreferencePort,
      contextWindow,
      enableRetrieval,
      enableTools,
      providerProfile,
      selectedTargetId,
      thinkingMode,
      workbenchMode,
    ],
  );

  const agentActiveSessionState = useMemo(
    () => ({
      sessionId,
      input,
      systemPrompt,
      turns,
      connectionChecksByTargetId,
    }),
    [connectionChecksByTargetId, input, sessionId, systemPrompt, turns],
  );

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
  } = useAgentTurnLifecycle({
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
  });
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
      workbenchMode,
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

  function handleExportTurns(format: "markdown" | "json") {
    if (!turns.length) return;

    const content =
      format === "markdown"
        ? serializeTurnsAsMarkdown(turns)
        : JSON.stringify(
            {
              generatedAt: new Date().toISOString(),
              turns,
            },
            null,
            2,
          );

    const blob = new Blob([content], {
      type:
        format === "markdown"
          ? "text/markdown;charset=utf-8"
          : "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `agent-transcript-${selectedTargetId}-${Date.now()}.${format === "markdown" ? "md" : "json"}`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="min-h-[calc(100vh-4rem)] bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.14),_transparent_26%),radial-gradient(circle_at_bottom_right,_rgba(249,115,22,0.14),_transparent_28%),linear-gradient(180deg,_#020617_0%,_#0f172a_100%)] px-3 py-4 text-slate-100 sm:px-5 xl:px-6 2xl:px-8">
      <div className="mx-auto grid w-full max-w-[2100px] gap-5 xl:grid-cols-[408px_minmax(0,1fr)] 2xl:grid-cols-[456px_minmax(0,1fr)]">
        <aside className="overflow-hidden rounded-[28px] border border-white/10 bg-slate-950/70 shadow-[0_30px_80px_rgba(2,6,23,0.55)] backdrop-blur xl:sticky xl:top-[5.25rem] xl:max-h-[calc(100vh-6.5rem)]">
          <div className="border-b border-white/10 px-5 py-4">
            <p className="text-[11px] uppercase tracking-[0.28em] text-cyan-300">
              {dictionary.agent.shell}
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-white">
              {dictionary.agent.title}
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              {dictionary.agent.subtitle}
            </p>
          </div>

          <div className="space-y-5 px-4 py-4 xl:max-h-[calc(100vh-12rem)] xl:overflow-y-auto">
            <TargetCatalogPanel
              locale={locale}
              targets={agentTargets}
              selectedTargetId={selectedTargetId}
              connectionChecksByTargetId={connectionChecksByTargetId}
              scanTargetsPending={scanTargetsPending}
              scanTargetsMessage={scanTargetsMessage}
              scanTargetsMessageTone={scanTargetsMessageTone}
              onScanTargets={handleScanTargets}
              onSelectTarget={setSelectedTargetId}
              labels={{
                targets: dictionary.agent.targets,
                model: dictionary.common.model,
                local: dictionary.common.local,
                remote: dictionary.common.remote,
                healthHealthy: dictionary.agent.healthHealthy,
                healthWarning: dictionary.agent.healthWarning,
                healthDegraded: dictionary.agent.healthDegraded,
                healthUnknown: dictionary.agent.healthUnknown,
              }}
            />

            <section className="rounded-[24px] border border-white/8 bg-white/[0.035] px-4 py-3.5">
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                {dictionary.agent.selectedProfile}
              </p>
              <div className="mt-2.5 space-y-2.5 text-sm text-slate-300">
                <div>
                  <p className="text-slate-500">{dictionary.agent.context}</p>
                  <p className="mt-1 text-[13px] leading-6 text-white">
                    {selectedTarget.recommendedContext}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">{uiText.contextWindow}</p>
                  <select
                    value={contextWindow}
                    onChange={(event) =>
                      setContextWindow(Number(event.target.value))
                    }
                    className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none"
                  >
                    {CONTEXT_WINDOW_OPTIONS.map((value) => (
                      <option key={value} value={value}>
                        {value >= 1024 ? `${Math.round(value / 1024)}K` : value}
                      </option>
                    ))}
                  </select>
                </div>
                {selectedTarget.execution === "remote" ? (
                  <div>
                    <p className="text-slate-500">{uiText.providerProfile}</p>
                    <select
                      value={providerProfile}
                      onChange={(event) =>
                        setProviderProfile(
                          event.target.value as AgentProviderProfile,
                        )
                      }
                      disabled={thinkingMode === "thinking"}
                      className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none"
                    >
                      <option value="speed">
                        {uiText.providerProfileSpeed}
                      </option>
                      <option value="balanced">
                        {uiText.providerProfileBalanced}
                      </option>
                      <option value="tool-first">
                        {uiText.providerProfileToolFirst}
                      </option>
                    </select>
                    {thinkingMode !== "thinking" ? (
                      <p className="mt-1.5 text-xs leading-5 text-slate-500">
                        {uiText.autoSpeedHint}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                {selectedTarget.execution === "remote" ? (
                  <div>
                    <p className="text-slate-500">{uiText.thinkingMode}</p>
                    <select
                      value={thinkingMode}
                      onChange={(event) =>
                        setThinkingMode(event.target.value as AgentThinkingMode)
                      }
                      className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none"
                    >
                      <option value="standard">
                        {uiText.thinkingModeStandard}
                      </option>
                      <option value="thinking">
                        {uiText.thinkingModeThinking}
                      </option>
                    </select>
                  </div>
                ) : null}
                {selectedTarget.execution === "remote" ? (
                  <div>
                    <p className="text-slate-500">
                      {uiText.actualResolvedModel}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] text-cyan-100">
                        live
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 font-mono text-[12px] leading-5 text-white">
                        {runtimeStatus?.resolvedModel ||
                          lastChatTurn?.resolvedModel ||
                          selectedTarget.modelDefault}
                      </span>
                    </div>
                    <p className="mt-2.5 text-slate-500">
                      {uiText.actualProviderProfile}
                    </p>
                    <p className="mt-1 break-all text-[13px] leading-6 text-white">
                      {lastChatTurn?.providerProfile ||
                        (thinkingMode === "thinking"
                          ? "tool-first"
                          : providerProfile)}
                    </p>
                    <p className="mt-2.5 text-slate-500">
                      {uiText.actualThinkingMode}
                    </p>
                    <p className="mt-1 break-all text-[13px] leading-6 text-white">
                      {lastChatTurn?.thinkingMode || thinkingMode}
                    </p>
                    <p className="mt-2.5 text-slate-500">
                      {uiText.thinkingModeStandard}
                    </p>
                    <div className="mt-1.5">
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 font-mono text-[12px] leading-5 text-white">
                        {runtimeStatus?.standardResolvedModel ||
                          selectedTarget.modelDefault}
                      </span>
                    </div>
                    <p className="mt-2.5 text-slate-500">
                      {uiText.thinkingModeThinking}
                    </p>
                    <div className="mt-1.5">
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 font-mono text-[12px] leading-5 text-white">
                        {runtimeStatus?.thinkingResolvedModel ||
                          selectedTarget.thinkingModelDefault ||
                          selectedTarget.modelDefault}
                      </span>
                    </div>
                    {lastChatTurn?.thinkingFallbackToStandard ||
                    (thinkingMode === "thinking" &&
                      runtimeStatus?.thinkingModelConfigured === false) ? (
                      <p className="mt-1.5 text-xs leading-5 text-amber-200">
                        {uiText.thinkingModelFallback}{" "}
                        {runtimeStatus?.resolvedModel ||
                          lastChatTurn?.resolvedModel ||
                          selectedTarget.modelDefault}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                <div>
                  <p className="text-slate-500">{dictionary.agent.memory}</p>
                  <p className="mt-1 text-[13px] leading-6">
                    {selectedTarget.memoryProfile}
                  </p>
                </div>
                {selectedTarget.execution === "local" &&
                (selectedTarget.parameterScale ||
                  selectedTarget.quantizationLabel ||
                  selectedTarget.sourceLabel ||
                  selectedTarget.sourceRepoId ||
                  selectedTarget.sourcePath ||
                  typeof selectedTarget.recommendedContextWindow ===
                    "number") ? (
                  <div className="rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-3">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                      {locale.startsWith("en")
                        ? "Local model metadata"
                        : "本地模型元数据"}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedTarget.parameterScale ? (
                        <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-cyan-100">
                          {locale.startsWith("en") ? "Scale" : "参数规模"} ·{" "}
                          {selectedTarget.parameterScale}
                        </span>
                      ) : null}
                      {selectedTarget.quantizationLabel ? (
                        <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-emerald-100">
                          {locale.startsWith("en") ? "Quant" : "量化"} ·{" "}
                          {selectedTarget.quantizationLabel}
                        </span>
                      ) : null}
                      {typeof selectedTarget.recommendedContextWindow ===
                      "number" ? (
                        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-200">
                          {locale.startsWith("en")
                            ? "Rec context"
                            : "建议上下文"}{" "}
                          ·{" "}
                          {Math.round(
                            selectedTarget.recommendedContextWindow / 1024,
                          )}
                          K
                        </span>
                      ) : null}
                      {selectedTarget.sourceLabel ? (
                        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-300">
                          {selectedTarget.sourceLabel}
                        </span>
                      ) : null}
                    </div>
                    {selectedTarget.sourceRepoId ? (
                      <p className="mt-3 break-all text-[12px] leading-6 text-slate-300">
                        {locale.startsWith("en") ? "Repo id" : "模型仓库"}:{" "}
                        {selectedTarget.sourceRepoId}
                      </p>
                    ) : null}
                    {selectedTarget.sourcePath ? (
                      <p className="mt-1 break-all text-[12px] leading-6 text-slate-400">
                        {locale.startsWith("en") ? "Source path" : "来源路径"}:{" "}
                        {sanitizeDisplayPath(selectedTarget.sourcePath)}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                <div>
                  <p className="text-slate-500">{dictionary.agent.toolMode}</p>
                  <p className="mt-1 text-[13px] leading-6">
                    {selectedTarget.supportsTools
                      ? dictionary.agent.toolsAvailable
                      : dictionary.agent.toolsUnavailable}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">{uiText.enableRetrieval}</p>
                  <p className="mt-1 text-[13px] leading-6 text-slate-300">
                    {enableRetrieval ? uiText.enabled : uiText.disabled}
                  </p>
                  <p className="mt-1.5 text-xs leading-5 text-slate-500">
                    {uiText.retrievalHint}
                  </p>
                </div>
              </div>
            </section>

            <AgentSessionToolsPanel
              locale={locale}
              uiText={uiText}
              turns={turns}
              savedSessions={savedSessions}
              currentSession={currentSession}
              sessionSyncLabel={sessionSyncLabel}
              sessionSyncConflict={sessionSyncConflict}
              sessionSearch={sessionSearch}
              sessionTargetFilter={sessionTargetFilter}
              sessionTargetOptions={sessionTargetOptions}
              sessionExportScope={sessionExportScope}
              exportableSessions={exportableSessions}
              sessionGroups={sessionGroups}
              activeSessionTargetLabel={activeSessionTargetLabel}
              onSessionSearchChange={setSessionSearch}
              onSessionTargetFilterChange={setSessionTargetFilter}
              onSessionExportScopeChange={setSessionExportScope}
              onRestoreSession={restoreSession}
              onRenameSession={handleRenameSession}
              onTogglePinSession={handleTogglePinSession}
              onDeleteSession={handleDeleteSession}
              onReloadServerSessionSnapshot={handleReloadServerSessionSnapshot}
              onForceOverwriteServerSessionSnapshot={
                handleForceOverwriteServerSessionSnapshot
              }
              onExportSessions={handleExportSessions}
              onBulkClearSessions={handleBulkClearSessions}
              onStartNewSession={startNewSession}
            />

            <details className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                    {dictionary.agent.toolRegistry}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    {dictionary.agent.toolsAvailable}
                  </p>
                </div>
                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-300">
                  {agentToolSpecs.length}
                </span>
              </summary>
              <div className="mt-4 space-y-3">
                {agentToolSpecs.map((tool) => (
                  <div
                    key={tool.name}
                    className="rounded-2xl border border-white/10 bg-black/20 p-3"
                  >
                    <p className="font-mono text-xs text-cyan-300">
                      {tool.name}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      {getLocalizedToolDescription(
                        locale,
                        tool.name,
                        tool.description,
                      )}
                    </p>
                  </div>
                ))}
              </div>
            </details>
          </div>
        </aside>

        <div className="min-w-0 overflow-hidden rounded-[28px] border border-white/10 bg-slate-950/75 shadow-[0_30px_80px_rgba(2,6,23,0.55)] backdrop-blur">
          <header className="border-b border-white/10 px-5 py-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full bg-cyan-400/[0.07] px-2 py-[3px] text-[10px] uppercase tracking-[0.18em] text-cyan-300">
                    {selectedTarget.providerLabel}
                  </span>
                  <span className="rounded-full bg-white/[0.03] px-2 py-[3px] text-[10px] uppercase tracking-[0.18em] text-slate-300">
                    {selectedTarget.transport}
                  </span>
                  <span className="rounded-full bg-white/[0.03] px-2 py-[3px] text-[10px] uppercase tracking-[0.18em] text-slate-300">
                    {selectedTarget.execution === "local"
                      ? dictionary.common.local
                      : dictionary.common.remote}
                  </span>
                </div>
                <h2 className="mt-3 text-2xl font-semibold text-white">
                  {selectedTarget.label}
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                  {dictionary.agent.subtitle}
                </p>
              </div>

              <div className="space-y-2 xl:min-w-[318px]">
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setGetCodeOpen(true)}
                    className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100 transition hover:bg-cyan-400/20"
                  >
                    {locale.startsWith("en") ? "Get code" : "获取代码"}
                  </button>
                  <div className="inline-flex rounded-full border border-white/10 bg-black/20 p-1">
                    <button
                      type="button"
                      onClick={() => setWorkbenchMode("chat")}
                      className={`rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] transition ${
                        workbenchMode === "chat"
                          ? "bg-cyan-400/15 text-cyan-100"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      chat
                    </button>
                    <button
                      type="button"
                      onClick={() => setWorkbenchMode("compare")}
                      className={`rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] transition ${
                        workbenchMode === "compare"
                          ? "bg-cyan-400/15 text-cyan-100"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      compare
                    </button>
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-3 2xl:grid-cols-4">
                  <div className="rounded-[20px] border border-white/8 bg-white/[0.035] px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
                      {dictionary.agent.messages}
                    </p>
                    <p className="mt-1.5 text-lg font-semibold text-white">
                      {historyMessages.length}
                    </p>
                  </div>
                  <div className="rounded-[20px] border border-white/8 bg-white/[0.035] px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
                      {dictionary.agent.turns}
                    </p>
                    <p className="mt-1.5 text-lg font-semibold text-white">
                      {turns.length}
                    </p>
                  </div>
                  <div className="rounded-[20px] border border-white/8 bg-white/[0.035] px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
                      {workbenchMode === "compare"
                        ? locale.startsWith("en")
                          ? "Lanes"
                          : "对比 Lane"
                        : dictionary.agent.tools}
                    </p>
                    <p className="mt-1.5 text-lg font-semibold text-white">
                      {workbenchMode === "compare"
                        ? compareLaneCount
                        : turns.reduce(
                            (count, turn) => count + turn.toolRuns.length,
                            0,
                          )}
                    </p>
                  </div>
                  <div className="rounded-[20px] border border-white/8 bg-white/[0.035] px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
                      {locale.startsWith("en") ? "Target mix" : "目标形态"}
                    </p>
                    <p className="mt-1.5 text-sm font-semibold text-white">
                      {selectedTarget.execution === "local"
                        ? locale.startsWith("en")
                          ? "Local-first"
                          : "本地优先"
                        : locale.startsWith("en")
                          ? "Remote API"
                          : "远端 API"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </header>

          <div className="border-b border-white/10 bg-black/20 px-5 py-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded-full border border-white/8 bg-white/[0.04] px-2.5 py-1 text-[11px] text-slate-300">
                {locale.startsWith("en") ? "Mode" : "模式"}:{" "}
                {workbenchMode === "chat" ? "Chat" : "Compare"}
              </span>
              <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-[11px] text-cyan-100">
                {uiText.selectedTargetLabel}: {selectedTarget.label}
              </span>
              <span className="rounded-full border border-white/8 bg-white/[0.04] px-2.5 py-1 text-[11px] text-slate-300">
                {uiText.executionMode}:{" "}
                {selectedTarget.execution === "local"
                  ? dictionary.common.local
                  : dictionary.common.remote}
              </span>
              <span className="rounded-full border border-white/8 bg-white/[0.04] px-2.5 py-1 text-[11px] text-slate-300">
                {uiText.contextWindow}:{" "}
                {formatContextWindowLabel(contextWindow)}
              </span>
              <span className="rounded-full border border-white/8 bg-white/[0.04] px-2.5 py-1 text-[11px] text-slate-300">
                {uiText.toolLoopState}:{" "}
                {enableTools ? uiText.enabled : uiText.disabled}
              </span>
              <span className="rounded-full border border-white/8 bg-white/[0.04] px-2.5 py-1 text-[11px] text-slate-300">
                {uiText.enableRetrieval}:{" "}
                {enableRetrieval ? uiText.enabled : uiText.disabled}
              </span>
              <span className="rounded-full border border-white/8 bg-white/[0.04] px-2.5 py-1 text-[11px] text-slate-300">
                {uiText.loadedAlias}: {loadedAliasForSelectedTarget || "—"}
              </span>
              {workbenchMode === "compare" ? (
                <span className="rounded-full border border-violet-400/20 bg-violet-400/10 px-2.5 py-1 text-[11px] text-violet-100">
                  {locale.startsWith("en") ? "Compare lanes" : "对比 Lane"}:{" "}
                  {compareLaneCount}
                </span>
              ) : null}
              {gatewayLoadedOtherAlias ? (
                <span className="rounded-full border border-white/8 bg-white/[0.04] px-2.5 py-1 text-[11px] text-slate-300">
                  {uiText.runtimeCurrentLoaded}:{" "}
                  {describeRuntimeAlias(gatewayLoadedOtherAlias, agentTargets)}
                </span>
              ) : null}
              {selectedTarget.execution === "local" && runtimeStatus ? (
                <>
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[11px] ${
                      runtimeStatus.available
                        ? runtimeStatus.busy
                          ? "border-amber-400/20 bg-amber-400/10 text-amber-100"
                          : "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
                        : "border-rose-400/20 bg-rose-400/10 text-rose-100"
                    }`}
                  >
                    {runtimeStatus.available
                      ? runtimeStatus.busy
                        ? dictionary.agent.runtimeBusy
                        : dictionary.agent.runtimeIdle
                      : dictionary.agent.runtimeOffline}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-300">
                    {uiText.queueLabel}: {runtimeStatus.queueDepth ?? 0}
                  </span>
                  {runtimeStatus.loadingAlias ? (
                    <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2.5 py-1 text-[11px] text-amber-100">
                      {uiText.runtimeSwitchingNow}:{" "}
                      {describeRuntimeAlias(
                        runtimeStatus.loadingAlias,
                        agentTargets,
                      )}
                      {typeof runtimeStatus.loadingElapsedMs === "number"
                        ? ` · ${uiText.runtimeLoadingElapsed} ${Math.max(1, Math.round(runtimeStatus.loadingElapsedMs / 1000))}s`
                        : ""}
                    </span>
                  ) : null}
                  <span className="rounded-full border border-white/8 bg-white/[0.04] px-2.5 py-1 text-[11px] text-slate-300">
                    {uiText.runtimeLastSwitchLoad}:{" "}
                    {formatRuntimeDuration(selectedTargetLastSwitchMs)}
                  </span>
                  <span className="rounded-full border border-white/8 bg-white/[0.04] px-2.5 py-1 text-[11px] text-slate-300">
                    {uiText.runtimeLastSwitchAt}:{" "}
                    {formatRuntimeTimestamp(selectedTargetLastSwitchAt, locale)}
                  </span>
                  {runtimeStatus.loadingError ? (
                    <span className="rounded-full border border-rose-400/20 bg-rose-400/10 px-2.5 py-1 text-[11px] text-rose-100">
                      {uiText.runtimeLoadingError}
                    </span>
                  ) : null}
                </>
              ) : null}
              {prewarmMessage ? (
                <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-[11px] text-cyan-100">
                  {uiText.prewarmModel}: {prewarmMessage}
                </span>
              ) : null}
            </div>
          </div>

          <div
            className={`grid gap-0 ${
              workbenchMode === "compare"
                ? "2xl:grid-cols-[minmax(0,1fr)_400px]"
                : "xl:grid-cols-[minmax(0,1.4fr)_420px] 2xl:grid-cols-[minmax(0,1.62fr)_500px]"
            }`}
          >
            <div className="border-b border-white/10 xl:border-b-0 xl:border-r xl:border-white/10">
              <div className="border-b border-white/10 bg-black/20 px-5 py-2.5">
                {workbenchMode === "chat" ? (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {starterPrompts.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => setInput(prompt)}
                        className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-slate-300 transition hover:border-cyan-400/30 hover:bg-cyan-400/10 hover:text-white"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-300">
                    <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-cyan-100">
                      {locale.startsWith("en")
                        ? "Compare keeps the current shell"
                        : "Compare 直接嵌进当前工作台"}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">
                      {locale.startsWith("en")
                        ? "Reuse target catalog"
                        : "复用 target catalog"}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">
                      {locale.startsWith("en")
                        ? "Same runtime guardrails"
                        : "复用 runtime guardrails"}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">
                      {locale.startsWith("en")
                        ? "API + execution next slice"
                        : "下一步接 compare run API"}
                    </span>
                  </div>
                )}
              </div>

              {workbenchMode === "chat" ? (
                <>
                  <AgentTranscriptPanel
                    locale={locale}
                    dictionary={dictionary}
                    uiText={uiText}
                    turns={turns}
                    transcriptRef={transcriptRef}
                    transcriptPinnedToBottom={transcriptPinnedToBottom}
                    unseenTranscriptTurns={unseenTranscriptTurns}
                    pending={pending}
                    pendingTargetLabel={selectedTarget.label}
                    onTranscriptScroll={handleTranscriptScroll}
                    onJumpToLatestTranscript={handleJumpToLatestTranscript}
                    replayTargetMode={replayTargetMode}
                    expandedTraceTurnId={expandedTraceTurnId}
                    expandedCitationKey={expandedCitationKey}
                    expandedReviewFileKey={expandedReviewFileKey}
                    workspaceFileViews={workspaceFileViews}
                    openWorkspaceFilePath={openWorkspaceFilePath}
                    focusedWorkspaceFilePath={focusedWorkspaceFilePath}
                    workspaceFileFocusState={workspaceFileFocusState}
                    copyState={copyState}
                    toolDecisionBusyKey={toolDecisionBusyKey}
                    toolDecisionStatusByToken={toolDecisionStatusByToken}
                    setReplayTargetMode={setReplayTargetMode}
                    setExpandedTraceTurnId={setExpandedTraceTurnId}
                    setExpandedCitationKey={setExpandedCitationKey}
                    setExpandedReviewFileKey={setExpandedReviewFileKey}
                    onPrepareReplayTurn={handlePrepareReplayTurn}
                    onReplayTurn={handleReplayTurn}
                    onCopy={handleCopy}
                    onOpenWorkspaceFile={handleOpenWorkspaceFile}
                    onStepWorkspaceFileAnchor={handleStepWorkspaceFileAnchor}
                    onToolDecision={handleToolDecision}
                    onResumeAgent={handleResumeAgent}
                  />

                  <AgentComposerForm
                    locale={locale}
                    dictionary={dictionary}
                    uiText={{
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
                    }}
                    composerRef={composerRef}
                    input={input}
                    placeholder={starterPrompts[0]}
                    pending={pending}
                    error={error}
                    turnsLength={turns.length}
                    enableTools={enableTools}
                    enableRetrieval={enableRetrieval}
                    contextWindow={contextWindow}
                    contextWindowOptions={CONTEXT_WINDOW_OPTIONS}
                    agentTargets={agentTargets}
                    selectedTarget={selectedTarget}
                    runtimeStatus={runtimeStatus}
                    runtimePhase={runtimePhase}
                    loadedAliasForSelectedTarget={loadedAliasForSelectedTarget}
                    gatewayLoadedOtherAlias={gatewayLoadedOtherAlias}
                    runtimeGuardrailBlocked={runtimeGuardrailBlocked}
                    runtimeGuardrailCaution={runtimeGuardrailCaution}
                    prewarmAllPending={prewarmAllPending}
                    prewarmPending={prewarmPending}
                    prewarmMessage={prewarmMessage}
                    runtimeActionPending={runtimeActionPending}
                    onSubmit={handleSubmit}
                    onComposerKeyDown={handleComposerKeyDown}
                    onInputChange={setInput}
                    onEnableToolsChange={setEnableTools}
                    onEnableRetrievalChange={setEnableRetrieval}
                    onContextWindowChange={setContextWindow}
                    onExportTurns={handleExportTurns}
                    onStartNewSession={startNewSession}
                    onPrewarmAll={handlePrewarmAll}
                    onPrewarm={handlePrewarm}
                  />
                  <AgentSecondaryAnalysisPanel
                    locale={locale}
                    dictionary={dictionary}
                    systemPrompt={systemPrompt}
                    setSystemPrompt={setSystemPrompt}
                    selectedTarget={selectedTarget}
                    selectedTargetId={selectedTargetId}
                    runtimeStatus={runtimeStatus}
                    lastTurn={lastTurn}
                    supportsConnectionCheck={supportsConnectionCheck}
                    connectionCheckPending={connectionCheckPending}
                    connectionCheckError={connectionCheckError}
                    connectionCheck={connectionCheck}
                    pending={pending}
                    fallbackLaunchHint={uiText.fallbackLaunchHint}
                    onConnectionCheck={handleConnectionCheck}
                  />
                </>
              ) : (
                <CompareWorkbenchPortal {...compareWorkbenchShellProps} />
              )}
            </div>

            <RuntimeStatusRail
              locale={locale}
              dictionary={dictionary}
              uiText={{
                runtimeSerializing: uiText.runtimeSerializing,
                runtimeReady: uiText.runtimeReady,
                runtimeUnavailable: uiText.runtimeUnavailable,
                runtimeCurrentLoaded:
                  uiText.runtimeCurrentLoaded ||
                  (locale.startsWith("en") ? "Loaded" : "已加载"),
                runtimeSwitchingNow:
                  uiText.runtimeSwitchingNow ||
                  (locale.startsWith("en") ? "Switching" : "切换中"),
                runtimeLastSwitchLoad:
                  uiText.runtimeLastSwitchLoad ||
                  (locale.startsWith("en") ? "Last load" : "最近加载"),
                runtimeLastSwitchAt:
                  uiText.runtimeLastSwitchAt ||
                  (locale.startsWith("en") ? "Last switch at" : "最近切换"),
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
              }}
              workbenchMode={workbenchMode}
              runtimeRailCollapsed={runtimeRailCollapsed}
              onToggleRuntimeRail={() =>
                setRuntimeRailCollapsed((current) => !current)
              }
              agentTargets={agentTargets}
              selectedTarget={selectedTarget}
              selectedTargetId={selectedTargetId}
              runtimeStatus={runtimeStatus}
              runtimePhase={runtimePhase}
              runtimeStageItems={runtimeStageItems}
              lastTurn={lastTurn}
              loadedAliasForSelectedTarget={loadedAliasForSelectedTarget}
              gatewayLoadedOtherAlias={gatewayLoadedOtherAlias}
              selectedTargetLastSwitchMs={selectedTargetLastSwitchMs}
              selectedTargetLastSwitchAt={selectedTargetLastSwitchAt}
              runtimeGuardrailBlocked={runtimeGuardrailBlocked}
              runtimeGuardrailCaution={runtimeGuardrailCaution}
              pending={pending}
              prewarmAllPending={prewarmAllPending}
              prewarmPending={prewarmPending}
              prewarmMessage={prewarmMessage}
              runtimeActionPending={runtimeActionPending}
              runtimeLogExcerpt={runtimeLogExcerpt}
              systemPrompt={systemPrompt}
              onSystemPromptChange={setSystemPrompt}
              supportsConnectionCheck={supportsConnectionCheck}
              connectionCheckPending={connectionCheckPending}
              connectionCheckError={connectionCheckError}
              connectionCheck={connectionCheck}
              onConnectionCheck={handleConnectionCheck}
              onPrewarmAll={handlePrewarmAll}
              onPrewarm={handlePrewarm}
              onRuntimeAction={handleRuntimeAction}
            />
          </div>
        </div>
      </div>
      <AgentGetCodePanel
        locale={locale}
        open={getCodeOpen}
        mode={workbenchMode}
        language={getCodeLanguage}
        summary={reproduceRequestArtifacts.summary as Record<string, unknown>}
        snippets={reproduceRequestArtifacts.snippets}
        copyState={copyState}
        onClose={() => setGetCodeOpen(false)}
        onLanguageChange={setGetCodeLanguage}
        onCopy={handleCopy}
      />
    </section>
  );
}
