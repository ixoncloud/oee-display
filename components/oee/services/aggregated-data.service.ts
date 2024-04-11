import type {
  ComponentContext,
  LoggingDataClient,
  LoggingDataMetric,
} from "@ixon-cdk/types";

import { mapMetricInputToQuery } from "../utils/query";

import type { Writable } from "svelte/store";

import type { Variable, VariableKeyValues } from "../types";

export class AggregatedDataService {
  private context: ComponentContext;
  private error: Writable<string>;
  private cancelQuery: (() => void) | void | undefined;
  private loggingDataClient: LoggingDataClient;

  constructor(context: ComponentContext, error: Writable<string>) {
    this.context = context;
    this.error = error;
    this.loggingDataClient = context.createLoggingDataClient();
  }

  async getVariableKeyValues(): Promise<VariableKeyValues> {
    const variables = this._getVariables();

    const queries = variables.map((x: { variable: Variable }) => {
      return {
        ...mapMetricInputToQuery(x?.variable?.metric),
        limit: 1,
      };
    });

    if (queries.length === 0) {
      return {};
    }

    if (this.cancelQuery) {
      this.cancelQuery();
      this.cancelQuery = undefined;
    }

    // Wrap the query in a promise
    return await new Promise((resolve, reject) => {
      this.cancelQuery = this.loggingDataClient.query(
        queries,
        (metrics: LoggingDataMetric[][]) => {
          const variableKeyValues = this._processResponse(metrics);
          resolve(variableKeyValues); // Resolve the promise if _processResponse completes without errors
        }
      );
    });
  }

  private async _processResponse(metrics: LoggingDataMetric[][]) {
    const variableValues = metrics.map((x) => {
      const value = x[0]?.value?.getValue();
      return value !== undefined ? Number(value) : "no-data-in-period";
    });

    const noDataInPeriod =
      variableValues.find((x) => x === "no-data-in-period") !== undefined;
    if (noDataInPeriod) {
      this.error.set("No data available in selected time period");
      return;
    }

    const notANumber =
      variableValues.find((x) => Number.isNaN(x)) !== undefined;
    if (notANumber) {
      this.error.set("Only works with number variables");
      return;
    }

    const variableNames = this._getVariableNames();

    const variableKeyValues = variableNames.reduce(
      (accumulator: any, value: string, index: number) => {
        return { ...accumulator, [value]: variableValues[index] };
      },
      {}
    );
    return variableKeyValues;
  }

  private _getVariables() {
    const variables = this.context.inputs.variables;

    const variableNames = variables.map(
      (x: { variable: Variable }) => x?.variable?.name
    );
    const hasDuplicates = (variableNames: string[]) =>
      variableNames.length !== new Set(variableNames).size;

    if (hasDuplicates(variableNames)) {
      this.error.set("Please use unique variable names");
      return;
    }

    return variables;
  }

  private _getVariableNames() {
    const variables = this.context.inputs.variables;

    const variableNames = variables.map(
      (x: { variable: Variable }) => x?.variable?.name
    );
    const hasDuplicates = (variableNames: string[]) =>
      variableNames.length !== new Set(variableNames).size;

    if (hasDuplicates(variableNames)) {
      this.error.set("Please use unique variable names");
      return;
    }

    return variableNames;
  }
}
