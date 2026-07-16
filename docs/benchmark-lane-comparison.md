# Benchmark Lane Comparison

This matrix is the operating guide for choosing a local or remote lane. Context values below are conservative starting points, not universal model limits. The benchmark profile and provider account remain the source of truth for a specific run.

| Lane | Execution | Best fit | Recommended starting context | Stability prerequisites | Main tradeoff |
| --- | --- | --- | --- | --- | --- |
| Local Qwen3 0.6B | MLX local | Gateway smoke, latency checks, tool-path validation | 4K to 8K | Loaded MLX gateway and enough unified memory | Very fast and cheap, but weak for complex code quality |
| Local Qwen3 4B 4-bit | MLX local | General local baseline and reproducible regression runs | 8K to 16K | Verified weights, tokenizer, template, and prewarm | Balanced local lane; lower reasoning ceiling than remote flagships |
| Local Qwen3.5 4B 4-bit | MLX local | Default local coding and Agent iteration | 8K to 16K | Same as above, plus target-specific context probe | Strongest default local balance on the validated Apple Silicon setup |
| Local Gemma 3 4B It Qat 4-bit | MLX local | Alternative general-instruction baseline | 8K to 16K | Compatible chat template and quantized runtime | Useful diversity; coding/tool behavior needs task-specific validation |
| OpenAI Codex | Remote OpenAI-compatible | Complex coding, tool chains, patch review | Provider-managed; benchmark with the selected profile | Valid key, endpoint, quota, model access, and timeout budget | Highest external dependency and variable cost |
| OpenAI GPT lane | Remote OpenAI-compatible | General reasoning and high-quality comparison | Provider-managed | Same provider checks plus exact model availability | Strong quality, but model aliases and account access can drift |
| Claude API | Remote compatible bridge | Long-form review and complex tool workflows | Provider-managed | Valid bridge endpoint, key, model alias, and rate limit | Strong analysis; bridge compatibility must be proven |
| DeepSeek API | Remote OpenAI-compatible | Cost-aware coding and reasoning comparison | Provider-managed | Valid key, balance, model alias, and regional reachability | Attractive cost/quality; availability and latency can vary |
| Kimi API | Remote OpenAI-compatible | Long-context Chinese and document-oriented comparison | Provider-managed | Valid Moonshot endpoint, key, and quota | Good language coverage; provider-specific behavior needs normalization |
| GLM API | Remote OpenAI-compatible | Chinese general and tool-use comparison | Provider-managed | Valid Zhipu endpoint, key, and model access | Useful regional alternative; tool schema compatibility can differ |
| Qwen API | Remote DashScope compatible | Qwen cloud/local family comparison | Provider-managed | Valid DashScope key, endpoint, and model access | Good family parity; cloud behavior is not identical to local MLX |

## Selection Rules

1. Run `Local Qwen3 0.6B` first only as a health probe, not as the quality baseline.
2. Use `Local Qwen3.5 4B 4-bit` as the default local coding lane when hardware verification passes.
3. Pair one local lane with one remote lane for quality/cost comparisons; keep prompt, context, runs, and thinking profile aligned.
4. Mark missing credentials, quota exhaustion, unavailable aliases, and failed prewarm as skipped targets. They must not block the remaining benchmark plan.
5. A `32K` benchmark receipt proves that exact run configuration; it does not replace the conservative interactive defaults above.

Use the per-run **Issue summary** export in `/benchmarks` to attach the exact target metrics and classified failures to a GitHub issue.
