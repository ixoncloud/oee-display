export type Rule = {
  operator: string;
  value: string;
  color: string;
  colorUsage: string;
};

export type StateRule = {
  value: string;
  stateClassification: string;
};

function ruleToPredicate(rule: Rule, value: number | string) {
  const threshold = rule.value;
  const type = typeof value;
  if (type !== "string") {
    switch (rule.operator) {
      case "eq":
        return Number(value) === Number(threshold);
      case "ne":
        return Number(value) !== Number(threshold);
      case "lt":
        return Number(value) < Number(threshold);
      case "le":
        return Number(value) <= Number(threshold);
      case "gt":
        return Number(value) > Number(threshold);
      case "ge":
        return Number(value) >= Number(threshold);
    }
  } else {
    const comparison = String(value).localeCompare(String(threshold));
    switch (rule.operator) {
      case "eq":
        return comparison === 0;
      case "ne":
        return comparison !== 0;
      case "lt":
        return comparison < 0;
      case "le":
        return comparison <= 0;
      case "gt":
        return comparison > 0;
      case "ge":
        return comparison >= 0;
    }
  }
}

export function mapValueToRule(
  value: number | string,
  rules: {
    rule: Rule;
  }[]
) {
  return rules?.find((item) => ruleToPredicate(item.rule, value));
}

export function mapValueToRuleIndex(
  value: number | string,
  rules: {
    rule: Rule;
  }[]
) {
  return rules?.findIndex((item) => ruleToPredicate(item.rule, value));
}

export function mapValueToStateRule(
  value: number | string,
  rules: {
    state: StateRule;
  }[]
) {
  return rules?.find((item) => stateRuleToPredicate(item.state, value));
}

// state rules only have a single operator, eq
function stateRuleToPredicate(rule: StateRule, value: number | string) {
  const threshold = rule.value;
  const type = typeof value;
  if (type !== "string") {
    return Number(value) === Number(threshold);
  } else {
    return String(value).localeCompare(String(threshold)) === 0;
  }
}
