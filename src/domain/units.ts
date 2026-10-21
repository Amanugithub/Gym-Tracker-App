import type { Unit } from "../db/types";

const KG_PER_LB = 0.45359237;

export function weightToKg(value: number, unit: Unit): number {
  return unit === "lb" ? value * KG_PER_LB : value;
}

export function weightFromKg(valueKg: number, unit: Unit): number {
  return unit === "lb" ? valueKg / KG_PER_LB : valueKg;
}

export function formatWeight(valueKg: number, unit: Unit): string {
  const value = weightFromKg(valueKg, unit);
  return value.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}
