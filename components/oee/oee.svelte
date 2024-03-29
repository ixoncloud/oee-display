<script lang="ts">
  import { onMount, tick } from "svelte";

  import { Parser } from "expr-eval";

  import type {
    ComponentContext,
    LoggingDataClient,
    LoggingDataMetric,
    ComponentContextAggregatedMetricInput,
  } from "@ixon-cdk/types";

  import { mapValueToStateRule } from "./utils/rules";

  type Variable = {
    name: string;
    metric: ComponentContextAggregatedMetricInput;
  };
  type VariableKeyValues = { [key: string]: number };

  import { runResizeObserver } from "./utils/responsiveness";

  import { mapMetricInputToQuery } from "./utils/query";

  import { DataService } from "./services/data.service";
  import { calculateDurationsInMilliseconds } from "./utils/state";
  import { VisualizationService } from "./services/visualization";

  export let context: ComponentContext;

  let loading = true;

  let loggingDataClient: LoggingDataClient;
  let header: { title: string; subtitle: string };
  let error = "";
  let rootEl: HTMLDivElement;
  let cancelQuery: (() => void) | void | undefined;
  let availability: number | undefined;
  let availabilityBasedOnState: number | undefined;
  let performance: number | undefined;
  let quality: number | undefined;
  let oee: number | undefined;

  let debugMode = false;

  let variableKeyValues: VariableKeyValues = {};

  // visualization variables
  let aGaugeChartEl: HTMLDivElement;
  let pGaugeChartEl: HTMLDivElement;
  let qGaugeChartEl: HTMLDivElement;
  let oeeGaugeChartEl: HTMLDivElement;
  let hideAvailability = false;
  let hidePerformance = false;
  let hideQuality = false;
  let hideOee = false;

  let visualizationService: VisualizationService;

  let contentWidth = 0;
  let contentHeight = 0;

  $: isNarrow = contentWidth < 600;
  $: isMedium = contentWidth < 1200;
  $: isShallow = contentHeight < 400;

  onMount(() => {
    error = "";

    header = context ? context.inputs.header : undefined;
    debugMode = context?.inputs?.debugMode || false;
    hideAvailability =
      context?.inputs?.displayOptions?.hideAvailability || false;
    hidePerformance = context?.inputs?.displayOptions?.hidePerformance || false;
    hideQuality = context?.inputs?.displayOptions?.hideQuality || false;
    hideOee = context?.inputs?.displayOptions?.hideOee || false;

    visualizationService = new VisualizationService(
      context,
      aGaugeChartEl,
      pGaugeChartEl,
      qGaugeChartEl,
      oeeGaugeChartEl,
      hideAvailability,
      hidePerformance,
      hideQuality,
      hideOee
    );

    loggingDataClient = context.createLoggingDataClient();

    context.ontimerangechange = onTimeRangeChanged;

    // Run the query once to get the initial data
    onTimeRangeChanged();

    const resizeObserver = initResizeObserver();

    return () => {
      resizeObserver?.disconnect();
      visualizationService.destroy();
    };
  });

  function initResizeObserver() {
    return runResizeObserver(rootEl, () => {
      tick().then(() => {
        if (!debugMode) {
          visualizationService.resize(isNarrow, isMedium, isShallow);
        }
      });
    });
  }

  function onTimeRangeChanged() {
    loading = true;
    _runChartQuery();
  }

  async function _runChartQuery() {
    if (cancelQuery) {
      cancelQuery();
      cancelQuery = undefined;
    }
    cancelQuery = await _chartQuery();
  }

  async function _chartQuery() {
    const variables = _getVariables();

    const queries = variables.map((x: { variable: Variable }) => {
      return {
        ...mapMetricInputToQuery(x?.variable?.metric),
        limit: 1,
      };
    });
    console.log(context);

    // Wrap the query in a promise

    await new Promise((resolve, reject) => {
      cancelQuery = loggingDataClient.query(
        queries,
        (metrics: LoggingDataMetric[][]) => {
          _processResponse(metrics);
          resolve(null); // Resolve the promise if _processResponse completes without errors
        }
      );
    });

    const rawStateData =
      (await new DataService(context).getAllRawMetrics()) || [];
    console.log(rawStateData);

    const durations = calculateDurationsInMilliseconds(
      rawStateData,
      context.timeRange.to
    );

    // mapValueToRule
    const availabilityRules =
      context.inputs.calculation.availability.stateBasedAvailability.rules;

    console.log("availabilityRules", availabilityRules);

    let operationalTime = 0;
    let plannedDowntime = 0;
    let unplannedDowntime = 0;

    // for each key in durations check if it matches a rule, then add its duration to the correct variable
    for (const key in durations) {
      const rule = mapValueToStateRule(key, availabilityRules);
      console.log("rule", rule);
      if (rule) {
        if (rule.state.stateClassification === "operationalTime") {
          operationalTime += durations[key];
        } else if (rule.state.stateClassification === "plannedDowntime") {
          plannedDowntime += durations[key];
        } else if (rule.state.stateClassification === "unplannedDowntime") {
          unplannedDowntime += durations[key];
        } else {
          operationalTime += durations[key]; // if no rule is found, add it to operationalTime
        }
      }
    }

    console.log("operationalTime", operationalTime);
    console.log("plannedDowntime", plannedDowntime);
    console.log("unplannedDowntime", unplannedDowntime);

    // availabilityBasedOnState =
    //   (operationalTime + plannedDowntime) /
    //   (operationalTime + plannedDowntime + unplannedDowntime);

    availabilityBasedOnState =
      operationalTime / (operationalTime + unplannedDowntime);

    console.log("abs", availabilityBasedOnState);

    console.log(durations);

    calculateOee();
  }

  async function _processResponse(metrics: LoggingDataMetric[][]) {
    const variableValues = metrics.map((x) => {
      const value = x[0]?.value?.getValue();
      return value !== undefined ? Number(value) : "no-data-in-period";
    });

    const noDataInPeriod =
      variableValues.find((x) => x === "no-data-in-period") !== undefined;
    if (noDataInPeriod) {
      error = "No data available in selected time period";
      return;
    }

    const notANumber =
      variableValues.find((x) => Number.isNaN(x)) !== undefined;
    if (notANumber) {
      error = "Only works with number variables";
      return;
    }

    const variableNames = _getVariableNames();

    variableKeyValues = variableNames.reduce(
      (accumulator: any, value: string, index: number) => {
        return { ...accumulator, [value]: variableValues[index] };
      },
      {}
    );
  }

  function calculateOee() {
    availability = _doCalculation(
      variableKeyValues,
      context.inputs.calculation?.availability?.formula
    );

    if (availabilityBasedOnState) {
      availability = availabilityBasedOnState;
    }

    performance = _doCalculation(
      variableKeyValues,
      context.inputs.calculation?.performance?.formula
    );

    quality = _doCalculation(
      variableKeyValues,
      context.inputs.calculation?.quality?.formula
    );

    if (
      availability === undefined ||
      performance === undefined ||
      quality === undefined
    ) {
      return;
    }

    if (availability > 1 || performance > 1 || quality > 1) {
      error = "only works with decimal calculation results where 1 is 100%";
      return;
    }

    if (availability < 0 || performance < 0 || quality < 0) {
      error = "only works with positive calculation results";
      return;
    }

    oee = availability * quality * performance;

    loading = false;

    if (!debugMode) {
      visualizationService.setValues(availability, performance, quality, oee);
    }
  }

  function _getVariables() {
    const variables = context.inputs.variables;

    const variableNames = variables.map(
      (x: { variable: Variable }) => x?.variable?.name
    );
    const hasDuplicates = (variableNames: string[]) =>
      variableNames.length !== new Set(variableNames).size;

    if (hasDuplicates(variableNames)) {
      error = "Please use unique variable names";
      return;
    }

    return variables;
  }

  function _getVariableNames() {
    const variables = context.inputs.variables;

    const variableNames = variables.map(
      (x: { variable: Variable }) => x?.variable?.name
    );
    const hasDuplicates = (variableNames: string[]) =>
      variableNames.length !== new Set(variableNames).size;

    if (hasDuplicates(variableNames)) {
      error = "Please use unique variable names";
      return;
    }

    return variableNames;
  }

  function _doCalculation(
    variableKeyValues: VariableKeyValues,
    formula?: string
  ) {
    if (!formula) {
      formula = "1";
    }
    try {
      const calculatedValue = Parser.evaluate(formula, variableKeyValues);
      return calculatedValue;
    } catch {
      error =
        "Invalid formula, example: x / y * 100. Make sure all your variables are defined";
    }
  }
</script>

<div class="card" bind:this={rootEl}>
  {#if header && (header.title || header.subtitle)}
    <div class="card-header">
      {#if header.title}
        <h3 class="card-title">{header.title}</h3>
      {/if}
      {#if header.subtitle}
        <h4 class="card-subtitle">{header.subtitle}</h4>
      {/if}
    </div>
  {/if}
  <div
    class="card-content"
    bind:clientWidth={contentWidth}
    bind:clientHeight={contentHeight}
  >
    {#if loading}
      loading...
    {/if}

    {#if debugMode && variableKeyValues}
      <div>
        <p>
          availability: {context.inputs.calculation?.availability?.formula} = {availability}
        </p>
        <p>
          availabilityBasedOnState: {availabilityBasedOnState}
        </p>
        <p>
          performance: {context.inputs.calculation?.performance?.formula} = {performance}
        </p>
        <p>
          quality: {context.inputs.calculation?.quality?.formula} = {quality}
        </p>
        <p>
          oee = {oee}
        </p>
        <p>variables:</p>
        {#each Object.entries(variableKeyValues) as [k, v]}
          <p>{k} = {v}</p>
        {/each}
        <p />
      </div>
    {:else if error}
      <div>
        <p>{error}</p>
      </div>
    {:else}
      {#if !hideAvailability}
        <div class="chart-wrapper">
          <div class="chart" bind:this={aGaugeChartEl} />
        </div>
      {/if}
      {#if !hidePerformance}
        <div class="chart-wrapper">
          <div class="chart" bind:this={pGaugeChartEl} />
        </div>
      {/if}
      {#if !hideQuality}
        <div class="chart-wrapper">
          <div class="chart" bind:this={qGaugeChartEl} />
        </div>
      {/if}
      {#if !hideOee}
        <div class="chart-wrapper">
          <div class="chart" bind:this={oeeGaugeChartEl} />
        </div>
      {/if}
    {/if}
  </div>
</div>

<style lang="scss">
  @import "./styles/card";

  .card-content {
    padding: 0px !important;
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
  }
  .chart-wrapper {
    flex: 1;
    -webkit-touch-callout: none;
    user-select: none;
    height: 100%;
    position: relative;
    overflow: hidden;
  }

  .chart {
    position: absolute;
    height: 100%;
    width: 100%;
    -webkit-touch-callout: none;
    user-select: none;

    top: 0; /* Position at the top of .chart-wrapper */
    left: 0; /* Position at the left of .chart-wrapper */
  }
</style>
