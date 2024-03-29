<script lang="ts">
  import { onMount, tick } from "svelte";

  import { AggregatedDataService } from "./services/aggregated-data.service";

  import { error } from "./stores";

  import { calculateOee } from "./utils/oee";

  import { getStateBasedAvailability } from "./utils/state-based-availability";

  import type { ComponentContext } from "@ixon-cdk/types";

  import type { VariableKeyValues } from "./types";

  import { runResizeObserver } from "./utils/responsiveness";

  import { VisualizationService } from "./services/visualization";

  import { DebugService } from "./services/debug.service";

  export let context: ComponentContext;

  let debugMode = false;

  let aggregatedDataService: AggregatedDataService;
  let debugService: DebugService;
  let header: { title: string; subtitle: string };

  let rootEl: HTMLDivElement;

  let loading = true;

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
    error.set("");

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

    aggregatedDataService = new AggregatedDataService(context);
    debugService = new DebugService(context);

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
      resize();
    });
  }

  async function onTimeRangeChanged() {
    loading = true;
    const variableKeyValues =
      await aggregatedDataService.getVariableKeyValues();
    const availabilityBasedOnState = await getStateBasedAvailability(context);

    const calculationResult = calculateOee(
      context,
      variableKeyValues,
      availabilityBasedOnState
    );

    if (!debugMode) {
      visualizationService.setValues(
        calculationResult.availability || 0,
        calculationResult.performance || 0,
        calculationResult.quality || 0,
        calculationResult.oee || 0
      );
    } else {
      debugService.setValues(
        calculationResult.availability,
        availabilityBasedOnState,
        calculationResult.performance,
        calculationResult.quality,
        calculationResult.oee,
        variableKeyValues
      );
    }
    loading = false;
    resize();
  }

  function resize() {
    tick().then(() => {
      if (!debugMode) {
        visualizationService.resize(isNarrow, isMedium, isShallow);
      }
    });
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
  {#if $error}
    <p>{$error}</p>
  {/if}
  {#if loading}
    <p>loading...</p>
  {/if}

  <div
    class="card-content"
    bind:clientWidth={contentWidth}
    bind:clientHeight={contentHeight}
  >
    {#if debugMode && !loading}
      <div class="json-debug">
        <pre>{debugService.printDebugInfoJson()}</pre>
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

  .json-debug {
    white-space: pre-wrap; /* Ensures formatting is preserved in HTML */
    background-color: #f5f5f5; /* Light grey background */
    padding: 10px; /* Padding around the text */
    border-radius: 4px; /* Rounded corners for the container */
    overflow-x: auto; /* Adds a horizontal scrollbar if content is too wide */
  }
</style>
