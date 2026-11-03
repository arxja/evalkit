export interface LabeledResult {
  id: string;
  human: "pass" | "fail";
  judge: "pass" | "fail";
  agree: boolean;
}

export interface AgreementReport {
  total: number;
  agree: number;
  rate: number;
  perCase: LabeledResult[];
}

export function computeAgreement(perCase: LabeledResult[]): AgreementReport {
  const total = perCase.length;
  const agree = perCase.filter((r) => r.agree).length;
  return { total, agree, rate: total ? agree / total : 0, perCase };
}
