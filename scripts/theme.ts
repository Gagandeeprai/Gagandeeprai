export interface Theme {
  bg: string;
  border: string;
  accent: string;
  text: string;
  textMuted: string;
  textYellow: string;
  textOrange: string;
  textGreen: string;
  gridColors: string[];
}

export const theme: Theme = {
  bg: "#0d1117",
  border: "#30363d",
  accent: "#58a6ff",
  text: "#c9d1d9",
  textMuted: "#8b949e",
  textYellow: "#e3b341",
  textOrange: "#f0883e",
  textGreen: "#39d353",
  gridColors: [
    "#161b22", // L0: None
    "#0e4429", // L1: Low
    "#006d32", // L2: Med-Low
    "#26a641", // L3: Med-High
    "#39d353"  // L4: High
  ]
};
