import { Parser } from "expr-eval";

import type { ComponentContext } from "@ixon-cdk/types";

import { error } from "../stores";

import type { VariableKeyValues } from "../types";

export function calculateOee(
  context: ComponentContext,
  variableKeyValues: VariableKeyValues,
  availabilityBasedOnState?: number
): {
  oee?: number;
  availability?: number;
  performance?: number;
  quality?: number;
} {
  let availability = _doCalculation(
    variableKeyValues,
    context.inputs.calculation?.availability?.formula
  );

  if (availabilityBasedOnState !== undefined) {
    availability = availabilityBasedOnState;
  } else [];

  const performance = _doCalculation(
    variableKeyValues,
    context.inputs.calculation?.performance?.formula
  );

  const quality = _doCalculation(
    variableKeyValues,
    context.inputs.calculation?.quality?.formula
  );

  const oee = (availability || 0) * (quality || 0) * (performance || 0);

  if (
    availability === undefined ||
    performance === undefined ||
    quality === undefined
  ) {
    error.set("availability, performance or quality is undefined");
    return { oee, availability, performance, quality };
  }

  if (availability > 1 || performance > 1 || quality > 1) {
    error.set("only works with decimal calculation results where 1 is 100%");
    return { oee, availability, performance, quality };
  }

  if (availability < 0 || performance < 0 || quality < 0) {
    error.set("only works with positive calculation results");
    return { oee, availability, performance, quality };
  }

  return {
    oee,
    availability,
    performance,
    quality,
  };
}

function _doCalculation(
  variableKeyValues: VariableKeyValues,
  formula?: string
) {
  if (!formula) {
    formula = "0";
  }
  try {
    const calculatedValue = Parser.evaluate(formula, variableKeyValues);
    return calculatedValue;
  } catch {
    error.set(
      "Invalid formula, example: x / y * 100. Make sure all your variables are defined"
    );
  }
}
