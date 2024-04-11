import { GaugeService } from "./gauge.service";

import { formatPercentage } from "../utils/formatting";

import type { Rule } from "../utils/rules";

import type { ComponentContext } from "@ixon-cdk/types";

export class VisualizationService {
  private aGaugeService: GaugeService | null = null;
  private pGaugeService: GaugeService | null = null;
  private qGaugeService: GaugeService | null = null;
  private oeeGaugeService: GaugeService | null = null;

  constructor(
    context: ComponentContext,
    aGaugeChartEl: HTMLDivElement,
    pGaugeChartEl: HTMLDivElement,
    qGaugeChartEl: HTMLDivElement,
    oeeGaugeChartEl: HTMLDivElement,
    hideAvailability: boolean,
    hidePerformance: boolean,
    hideQuality: boolean,
    hideOee: boolean
  ) {
    const rules: { rule: Rule }[] = context?.inputs?.rules || [];

    const availabilityRules = rules.filter(
      (x) => x.rule.colorUsage === "availability"
    );
    const performanceRules = rules.filter(
      (x) => x.rule.colorUsage === "performance"
    );
    const qualityRules = rules.filter((x) => x.rule.colorUsage === "quality");
    const oeeRules = rules.filter((x) => x.rule.colorUsage === "oee");

    if (!hideAvailability) {
      this.aGaugeService = new GaugeService(
        aGaugeChartEl,
        "Availability",
        availabilityRules
      );
    }
    if (!hidePerformance) {
      this.pGaugeService = new GaugeService(
        pGaugeChartEl,
        "Performance",
        performanceRules
      );
    }
    if (!hideQuality) {
      this.qGaugeService = new GaugeService(
        qGaugeChartEl,
        "Quality",
        qualityRules
      );
    }
    if (!hideOee) {
      this.oeeGaugeService = new GaugeService(oeeGaugeChartEl, "OEE", oeeRules);
    }
  }

  public resize(isNarrow: boolean, isMedium: boolean, isShallow: boolean) {
    this.aGaugeService?.resize(isNarrow, isMedium, isShallow);
    this.pGaugeService?.resize(isNarrow, isMedium, isShallow);
    this.qGaugeService?.resize(isNarrow, isMedium, isShallow);
    this.oeeGaugeService?.resize(isNarrow, isMedium, isShallow);
  }

  public setValues(
    availability: number,
    performance: number,
    quality: number,
    oee: number
  ) {
    this.aGaugeService?.setValue(formatPercentage(availability));
    this.pGaugeService?.setValue(formatPercentage(performance));
    this.qGaugeService?.setValue(formatPercentage(quality));
    this.oeeGaugeService?.setValue(formatPercentage(oee));
  }

  public destroy() {
    this.aGaugeService?.destroy();
    this.pGaugeService?.destroy();
    this.qGaugeService?.destroy();
    this.oeeGaugeService?.destroy();
  }
}
