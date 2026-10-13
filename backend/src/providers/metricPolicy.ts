import type {
  CompatibleUsageTotal,
  ProviderId,
  ProviderUsageSource,
  UsageMetric,
  UsageReport,
} from "../../../shared/types/dashboard.js";

interface MetricDefinition {
  unit: string;
  aggregationKey?: string;
  providerName?: string;
  description: string;
}

const UNRECOGNIZED_METRIC = "unrecognized_metric";

const metricAllowlist: Record<ProviderId, Record<string, MetricDefinition>> = {
  github_copilot: {
    user_initiated_interaction_count: {
      unit: "events",
      description: "Provider-reported interactions initiated by users.",
    },
    code_generation_activity_count: {
      unit: "events",
      description:
        "Provider-reported code generation activity events, not tokens or accepted lines.",
    },
    code_acceptance_activity_count: {
      unit: "events",
      description: "Provider-reported code acceptance activity events.",
    },
  },
  openai: {
    input_tokens: {
      unit: "tokens",
      description:
        "Provider-reported input tokens, including cached input according to OpenAI accounting.",
    },
    output_tokens: {
      unit: "tokens",
      aggregationKey: "output_tokens",
      description:
        "Provider-reported model output tokens; model tokenizers can differ.",
    },
    model_requests: {
      unit: "requests",
      providerName: "num_model_requests",
      description: "Provider-reported number of model requests.",
    },
  },
  anthropic: {
    uncached_input_tokens: {
      unit: "tokens",
      description:
        "Provider-reported input tokens outside cache reads and cache creation.",
    },
    cache_read_input_tokens: {
      unit: "tokens",
      description: "Provider-reported input tokens read from the prompt cache.",
    },
    "cache_creation.ephemeral_1h_input_tokens": {
      unit: "tokens",
      description:
        "Provider-reported input tokens used to create one-hour prompt cache entries.",
    },
    "cache_creation.ephemeral_5m_input_tokens": {
      unit: "tokens",
      description:
        "Provider-reported input tokens used to create five-minute prompt cache entries.",
    },
    output_tokens: {
      unit: "tokens",
      aggregationKey: "output_tokens",
      description:
        "Provider-reported model output tokens; model tokenizers can differ.",
    },
  },
};

export function enforceProviderMetricPolicy(
  source: ProviderUsageSource,
): ProviderUsageSource {
  const definitions = metricAllowlist[source.id];
  const metricCounts = new Map<string, number>();
  for (const usageMetric of source.metrics) {
    metricCounts.set(
      usageMetric.name,
      (metricCounts.get(usageMetric.name) ?? 0) + 1,
    );
  }

  const unsupportedMetrics = new Set<string>();
  let hasUnrecognizedMetric = false;
  for (const name of source.unsupportedMetrics) {
    if (Object.hasOwn(definitions, name)) {
      unsupportedMetrics.add(name);
    } else {
      hasUnrecognizedMetric = true;
    }
  }
  const metrics = source.metrics.filter((usageMetric) => {
    const definition = definitions[usageMetric.name];
    if (!definition) {
      hasUnrecognizedMetric = true;
      return false;
    }
    if (
      metricCounts.get(usageMetric.name) !== 1 ||
      !matchesDefinition(usageMetric, definition)
    ) {
      unsupportedMetrics.add(usageMetric.name);
      return false;
    }
    return true;
  });
  if (hasUnrecognizedMetric) {
    unsupportedMetrics.add(UNRECOGNIZED_METRIC);
  }

  return {
    ...source,
    metrics,
    metricDefinitions: Object.fromEntries(
      metrics.map(({ name }) => [
        name,
        {
          providerName: definitions[name].providerName ?? name,
          description: definitions[name].description,
        },
      ]),
    ),
    status:
      source.status === "success" && unsupportedMetrics.size > 0
        ? "partial"
        : source.status,
    unsupportedMetrics: [...unsupportedMetrics],
  };
}

export function compatibleUsageTotals(
  sources: ProviderUsageSource[],
): CompatibleUsageTotal[] {
  const groups = new Map<
    string,
    {
      name: string;
      value: bigint;
      unit: string;
      currency: string | null;
      kind: UsageMetric["kind"];
      sourceIds: Set<ProviderId>;
    }
  >();

  for (const source of sources) {
    if (source.status !== "success" || !source.actualPeriod) {
      continue;
    }
    const definitions = metricAllowlist[source.id];
    for (const usageMetric of source.metrics) {
      const definition = definitions[usageMetric.name];
      if (
        !definition?.aggregationKey ||
        !matchesDefinition(usageMetric, definition) ||
        !/^\d+$/.test(usageMetric.value)
      ) {
        continue;
      }
      const key = JSON.stringify([
        definition.aggregationKey,
        usageMetric.unit,
        usageMetric.currency,
        usageMetric.kind,
        source.actualPeriod.from,
        source.actualPeriod.to,
      ]);
      const group = groups.get(key) ?? {
        name: usageMetric.name,
        value: 0n,
        unit: usageMetric.unit,
        currency: usageMetric.currency,
        kind: usageMetric.kind,
        sourceIds: new Set<ProviderId>(),
      };
      group.value += BigInt(usageMetric.value);
      group.sourceIds.add(source.id);
      groups.set(key, group);
    }
  }

  return [...groups.values()]
    .filter((group) => group.sourceIds.size > 1)
    .map((group) => ({
      name: group.name,
      value: group.value.toString(),
      unit: group.unit,
      currency: group.currency,
      kind: group.kind,
      sourceIds: [...group.sourceIds],
    }));
}

export function createUsageReport(
  requestedPeriod: UsageReport["requestedPeriod"],
  rawSources: ProviderUsageSource[],
): UsageReport {
  const sources = rawSources.map(enforceProviderMetricPolicy);
  return {
    requestedPeriod,
    sources,
    compatibleTotals: compatibleUsageTotals(sources),
  };
}

function matchesDefinition(
  usageMetric: UsageMetric,
  definition: MetricDefinition,
): boolean {
  return (
    usageMetric.unit === definition.unit &&
    usageMetric.currency === null &&
    usageMetric.kind === "reported" &&
    /^\d+$/.test(usageMetric.value)
  );
}
