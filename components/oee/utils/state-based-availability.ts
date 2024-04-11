import type { ComponentContext } from "@ixon-cdk/types";

import { calculateDurationsInMilliseconds } from "./state";

import { mapValueToStateRule } from "./rules";

import { RawDataService } from "../services/raw-data.service";

export async function getStateBasedAvailability(context: ComponentContext) {
  if (
    !context?.inputs?.calculation?.stateBasedAvailability?.stateMetric?.selector
  ) {
    return undefined;
  }

  const metric = context.inputs.calculation.stateBasedAvailability.stateMetric;

  const rawStateData =
    (await new RawDataService(context).getAllRawMetrics(metric)) || [];

  const durations = calculateDurationsInMilliseconds(
    rawStateData,
    context.timeRange.to
  );

  // mapValueToRule
  const availabilityRules =
    context.inputs.calculation.stateBasedAvailability.rules;

  let operationalTime = 0;
  let plannedDowntime = 0;
  let unplannedDowntime = 0;

  // for each key in durations check if it matches a rule, then add its duration to the correct variable
  for (const key in durations) {
    const rule = mapValueToStateRule(key, availabilityRules);

    if (rule) {
      if (rule.state.stateClassification === "operationalTime") {
        operationalTime += durations[key];
      } else if (rule.state.stateClassification === "plannedDowntime") {
        plannedDowntime += durations[key];
      } else if (rule.state.stateClassification === "unplannedDowntime") {
        unplannedDowntime += durations[key];
      }
    } else {
      operationalTime += durations[key]; // if no rule is found, add it to operationalTime
    }
  }

  const availabilityBasedOnState =
    operationalTime / (operationalTime + unplannedDowntime);

  return availabilityBasedOnState;
}
