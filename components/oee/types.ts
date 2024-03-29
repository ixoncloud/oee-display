import type { ComponentContextAggregatedMetricInput } from "@ixon-cdk/types";

export type Variable = {
  name: string;
  metric: ComponentContextAggregatedMetricInput;
};
export type VariableKeyValues = { [key: string]: number };
