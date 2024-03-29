import type { ComponentContext } from "@ixon-cdk/types";

import type { VariableKeyValues } from "../types";

export class DebugService {
  private context: ComponentContext;
  private availability: number | undefined;
  private availabilityBasedOnState: number | undefined;
  private performance: number | undefined;
  private quality: number | undefined;
  private oee: number | undefined;
  private variableKeyValues: VariableKeyValues | undefined;

  constructor(context: ComponentContext) {
    this.context = context;
  }

  setValues(
    availability: number | undefined,
    availabilityBasedOnState: number | undefined,
    performance: number | undefined,
    quality: number | undefined,
    oee: number | undefined,
    variableKeyValues: VariableKeyValues
  ) {
    this.availability = availability;
    this.availabilityBasedOnState = availabilityBasedOnState;
    this.performance = performance;
    this.quality = quality;
    this.oee = oee;
    this.variableKeyValues = variableKeyValues;
  }

  printDebugInfoJson() {
    const debugInfo = {
      availability: `${
        this.context.inputs.calculation?.availability?.formula || "no-formula"
      }  = ${this.availability}`,
      availabilityBasedOnState: `${this.availabilityBasedOnState}`,
      performance: `${
        this.context.inputs.calculation?.performance?.formula || "no-formula"
      } = ${this.performance}`,
      quality: `${
        this.context.inputs.calculation?.quality?.formula || "no-formula"
      } = ${this.quality}`,
      oee: `${this.oee}`,
      variables: Object.entries(this.variableKeyValues || []).map(
        ([k, v]) => `${k} = ${v}`
      ),
    };
    const jsonString = JSON.stringify(debugInfo, null, 2); // Indent with 2 spaces for readability
    return jsonString;
  }
}
